// netlify/functions/summarize.js
// CommonJS, works on Netlify Functions

const multipart = require("aws-lambda-multipart-parser");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const fetch = require("node-fetch");

// Small helper to return JSON with proper headers
function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}
function slice(s, n) {
  return s && s.length > n ? s.slice(0, n) + "…" : s;
}

// Extract text from supported file types
async function extractText({ buffer, filename, contentType }) {
  const lower = (filename || "").toLowerCase();
  const ct = (contentType || "").toLowerCase();

  // PDF
  if (lower.endsWith(".pdf") || ct.includes("pdf")) {
    const data = await pdfParse(buffer);
    return data?.text || "";
  }

  // DOCX
  if (
    lower.endsWith(".docx") ||
    ct.includes("officedocument.wordprocessingml.document")
  ) {
    const out = await mammoth.extractRawText({ buffer });
    return out?.value || "";
  }

  // TXT (or any text/*)
  if (lower.endsWith(".txt") || ct.startsWith("text/")) {
    return buffer.toString("utf8");
  }

  // Fallback: try UTF‑8
  return buffer.toString("utf8");
}

exports.handler = async (event) => {
  try {
    // Enforce POST
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { Allow: "POST" },
        body: "Method Not Allowed",
      };
    }

    // Parse multipart/form-data (base64 decode on)
    const parsed = multipart.parse(event, true);

    // Collect files (support single or multiple, and tolerate varied field names)
    let files = [];
    if (Array.isArray(parsed.file)) {
      files = parsed.file;
    } else if (parsed.file && parsed.file.content) {
      files = [parsed.file];
    } else {
      // Fallback: any field that looks like a file (has filename + content)
      files = Object.values(parsed).filter(
        (v) => v && typeof v === "object" && v.filename && v.content
      );
    }

    // Collect notes (string fields under "note"; support multiple)
    let notes = [];
    if (parsed.note) notes = Array.isArray(parsed.note) ? parsed.note : [parsed.note];

    if ((!files || files.length === 0) && notes.length === 0) {
      return json(400, {
        error:
          "No files or notes found. Upload files under field name 'file' and/or add notes under 'note'.",
      });
    }

    // Build text chunks from files + notes
    const chunks = [];

    for (const f of files) {
      try {
        const filename = f.filename || "upload.bin";
        const contentType = f.contentType || "";
        const buffer = Buffer.isBuffer(f.content) ? f.content : Buffer.from(f.content);
        const text = await extractText({ buffer, filename, contentType });
        if (text && text.trim()) {
          chunks.push(`File: ${filename}\n${text.trim()}`);
        }
      } catch (e) {
        // If a single file fails, continue with others
        chunks.push(`File: ${f.filename || "upload.bin"}\n[Could not extract text]`);
      }
    }

    for (const n of notes) {
      if (typeof n === "string" && n.trim()) {
        chunks.push(`Note:\n${n.trim()}`);
      }
    }

    const fullText = (chunks.join("\n\n---\n\n") || "").trim();
    if (!fullText) {
      return json(400, { error: "No extractable text found in files/notes." });
    }

    // OpenAI call
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return json(500, { error: "Server is missing OPENAI_API_KEY." });
    }

    const prompt = `Summarize the following material into 5–10 crisp, non‑duplicative bullets for a working outline.
Use plain language, one sentence per bullet, and group related points. Start the output with:
"Key points from your material"
Then list the bullets.

Text:
---
${fullText}
---`;

    const ai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a precise, concise summarizer." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!ai.ok) {
      const errTxt = await ai.text().catch(() => "");
      return json(502, {
        error: "OpenAI request failed",
        status: ai.status,
        details: slice(errTxt, 800),
      });
    }

    const payload = await ai.json();
    const summary =
      payload?.choices?.[0]?.message?.content?.trim() || "(No summary produced)";
    return json(200, { summary });
  } catch (err) {
    console.error("summarize error:", err);
    return json(500, { error: err?.message || "Internal Server Error" });
  }
};