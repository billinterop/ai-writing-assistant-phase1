// /netlify/functions/summarize.js (no openai SDK, using fetch)
// Updated 2025-08-04 - force redeploy
const fetch = require("node-fetch");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { fileName, fileType, base64Content } = body;

    const buffer = Buffer.from(base64Content, "base64");
    let extractedText = "";

    if (fileType === "pdf") {
      extractedText = await pdfParse(buffer).then((data) => data.text);
    } else if (fileType === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (fileType === "txt") {
      extractedText = buffer.toString("utf-8");
    } else {
      return {
        statusCode: 400,
        body: "Unsupported file type",
      };
    }

    const prompt = `Summarize the following content into bullet points for someone writing a briefing document:\n\n"""\n${extractedText}\n"""`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that extracts key information from raw source content.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 600,
        temperature: 0.5,
      }),
    });

    const json = await openaiResponse.json();
    const summary = json.choices?.[0]?.message?.content || "No summary returned.";

    return {
      statusCode: 200,
      body: JSON.stringify({ summary }),
    };
  } catch (error) {
    console.error("Error in summarize function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || "Internal Server Error",
        stack: error.stack,
      }),
    };
  }
};
