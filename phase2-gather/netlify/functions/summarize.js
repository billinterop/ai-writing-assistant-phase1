// netlify/functions/summarize.js
const multipart = require("aws-lambda-multipart-parser");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: { Allow: "POST" }, body: "Method Not Allowed" };
    }

    const parsed = multipart.parse(event, true); // base64 decode
    // Collect files whether single or multiple, and accept any field that looks like a file
    let files = [];

    if (Array.isArray(parsed.file)) {
      files = parsed.file;
    } else if (parsed.file && parsed.file.content) {
      files = [parsed.file];
    } else {
      // Fallback: pick any fields with filename+content (handles different field names)
      files = Object.values(parsed).filter(
        (v) => v && typeof v === "object" && v.filename && v.content
      );
    }

    // Optional notes (text fields)
    let notes = [];
    if (parsed.note) notes = Array.isArray(parsed.note) ? parsed.note : [parsed.note];

    if ((!files || files.length === 0) && notes.length === 0) {
      return json(400, { error: "No files or notes found in request. Field name should be 'file' for uploads and 'note' for text." });
    }

    // Extract text from all inputs
    const chunks = [];

    for (const f of files) {
      const filename = f.filename || "upload.bin";
      const contentType = f.contentType || "";
      const buffer = Buffer.isBuffer(f.content) ? f.content : Buffer.from(f.content);
      const text = await extractText({ buffer, filename, contentType });
      if (text && text.trim()) {
        chunks.push(`File: ${filename}\n${text.trim()}`);
      }
    }

    for (const n of notes) {
      if (typeof n === "string" && n.trim()) {
        chunks.push(`Note:\n${n.trim()}`);
      }
    }

    const fullText = chunks.join("\n\n---\n\n");
    if (!fullText.trim()) {
      return json(400, { error: "Uploaded files/notes contained no extractable text." });
    }

    // OpenAI call
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return json(500, { error: "OPENAI_API_KEY not set on server." });

    const prompt = `Summarize the following material into 5–10 crisp, non‑duplicative bullets for a working outline. 
Use plain language, one sentence per bullet, and group related points. Start with “Key points from your material”. 

Text:
---
${fullText}
---`;

    const ai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a precise, concise summarizer." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2
      })
    });

    if (!ai.ok) {
      const errTxt = await ai.text().catch(() => "");
      return json(502, { error: "OpenAI request failed", status: ai.status, details: slice(errTxt, 600) });
    }

    const payload = await ai.json();
    const summary = payload?.choices?.[0]?.message?.content?.trim() || "(No summary produced)";
    return json(200, { summary });
  } catch (err) {
    console.error("summarize error:", err);
    return json(500, { error: err?.message || "Internal Server Error" });
  }
};

// helpers
function json(code, obj) {
  return { statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}
function slice(s, n) { return s && s.length > n ? s.slice(0, n) + "…" : s; }

async function extractText({ buffer, filename, contentType }) {
  const lower = (filename || "").toLowerCase();

  if (lower.endsWith(".pdf") || contentType.includes("pdf")) {
    const data = await pdfParse(buffer);
    return data?.text || "";
  }
  if (
    lower.endsWith(".docx") ||
    contentType.includes("officedocument.wordprocessingml.document")
  ) {
    const out = await mammoth.extractRawText({ buffer });
    return out?.value || "";
  }
  if (lower.endsWith(".txt") || contentType.startsWith("text/")) {
    return buffer.toString("utf8");
  }
  // last resort: try utf8
  return buffer.toString("utf8");
}