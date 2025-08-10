import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Phase2Gather() {
  // Inputs
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState([]);            // committed notes
  const [noteDraft, setNoteDraft] = useState("");    // current textarea value

  // Output + UI state
  const [results, setResults] = useState([]);        // [{ name, bullets: [] }]
  const [combinedBullets, setCombinedBullets] = useState([]);
  const [mode, setMode] = useState("combined");      // 'combined' | 'per-file' (per-file shows the "Combined" block for now)
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  // ========== Files ==========
  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...newFiles]);
  };
  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };
  const clearFiles = () => setFiles([]);

  // ========== Notes ==========
  const addNote = () => {
    const v = noteDraft.trim();
    if (!v) return;
    setNotes((prev) => [...prev, v]);
    setNoteDraft("");
  };
  const removeNote = (idx) => {
    setNotes((prev) => prev.filter((_, i) => i !== idx));
  };
  const clearNotes = () => setNotes([]);

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

  // Send everything as JSON (no multipart)
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

      // Split into bullets, strip leading markers, and drop the model’s heading line if present
      const bullets = (data.summary || "")
        .split("\n")
        .map((s) => s.replace(/^[-•\s]+/, "").trim())
        .filter(Boolean)
        .filter((line) => !/^key points from your material[:：]?$/i.test(line));

      // Always keep combined bullets; per-file view will show a single “Combined” block (by design)
      setCombinedBullets(bullets);
      setResults([{ name: "Combined", bullets }]);
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

  const handleSaveAndGo = () => {
    const payload = {
      mode,
      combinedBullets,
      results,
      savedAt: new Date().toISOString(),
      sourceFiles: files.map((f) => ({ name: f.name, type: f.type || "", size: f.size })),
      noteCount: notes.length + (noteDraft.trim() ? 1 : 0),
    };
    localStorage.setItem("phase3_seed_summary", JSON.stringify(payload));
    navigate("/phase3");
  };

  return (
    <div className="flex h-screen bg-white">
      {/* LEFT: Inputs */}
      <div className="w-1/2 p-6 border-r overflow-y-auto">
        {/* Top bar */}
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-semibold">Phase 2 — Gather & Summarize</h2>
          <div className="ml-auto">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={handleSaveAndGo}
              disabled={combinedBullets.length === 0 && results.length === 0}
              title={combinedBullets.length === 0 && results.length === 0 ? "Run a summary first" : "Save outline and continue"}
            >
              Save Summary and Continue to Phase 3
            </button>
          </div>
        </div>

        {/* Upload */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block font-medium">Upload files:</label>
            {files.length > 0 && (
              <button className="text-sm text-gray-700 underline" onClick={clearFiles}>
                Clear files
              </button>
            )}
          </div>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            multiple
            onChange={handleFileChange}
            className="border p-2 rounded w-full"
          />
          {/* file chips */}
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {files.map((file, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-2 px-2 py-1 text-sm bg-gray-100 border rounded"
                  title={file.name}
                >
                  <span className="max-w-[14rem] truncate">{file.name}</span>
                  <button
                    className="text-gray-500 hover:text-red-600"
                    onClick={() => removeFile(idx)}
                    aria-label={`Remove ${file.name}`}
                    title="Remove"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block font-medium">Paste notes or text:</label>
            {notes.length > 0 && (
              <button className="text-sm text-gray-700 underline" onClick={clearNotes}>
                Clear notes
              </button>
            )}
          </div>

          <textarea
            placeholder="Paste raw passages, quotes, or briefing notes here. This is for source snippets only — goals, audience, and tone already come from Phase 1."
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
              <span className="text-sm text-gray-600">
                {notes.length} saved note{notes.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* saved notes list */}
          {notes.length > 0 && (
            <ul className="mt-2 text-sm text-gray-700 space-y-1">
              {notes.map((n, idx) => (
                <li key={idx} className="flex items-center justify-between border rounded p-2">
                  <span className="truncate pr-3">Note #{idx + 1}</span>
                  <button
                    className="text-gray-500 hover:text-red-600"
                    onClick={() => removeNote(idx)}
                    aria-label={`Remove note ${idx + 1}`}
                    title="Remove note"
                  >
                    ×
                  </button>
                </li>
              ))}
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

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>

      {/* RIGHT: Summary */}
      <div className="w-1/2 p-6 overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">📝 Summary</h2>

        {!isSummarizing && results.length === 0 && combinedBullets.length === 0 ? (
          <p className="text-gray-500 italic">
            No summaries yet. Upload files and/or add notes, then click <b>Summarize All</b>.
          </p>
        ) : null}

        {/* Actions */}
        {(combinedBullets.length > 0 || results.length > 0) && (
          <div className="flex gap-2 mb-3">
            <button className="px-3 py-1 text-sm border rounded" onClick={handleCopy}>
              Copy
            </button>
            <button className="px-3 py-1 text-sm border rounded" onClick={handleDownload}>
              Download .txt
            </button>
            <button
              className="px-3 py-1 text-sm border rounded"
              onClick={handleSaveAndGo}
              title="Save outline and continue to Phase 3"
            >
              Save Summary and Continue to Phase 3
            </button>
          </div>
        )}

        {/* Loading */}
        {isSummarizing && <div className="text-sm text-gray-600 mb-3">Summarizing…</div>}

        {/* Combined view */}
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

        {/* Per-file view (currently shows the one "Combined" block) */}
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