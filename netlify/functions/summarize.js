// /netlify/functions/summarize.js – uses built-in https instead of node-fetch

const https = require("https");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function callOpenAI(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that extracts key information from raw source content."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 600,
      temperature: 0.5
    });

    const options = {
      hostname: "api.openai.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Length": Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => responseData += chunk);
      res.on("end", () => {
        try {
          const result = JSON.parse(responseData);
          const summary = result.choices?.[0]?.message?.content || "No summary returned.";
          resolve(summary);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", (e) => reject(e));
    req.write(data);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
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
        body: "Unsupported file type"
      };
    }

    const prompt = `Summarize the following content into bullet points for someone writing a briefing document:\n\n"""\n${extractedText}\n"""`;
    const summary = await callOpenAI(prompt);

    return {
      statusCode: 200,
      body: JSON.stringify({ summary })
    };
  } catch (error) {
    console.error("Error in summarize function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || "Internal Server Error",
        stack: error.stack
      })
    };
  }
};
