import React, { useState } from "react";

export default function Phase2Gather() {
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState([]);
  const [summaries, setSummaries] = useState([]);

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    setFiles([...files, ...newFiles]);
  };
const handleSummarizeFile = async (file) => {
  const reader = new FileReader();
  reader.onload = async () => {
    const base64Content = reader.result.split(",")[1];

    const fileType = file.name.endsWith(".pdf")
      ? "pdf"
      : file.name.endsWith(".docx")
      ? "docx"
      : file.name.endsWith(".txt")
      ? "txt"
      : null;

    if (!fileType) {
      alert("Unsupported file type");
      return;
    }

    const response = await fetch("/.netlify/functions/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        fileType,
        base64Content,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      setSummaries((prev) => [...prev, data.summary]);
    } else {
      alert("Error: " + data.error);
    }
  };

  reader.readAsDataURL(file);
};
  return (
    <div className="flex h-screen bg-white">
      {/* Left Panel – Upload and Notes */}
      <div className="w-1/2 p-6 border-r overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">📥 Add Your Material</h2>

        <div className="mb-6">
          <label className="block font-medium mb-2">Upload files:</label>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            multiple
            onChange={handleFileChange}
            className="border p-2 rounded w-full"
          />
         <ul className="mt-2 text-sm text-gray-600 space-y-2">
  {files.map((file, idx) => (
    <li key={idx} className="flex items-center justify-between border rounded p-2">
      <span>{file.name}</span>
      <button
        className="ml-4 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        onClick={() => handleSummarizeFile(file)}
      >
        Summarize
      </button>
    </li>
  ))}
</ul>
        </div>

        <div className="mb-6">
          <label className="block font-medium mb-2">Paste notes or text:</label>
          <textarea
            placeholder="Paste copied text or write here..."
            rows={6}
            className="border p-2 rounded w-full"
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (value) {
                setNotes([...notes, value]);
                e.target.value = "";
              }
            }}
          />
          <ul className="mt-2 text-sm text-gray-600 list-disc pl-5">
            {notes.map((note, idx) => (
              <li key={idx}>Note #{idx + 1}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right Panel – Summaries */}
      <div className="w-1/2 p-6 overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">📝 Summarized Content</h2>
        {summaries.length === 0 ? (
          <p className="text-gray-500 italic">
            No summaries yet. Upload a file or add notes to begin.
          </p>
        ) : (
          summaries.map((s, idx) => (
            <div key={idx} className="bg-gray-50 border p-4 mb-4 rounded shadow-sm">
              <h3 className="font-medium mb-2">Summary #{idx + 1}</h3>
              <pre className="text-sm whitespace-pre-wrap">{s}</pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
