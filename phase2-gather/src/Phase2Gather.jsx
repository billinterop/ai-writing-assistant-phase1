import React, { useState } from "react";

export default function Phase2Gather() {
  // Inputs
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState([]);            // committed notes
  const [noteDraft, setNoteDraft] = useState("");    // current textarea value

  // Output + UI state
  const [results, setResults] = useState([]);        // [{ name, bullets: [] }]
  const [combinedBullets, setCombinedBullets] = useState([]);
  const [mode, setMode] = useState("combined");      // 'combined' | 'per-file' (combined result labeled)
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState("");

  // Phase label / top nav
  const PhaseHeader = () => (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-semibold">Phase 2 — Gather</h2>
      <a
        className="px-3 py-1 text-sm border rounded"
        href="/"
        title="Back to Phase 1"
      >
        ← Back to Phase 1
      </a>
    </div>
  );

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFileAt = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearFiles = () => setFiles([]);

  const addNote = () => {
    const v = noteDraft.trim();
    if (!v) return;
    setNotes((prev) => [...prev, v]);
    setNoteDraft("");
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

      const bullets = (data.summary || "")
        .split("\n")
        // strip typical bullets/dashes
        .map((s) => s.replace(/^[-•\s]+/, "").trim())
        // remove that optional model header if it comes back as a bullet
        .filter((line) => line && !/^key points from your material:?$/i.test(line));

      if (mode === "combined") {
        setCombinedBullets(bullets);
        setResults([]);
      } else {
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

  const saveForPhase3 = () => {
    const payload = {
      mode,
      combinedBullets,
      results,
      savedAt: new Date().toISOString(),
      sourceFiles: files.map((f) => ({ name: f.name, type: f.type || "", size: f.size || 0 })),
      noteCount: notes.length,
    };
    localStorage.setItem("phase3_seed_summary", JSON.stringify(payload));
  };

  const handleSaveAndGo = () => {
    saveForPhase3();
    // no router, just direct navigation (adjust path later if needed)
    window.location.href = "/phase3";
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Left Panel – Upload and Notes */}
      <div className="w-1/2 p-6 border-r overflow-y-auto">
        <PhaseHeader />

        <h3 className="text-lg font-semibold mb-4">📥 Add Your Material</h3>

        {/* Upload */}
        <div className="mb-6">
          <label className="block font-medium mb-2">Upload files:</label>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            multiple
            onChange={handleFileChange}
            className="border p-2 rounded w-full"
          />

          {/* file chips with remove */}
          {files.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {files.map((file, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-2 px-2 py-1 text-sm border rounded bg-gray-50"
                >
                  {file.name}
                  <button
                    className="text-red-600 hover:underline"
                    onClick={() => removeFileAt(idx)}
                    aria-label={`Remove ${file.name}`}
                    title="Remove"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="mt-2">
            <button
              className="px-3 py-1 text-sm border rounded"
              onClick={clearFiles}
              disabled={files.length === 0}
              title="Clear all uploaded files"
            >
              Clear files
            </button>
          </div>
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="block font-medium mb-2">Paste notes or text:</label>
          <textarea
            placeholder="Paste raw excerpts, quotes, or your own notes here — e.g., passages you want to keep, stats to check, or fragments you plan to stitch together. (Phase 1 already captured goals, audience, voice, and tone.)"
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
            <button
              className="px-3 py-1 text-sm border rounded"
              onClick={clearNotes}
              disabled={notes.length === 0 && !noteDraft.trim()}
            >
              Clear notes
            </button>
            {notes.length > 0 && (
              <span className="text-sm text-gray-600">
                {notes.length} saved note{notes.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {notes.length > 0 && (
            <ul className="mt-2 text-sm text-gray-600 list-disc pl-5">
              {notes.map((_, idx) => (
                <li key={idx}>Note #{idx + 1}</li>
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
      </div>

      {/* Right Panel – Summary */}
      <div className="w-1/2 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">📝 Summary</h2>

          {/* Top-right actions (stick to summary panel) */}
          {(combinedBullets.length > 0 || results.length > 0) && (
            <div className="flex gap-2">
              <button className="px-3 py-1 text-sm border rounded" onClick={handleCopy}>
                Copy
              </button>
              <button className="px-3 py-1 text-sm border rounded" onClick={handleDownload}>
                Download .txt
              </button>
              <button
                className="px-3 py-1 text-sm border rounded"
                onClick={handleSaveAndGo}
                title="Save summary and continue"
              >
                Save Summary and Continue to Phase 3
              </button>
            </div>
          )}
        </div>

        {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

        {!isSummarizing && results.length === 0 && combinedBullets.length === 0 ? (
          <p className="text-gray-500 italic">
            No summaries yet. Upload files and/or add notes, then click <b>Summarize All</b>.
          </p>
        ) : null}

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