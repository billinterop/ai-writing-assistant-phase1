// src/Phase2Gather.jsx
import React, { useState } from "react";

export default function Phase2Gather() {
  // Inputs
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState([]); // array of strings

  // Output + UI state
  const [summaryText, setSummaryText] = useState(""); // raw text from server
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("combined"); // reserved for future per-file view

  // ------------ File handlers ------------
  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length) setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearAll = () => {
    setFiles([]);
    setNotes([]);
    setSummaryText("");
    setError("");
  };

  // ------------ Notes handlers ------------
  const [noteDraft, setNoteDraft] = useState("");
  const addNote = () => {
    const val = noteDraft.trim();
    if (!val) return;
    setNotes((prev) => [...prev, val]);
    setNoteDraft("");
  };
  const removeNote = (idx) => {
    setNotes((prev) => prev.filter((_, i) => i !== idx));
  };

  // ------------ Summarize All (multipart) ------------
  const summarizeAll = async () => {
    setError("");
    setSummaryText("");
    setIsSummarizing(true);

    try {
      const form = new FormData();

      // Append each file under field name "file"
      files.forEach((f) => form.append("file", f));

      // Append each note under field name "note"
      notes.forEach((n) => {
        if (typeof n === "string" && n.trim()) form.append("note", n.trim());
      });

      // Quick guard to help users
      if (files.length === 0 && notes.length === 0) {
        setIsSummarizing(false);
        setError("Please add at least one file or a note before summarizing.");
        return;
      }

      const res = await fetch("/.netlify/functions/summarize", {
        method: "POST",
        body: form, // DO NOT set Content-Type; the browser sets boundary
      });

      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        // If the function returns non-JSON, show the raw text for debugging
        if (!res.ok) throw new Error(text || `Summarize failed (${res.status})`);
        data = { summary: text };
      }

      if (!res.ok) {
        throw new Error(data?.error || `Summarize failed (${res.status})`);
      }

      setSummaryText(data.summary || "(No summary)");
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setIsSummarizing(false);
    }
  };

  // ------------ Helpers: copy / download / insert ------------
  const buildExportText = () => {
    return summaryText || "";
  };

  const handleCopy = () => {
    const t = buildExportText();
    if (!t) return;
    navigator.clipboard.writeText(t);
  };

  const handleDownload = () => {
    const t = buildExportText();
    if (!t) return;
    const blob = new Blob([t], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "summary.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleInsertIntoDraft = () => {
    const payload = {
      mode,
      summaryText,
      files: files.map((f) => f.name),
      notes,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem("phase3_seed_summary", JSON.stringify(payload));
    alert("Saved for Phase 3.");
  };

  // ------------ Render ------------
  return (
    <div className="flex h-screen bg-white">
      {/* Left Panel – Upload and Notes */}
      <div className="w-1/2 p-6 border-r overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">📥 Add Your Material</h2>

        {/* Upload */}
        <div className="mb-6">
          <label className="block font-medium mb-2">Upload files (.pdf, .docx, .txt):</label>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            multiple
            onChange={handleFileChange}
            className="border p-2 rounded w-full"
          />

          {/* File chips */}
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {files.map((file, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-2 px-2 py-1 rounded-full border text-sm"
                >
                  <span className="truncate max-w-[220px]">{file.name}</span>
                  <button
                    className="text-gray-600 hover:text-red-600"
                    onClick={() => removeFile(idx)}
                    title="Remove"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="block font-medium mb-2">Paste notes or text:</label>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Paste copied text or write here…"
            rows={5}
            className="border p-2 rounded w-full"
          />
          <div className="mt-2 flex gap-2">
            <button
              className="px-3 py-1 text-sm border rounded"
              onClick={addNote}
              disabled={!noteDraft.trim()}
            >
              Add note
            </button>
            <button className="px-3 py-1 text-sm border rounded" onClick={clearAll}>
              Clear all
            </button>
          </div>

          {/* Note list */}
          {notes.length > 0 && (
            <ul className="mt-3 space-y-2">
              {notes.map((n, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-1 text-gray-500">•</span>
                  <div className="flex-1 text-sm text-gray-700 whitespace-pre-wrap">{n}</div>
                  <button
                    className="text-xs text-gray-600 hover:text-red-600"
                    onClick={() => removeNote(idx)}
                    title="Remove note"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* (Optional) View mode reserved for later */}
        <div className="mt-2 hidden">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="viewmode"
              value="combined"
              checked={mode === "combined"}
              onChange={() => setMode("combined")}
            />
            Combined
          </label>
        </div>

        <div className="mt-4">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            onClick={summarizeAll}
            disabled={isSummarizing}
          >
            {isSummarizing ? "Summarizing…" : "Summarize All"}
          </button>
        </div>
      </div>

      {/* Right Panel – Summary */}
      <div className="w-1/2 p-6 overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">📝 Summary</h2>

        {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

        {!isSummarizing && !summaryText ? (
          <p className="text-gray-500 italic">
            No summaries yet. Upload files and/or add notes, then click <b>Summarize All</b>.
          </p>
        ) : null}

        {/* Actions */}
        {summaryText && (
          <div className="flex gap-2 mb-3">
            <button className="px-3 py-1 text-sm border rounded" onClick={handleCopy}>
              Copy
            </button>
            <button className="px-3 py-1 text-sm border rounded" onClick={handleDownload}>
              Download .txt
            </button>
            <button className="px-3 py-1 text-sm border rounded" onClick={handleInsertIntoDraft}>
              Insert into Draft
            </button>
          </div>
        )}

        {/* Loading */}
        {isSummarizing && <div className="text-sm text-gray-600 mb-3">Summarizing…</div>}

        {/* Summary content */}
        {summaryText && (
          <div className="bg-gray-50 border rounded p-4 whitespace-pre-wrap text-sm">
            {summaryText}
          </div>
        )}
      </div>
    </div>
  );
}