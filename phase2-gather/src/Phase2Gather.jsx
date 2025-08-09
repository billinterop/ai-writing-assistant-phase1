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

  // ===== Inputs =====
  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...newFiles]);
  };
  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));
  const clearFiles = () => setFiles([]);

  const addNote = () => {
    const v = noteDraft.trim();
    if (!v) return;
    setNotes((prev) => [...prev, v]);
    setNoteDraft("");
  };
  const removeNote = (idx) => setNotes((prev) => prev.filter((_, i) => i !== idx));
  const clearNotes = () => setNotes([]);

  // File -> { name, type, base64 }
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

  // POST JSON to Netlify function and return bullet array
  async function postSummaryJSON(body) {
    const res = await fetch("/.netlify/functions/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch {}
    if (!res.ok) {
      throw new Error(data?.error || `Summarize failed (${res.status})`);
    }
    return (data.summary || "")
      .split("\n")
      .map((s) => s.replace(/^[-•\s]+/, "").trim())
      .filter(Boolean);
  }

  // ===== Summarize (JSON) =====
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

      const notesPayload = [...notes];
      if (draft) notesPayload.push(draft);

      if (mode === "combined") {
        // one request with all files + all notes
        const filePayload = await Promise.all(files.map(fileToJSON));
        const bullets = await postSummaryJSON({ files: filePayload, notes: notesPayload });
        setCombinedBullets(bullets);
        setResults([]);
      } else {
        // per-file: one request per file, plus one for notes (if any)
        const items = [];

        for (const f of files) {
          const one = await fileToJSON(f);
          items.push({ label: f.name || "upload.bin", body: { files: [one], notes: [] } });
        }

        if (notesPayload.length > 0) {
          items.push({ label: "Notes", body: { files: [], notes: notesPayload } });
        }

        const perFileResults = [];
        for (const it of items) {
          const bullets = await postSummaryJSON(it.body);
          perFileResults.push({ name: it.label, bullets });
        }
        setResults(perFileResults);
        setCombinedBullets([]);
      }
    } catch (e) {
      console.error(e);
      setError(e.message || "Something went wrong.");
    } finally {
      setIsSummarizing(false);
    }
  };

  // ===== Save for Phase 3 =====
  const handleInsertIntoDraft = () => {
    const payload = {
      mode,
      combinedBullets,
      results,
      savedAt: new Date().toISOString(),
      sourceFiles: files.map((f) => ({
        name: f.name || "upload.bin",
        type: f.type || "",
        size: typeof f.size === "number" ? f.size : undefined,
      })),
      noteCount: notes.length,
    };
    localStorage.setItem("phase3_seed_summary", JSON.stringify(payload));
    alert("Saved for Phase 3.");
  };

  // ===== Export helpers =====
  const buildTextForExport = () =>
    mode === "combined"
      ? ["Key Points from Your Material:", ...combinedBullets.map((b) => `• ${b}`)].join("\n")
      : results
          .map((r) => [`# ${r.name}`, ...r.bullets.map((b) => `• ${b}`)].join("\n"))
          .join("\n\n");

  const handleCopy = () => navigator.clipboard.writeText(buildTextForExport());

  const handleDownload = () => {
    const blob = new Blob([buildTextForExport()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "summary.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Left Panel – Upload and Notes */}
      <div className="w-1/2 p-6 border-r overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Phase 2: Gather Material</h2>
        </div>

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
            <div className="mt-2 flex flex-wrap gap-2">
              {files.map((file, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-2 border rounded-full px-3 py-1 text-sm"
                >
                  {file.name}
                  <button
                    type="button"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => removeFile(idx)}
                    aria-label={`Remove ${file.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="text-sm text-gray-600 underline"
                onClick={clearFiles}
              >
                Clear files
              </button>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="block font-medium mb-2">Add notes:</label>
          <textarea
            placeholder="Write or paste excerpts, rough notes, quotes, or key stats you want to bring into this piece. (Your goals, audience, and tone from Phase 1 are already carried forward.)"
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
            {notes.length > 0 && (
              <button
                type="button"
                className="ml-auto text-sm text-gray-600 underline"
                onClick={clearNotes}
              >
                Clear notes
              </button>
            )}
          </div>
          {notes.length > 0 && (
            <ul className="mt-2 text-sm text-gray-600 list-disc pl-5 space-y-1">
              {notes.map((n, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="flex-1">{`Note #${idx + 1}`}</span>
                  <button
                    type="button"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => removeNote(idx)}
                    aria-label={`Remove note ${idx + 1}`}
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
      </div>

      {/* Right Panel – Summary */}
      <div className="w-1/2 p-6 overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">📝 Summary</h2>

        {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

        {/* Top action bar (only when content exists) */}
        {(combinedBullets.length > 0 || results.length > 0) && (
          <div className="flex gap-2 mb-3">
            <button className="px-3 py-1 text-sm border rounded" onClick={handleCopy}>
              Copy
            </button>
            <button className="px-3 py-1 text-sm border rounded" onClick={handleDownload}>
              Download .txt
            </button>
            <button className="px-3 py-1 text-sm border rounded" onClick={handleInsertIntoDraft}>
              Save Summary for Phase 3
            </button>
          </div>
        )}

        {!isSummarizing && results.length === 0 && combinedBullets.length === 0 ? (
          <p className="text-gray-500 italic">
            No summaries yet. Upload files and/or add notes, then click <b>Summarize All</b>.
          </p>
        ) : null}

        {isSummarizing && <div className="text-sm text-gray-600 mb-3">Summarizing…</div>}

        {/* Combined view */}
        {!isSummarizing && mode === "combined" && combinedBullets.length > 0 && (
          <div className="bg-gray-50 border rounded p-4 mb-24">
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
          <div className="space-y-4 mb-24">
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

        {/* Sticky bottom: Continue only (auto-saves first) */}
        {(combinedBullets.length > 0 || results.length > 0) && (
          <div className="sticky bottom-0 bg-white border-t pt-3 flex">
            <button
              className="ml-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => {
                handleInsertIntoDraft(); // auto-save first
                window.location.href = "https://interopsystems.com";
              }}
            >
              Save Summary and Continue to Phase 3
            </button>
          </div>
        )}
      </div>
    </div>
  );
}