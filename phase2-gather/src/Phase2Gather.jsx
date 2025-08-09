import React, { useState } from "react";

export default function Phase2Gather() {
  // Inputs
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState([]);            // committed notes
  const [noteDraft, setNoteDraft] = useState("");    // current textarea value

  // Output + UI state
  const [results, setResults] = useState([]);        // [{ name, bullets: [] }]
  const [combinedBullets, setCombinedBullets] = useState([]);
  const [mode, setMode] = useState("combined");      // 'combined' | 'per-file'
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState("");

  // ---------- UI helpers ----------
  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFileAt = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearFiles = () => setFiles([]);
  const clearNotes = () => setNotes([]);

  const addNote = () => {
    const v = noteDraft.trim();
    if (!v) return;
    setNotes((prev) => [...prev, v]);
    setNoteDraft("");
  };

  // ---------- Utilities ----------
  // Read a File -> JSON blob suitable for the server JSON API
  const fileToJSON = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = (e) => reject(e);
      reader.onload = () => {
        const result = reader.result || "";
        const base64 = String(result).split(",")[1] || "";
        resolve({ name: file.name, type: file.type || "", base64 });
      };
      reader.readAsDataURL(file);
    });

  // Normalize model text -> array of bullets and strip the heading line if present
  const toBullets = (text) => {
    const lines = (text || "").split("\n").map((s) => s.replace(/^[-•\s]+/, "").trim());
    const cleaned = lines.filter(Boolean);
    if (cleaned.length && /^key points from your material[:]?$/i.test(cleaned[0])) {
      cleaned.shift(); // drop the heading line
    }
    return cleaned;
  };

  // Call JSON endpoint with { files, notes } and return bullets[]
  async function summarizeJSON({ filesJson = [], notesArr = [] }) {
    const res = await fetch("/.netlify/functions/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: filesJson, notes: notesArr }),
    });

    const raw = await res.text();
    let data = {};
    try { data = JSON.parse(raw); } catch { /* ignore */ }

    if (!res.ok) {
      throw new Error(data?.error || `Summarize failed (${res.status})`);
    }
    return toBullets(data.summary || "");
  }

  // ---------- Main action ----------
  const summarizeAll = async () => {
    setError("");
    setIsSummarizing(true);
    setResults([]);
    setCombinedBullets([]);

    try {
      const draft = noteDraft.trim();
      const hasAny = files.length > 0 || notes.length > 0 || !!draft;
      if (!hasAny) {
        setError("Please add at least one file or some notes.");
        return;
      }

      // Build payloads
      const filesJson = await Promise.all(files.map(fileToJSON));
      const notesArr = draft ? [...notes, draft] : [...notes];

      if (mode === "combined") {
        // One request with everything
        const bullets = await summarizeJSON({ filesJson, notesArr });
        setCombinedBullets(bullets);
        setResults([]);
      } else {
        // Per-file: loop and send one request per item to the SAME JSON endpoint
        // Files first
        const perItem = [];
        for (const f of filesJson) {
          const bullets = await summarizeJSON({ filesJson: [f], notesArr: [] });
          perItem.push({ name: f.name || "file", bullets });
        }
        // Notes as individual items
        for (let i = 0; i < notesArr.length; i++) {
          const n = notesArr[i];
          const bullets = await summarizeJSON({ filesJson: [], notesArr: [n] });
          perItem.push({ name: `Note ${i + 1}`, bullets });
        }
        setResults(perItem);
        setCombinedBullets([]);
      }
    } catch (e) {
      console.error(e);
      setError(e.message || "Something went wrong.");
    } finally {
      setIsSummarizing(false);
    }
  };

  // ---------- Export helpers ----------
  const buildTextForExport = () => {
    if (mode === "combined") {
      // Heading line + bullets (no bullet for the heading)
      return `Key Points from Your Material\n${combinedBullets.map((b) => `• ${b}`).join("\n")}`;
    }
    return results
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
    sourceFiles: files.map(f => ({
      name: f.name,
      type: f.type || "unknown",
      size: f.size || 0
    })),
    noteCount: notes.length
  };
  localStorage.setItem("phase3_seed_summary", JSON.stringify(payload));
  alert("Saved for Phase 3.");
};

  // ---------- UI ----------
  return (
    <div className="flex h-screen bg-white">
      {/* Left Panel – Upload and Notes */}
      <div className="w-1/2 p-6 border-r overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">📥 Add Your Material</h2>

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
          {files.length > 0 && (
            <>
              <ul className="mt-2 text-sm text-gray-700 space-y-2">
                {files.map((file, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between border rounded px-2 py-1"
                  >
                    <span className="truncate">{file.name}</span>
                    <button
                      className="ml-3 text-xs px-2 py-0.5 rounded bg-gray-200 hover:bg-gray-300"
                      onClick={() => removeFileAt(idx)}
                      title="Remove file"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <button
                className="mt-2 text-xs px-2 py-1 border rounded"
                onClick={clearFiles}
              >
                Clear files
              </button>
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
              <>
                <span className="text-sm text-gray-600">
                  {notes.length} saved note{notes.length > 1 ? "s" : ""}
                </span>
                <button
                  className="ml-auto text-xs px-2 py-1 border rounded"
                  onClick={clearNotes}
                >
                  Clear notes
                </button>
              </>
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
        <h2 className="text-xl font-semibold mb-4">📝 Summary</h2>

        {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

        {!isSummarizing && results.length === 0 && combinedBullets.length === 0 ? (
          <p className="text-gray-500 italic">
            No summaries yet. Upload files and/or add notes, then click <b>Summarize All</b>.
          </p>
        ) : null}

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

        {/* Per-file view */}
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