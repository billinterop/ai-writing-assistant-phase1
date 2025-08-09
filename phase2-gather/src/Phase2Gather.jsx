import React, { useState } from "react";

export default function Phase2Gather() {
  // Inputs
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState([]);            // committed notes
  const [noteDraft, setNoteDraft] = useState("");    // current textarea value
  const [fileInputKey, setFileInputKey] = useState(0); // helps reset <input type="file" />

  // Output + UI state
  const [results, setResults] = useState([]);        // [{ name, bullets: [] }]
  const [combinedBullets, setCombinedBullets] = useState([]);
  const [mode, setMode] = useState("combined");      // 'combined' | 'per-file' (combined result labeled)
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setFiles([]);
    // reset the file input so selecting the same file again will trigger onChange
    setFileInputKey((k) => k + 1);
  };

  const addNote = () => {
    const v = noteDraft.trim();
    if (!v) return;
    setNotes((prev) => [...prev, v]);
    setNoteDraft("");
  };

  const removeNote = (index) => {
    setNotes((prev) => prev.filter((_, i) => i !== index));
  };

  const clearNotes = () => {
    setNotes([]);
    setNoteDraft("");
  };

  // Helper: read a File -> { name, type, base64 }
  const fileToJSON = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = (e) => reject(e);
      reader.onload = () => {
        const result = reader.result || "";
        // result is data:...;base64,XXXX
        const base64 = String(result).split(",")[1] || "";
        resolve({ name: file.name, type: file.type || "", base64 });
      };
      reader.readAsDataURL(file);
    });

  // Send everything as JSON (no multipart) — unchanged behavior
  const summarizeAll = async () => {
    setError("");
    setIsSummarizing(true);
    setResults([]);
    setCombinedBullets([]);

    try {
      const draft = noteDraft.trim();
      if (files.length === 0 && notes.length === 0 && !draft) {
        setError("Please add at least one file or some notes.");
        setIsSummarizing(false);
        return;
      }

      const filePayload = await Promise.all(files.map(fileToJSON));
      const notesPayload = [...notes];
      if (draft) notesPayload.push(draft);

      const res = await fetch("/.netlify/functions/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: filePayload, notes: notesPayload }),
      });

      const text = await res.text();
      let data = {};
      try { data = JSON.parse(text); } catch {}

      if (!res.ok) {
        throw new Error(data?.error || `Summarize failed (${res.status})`);
      }

      const bullets = (data.summary || "")
        .split("\n")
        .map((s) => s.replace(/^[-•\s]+/, "").trim())
        .filter(Boolean);

      if (mode === "combined") {
        setCombinedBullets(bullets);
        setResults([]);
      } else {
        // keep per-file UI pathway by labeling as a single “Combined” item (matches your current server contract)
        setResults([{ name: "Combined", bullets }]);
        setCombinedBullets([]);
      }
    } catch (e) {
      console.error(e);
      setError(e.message || "Something went wrong.");
    } finally {
      setIsSummarizing(false);
    }
  };

  // Helpers for actions
  const buildTextForExport = () => {
    return mode === "combined"
      ? ["Key Points from Your Material:", ...combinedBullets.map((b) => `• ${b}`)].join("\n")
      : results
          .map((r) => [`# ${r.name}`, ...r.bullets.map((b) => `• ${b}`)].join("\n"))
          .join("\n\n");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(buildTextForExport());
  };

  const handleDownload = () => {
    const blob = new Blob([buildTextForExport()], { type: "text/plain" });
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
      combinedBullets,
      results,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem("phase3_seed_summary", JSON.stringify(payload));
    alert("Saved for Phase 3.");
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Left Panel – Upload and Notes */}
      <div className="w-1/2 p-6 border-r overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">📥 Add Your Material</h2>

        {/* Upload */}
        <div className="mb-6">
          <label className="block font-medium mb-2">Upload files:</label>
          <input
            key={fileInputKey}
            type="file"
            accept=".pdf,.docx,.txt"
            multiple
            onChange={handleFileChange}
            className="border p-2 rounded w-full"
          />

          {/* File list with remove chips */}
          {files.length > 0 && (
            <>
              <ul className="mt-2 text-sm text-gray-800 space-y-2">
                {files.map((file, idx) => (
                  <li
                    key={idx}
                    className="border rounded px-3 py-2 flex items-center justify-between"
                  >
                    <span className="truncate pr-3">{file.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      className="ml-3 inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100"
                      onClick={() => removeFile(idx)}
                      title="Remove file"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-2">
                <button
                  type="button"
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                  onClick={clearFiles}
                >
                  Clear files
                </button>
              </div>
            </>
          )}
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="block font-medium mb-2">Paste notes or text:</label>
          <textarea
            placeholder="Paste copied text or write here..."
            rows={6}
            className="border p-2 rounded w-full"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              className="px-3 py-1 text-sm border rounded"
              onClick={addNote}
              disabled={!noteDraft.trim()}
            >
              Add note
            </button>

            {notes.length > 0 && (
              <button
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                onClick={clearNotes}
                type="button"
              >
                Clear notes
              </button>
            )}

            {notes.length > 0 && (
              <span className="text-sm text-gray-600">
                {notes.length} saved note{notes.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Notes list with remove chips */}
          {notes.length > 0 && (
            <ul className="mt-2 text-sm text-gray-800 space-y-2">
              {notes.map((note, idx) => {
                const preview = note.length > 80 ? note.slice(0, 80) + "…" : note;
                return (
                  <li
                    key={idx}
                    className="border rounded px-3 py-2 flex items-center justify-between"
                    title={note}
                  >
                    <span className="truncate pr-3">{preview}</span>
                    <button
                      type="button"
                      aria-label={`Remove note ${idx + 1}`}
                      className="ml-3 inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100"
                      onClick={() => removeNote(idx)}
                      title="Remove note"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* View toggle + Summarize */}
        <div className="mt-6 flex items-center gap-4">
          <div className="flex items-center gap-4">
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
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="viewmode"
                value="per-file"
                checked={mode === "per-file"}
                onChange={() => setMode("per-file")}
              />
              Per‑file
            </label>
          </div>

          <button
            className="ml-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
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

        {!isSummarizing &&
          results.length === 0 &&
          combinedBullets.length === 0 && (
            <p className="text-gray-500 italic">
              No summaries yet. Upload files and/or add notes, then click <b>Summarize All</b>.
            </p>
          )}

        {(combinedBullets.length > 0 || results.length > 0) && (
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

        {isSummarizing && <div className="text-sm text-gray-600 mb-3">Summarizing…</div>}

        {!isSummarizing && mode === "combined" && combinedBullets.length > 0 && (
          <div className="bg-gray-50 border rounded p-4">
            <h4 className="font-medium mb-2">Key Points from Your Material</h4>
            <ul className="list-disc pl-5 space-y-1">
              {combinedBullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        )}

        {!isSummarizing && mode === "per-file" && results.length > 0 && (
          <div className="space-y-4">
            {results.map((r, idx) => (
              <div key={idx} className="bg-gray-50 border rounded p-4">
                <h4 className="font-medium mb-2">{r.name}</h4>
                <ul className="list-disc pl-5 space-y-1">
                  {r.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}