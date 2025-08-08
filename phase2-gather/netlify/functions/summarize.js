// netlify/functions/summarize.js
const multipart = require("aws-lambda-multipart-parser");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Allow": "POST" },
        body: "Method Not Allowed",
      };
    }

    // Parse multipart/form-data (Base64 decode enabled)
    const parsed = multipart.parse(event, true);

    const file = parsed.file;
    if (!file || !file.content) {
      return json(400, { error: "No file uploaded under field name 'file'." });
    }

    const filename = file.filename || "upload.bin";
    const contentType = file.contentType || "";
    const buffer = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content);

    // Extract text based on type
    const text = await extractText({ buffer, filename, contentType });

    if (!text || !text.trim()) {
      return json(400, { error: "Could not extract text from the uploaded file." });
    }

    // Call OpenAI (Chat Completions style)
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return json(500, { error: "OPENAI_API_KEY not set on server." });
    }

    const prompt = `Summarize the following content into 5–8 crisp, non-duplicative bullet points using plain language. Avoid hedging and keep each bullet to one sentence.\n\n---\n${text}\n---`;

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
        temperature: 0.3,
      }),
    });

    if (!ai.ok) {
      const errTxt = await ai.text().catch(() => "");
      return json(502, {
        error: "OpenAI request failed",
        status: ai.status,
        details: safeSlice(errTxt, 800),
      });
    }

    const payload = await ai.json();
    const summary =
      payload?.choices?.[0]?.message?.content?.trim() ||
      "• (No summary produced)";

    return json(200, { summary });
  } catch (err) {
    console.error("summarize error:", err);
    return json(500, {
      error: err?.message || "Internal Server Error",
      stack: process.env.NODE_ENV === "production" ? undefined : err?.stack,
    });
  }
};

// Helpers
function json(code, obj) {
  return {
    statusCode: code,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

function safeSlice(s, n) {
  if (!s) return s;
  return s.length > n ? s.slice(0, n) + "…" : s;
}

async function extractText({ buffer, filename, contentType }) {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".pdf") || contentType.includes("pdf")) {
    const data = await pdfParse(buffer);
    return (data && data.text) || "";
  }

  if (lower.endsWith(".docx") || contentType.includes(
    "officedocument.wordprocessingml.document"
  )) {
    const out = await mammoth.extractRawText({ buffer });
    return (out && out.value) || "";
  }

  if (lower.endsWith(".txt") || contentType.startsWith("text/")) {
    return buffer.toString("utf8");
  }

  // Fallback: try treating it as UTF-8 text
  return buffer.toString("utf8");
}