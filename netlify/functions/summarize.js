// /netlify/functions/summarize.js

const { Configuration, OpenAIApi } = require("openai");
const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
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
      return { statusCode: 400, body: "Unsupported file type" };
    }

    const prompt = `Summarize the following content into bullet points for someone writing a briefing document:\n\n"""\n${extractedText}\n"""`;

    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful assistant that extracts key information from raw source content." },
        { role: "user", content: prompt }
      ],
      max_tokens: 600,
      temperature: 0.5
    });

    const summary = completion.data.choices[0].message.content;

    return {
      statusCode: 200,
      body: JSON.stringify({ summary })
    };

  } catch (error) {
    console.error("Error in summarize function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};
