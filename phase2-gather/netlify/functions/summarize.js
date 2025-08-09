// netlify/functions/summarize.js
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: { Allow: "POST" }, body: "Method Not Allowed" };
    }

    // Expect JSON: { files: [{ name, type, base64 }], notes: [string] }
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (e) {
      return json(400, { error: "Invalid JSON body." });
    }

    const files = Array.isArray(body.files) ? body.files : [];
    const notes = Array.isArray(body.notes) ? body.notes : [];

    if (files.length === 0 && notes.length === 0) {
      return json(400, { error: "No files or notes supplied." });
    }

    // Extract text from files + notes
    const chunks = [];

    for (const f of files) {
      const name = (f && f.name) || "upload.bin";
      const type = (f && f.type) || "";
      const b64 = (f && f.base64) || "";
      if (!b64) continue;

      const buffer = Buffer.from(b64, "base64");
      const text = await extractText({ buffer, filename: name, contentType: type });
      if (text && text.trim()) {
        chunks.push(`File: ${name}\n${text.trim()}`);
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
  const type = (contentType || "").toLowerCase();

  if (lower.endsWith(".pdf") || type.includes("pdf")) {
    const data = await pdfParse(buffer);
    return data?.text || "";
  }
  if (
    lower.endsWith(".docx") ||
    type.includes("officedocument.wordprocessingml.document")
  ) {
    const out = await mammoth.extractRawText({ buffer });
    return out?.value || "";
  }
  if (lower.endsWith(".txt") || type.startsWith("text/")) {
    return buffer.toString("utf8");
  }
  // last resort
  return buffer.toString("utf8");
}