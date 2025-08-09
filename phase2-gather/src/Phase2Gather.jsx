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

  // Uploads
  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...newFiles]);
  };
  const clearFiles = () => setFiles([]);

  // Notes
  const addNote = () => {
    const v = noteDraft.trim();
    if (!v) return;
    setNotes((prev) => [...prev, v]);
    setNoteDraft("");
  };
  const clearNotes = () => setNotes([]);

  // File -> JSON (name, type, size, base64)
  const fileToJSON = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = (e) => reject(e);
      reader.onload = () => {
        const result = reader.result || "";
        const base64 = String(result).split(",")[1] || "";
        resolve({ name: file.name, type: file.type || "", size: file.size, base64 });
      };
      reader.readAsDataURL(file);
    });

  // Parse bullets from model text
  const toBullets = (text) =>
    (text || "")
      .split("\n")
      .map((s) => s.replace(/^[-•\s]+/, "").trim())
      .filter(Boolean);

  // Summarize (combined or per-file)
  const summarizeAll = async () => {
    setError("");
    setIsSummarizing(true);
    setResults([]);
    setCombinedBullets([]);

    try {
      const draft = noteDraft.trim();
      const notesPayload = [...notes, ...(draft ? [draft] : [])];

      if (files.length === 0 && notesPayload.length === 0) {
        setError("Please add at least one file or some notes.");
        return;
      }

      const filePayloads = await Promise.all(files.map(fileToJSON));

      if (mode === "combined") {
        // One request with all files + all notes
        const res = await fetch("/.netlify/functions/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: filePayloads, notes: notesPayload }),
        });

        const text = await res.text();
        let data = {};
        try { data = JSON.parse(text); } catch {}
        if (!res.ok) throw new Error(data?.error || `Summarize failed (${res.status})`);

        setCombinedBullets(toBullets(data.summary));
        setResults([]);
      } else {
        // Per-file: send each file separately; send all notes as one “Notes” item (if present)
        const per = [];

        for (let i = 0; i < filePayloads.length; i++) {
          const one = filePayloads[i];
          const res = await fetch("/.netlify/functions/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ files: [one], notes: [] }),
          });

          const text = await res.text();
          let data = {};
          try { data = JSON.parse(text); } catch {}
          if (!res.ok) throw new Error(data?.error || `Summarize failed (${res.status})`);

          per.push({ name: one.name || `File ${i + 1}`, bullets: toBullets(data.summary) });
        }

        if (notesPayload.length > 0) {
          const resNotes = await fetch("/.netlify/functions/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ files: [], notes: notesPayload }),
          });

          const textNotes = await resNotes.text();
          let dataNotes = {};
          try { dataNotes = JSON.parse(textNotes); } catch {}
          if (!resNotes.ok) throw new Error(dataNotes?.error || `Summarize failed (${resNotes.status})`);

          per.push({ name: "Notes", bullets: toBullets(dataNotes.summary) });
        }

        setResults(per);
        setCombinedBullets([]);
      }
    } catch (e) {
      console.error(e);
      setError(e.message || "Something went wrong.");
    } finally {
      setIsSummarizing(false);
    }
  };

  // Export helpers
  const buildTextForExport = () => {
    return mode === "combined"
      ? ["Key Points from Your Material", ...combinedBullets.map((b) => `• ${b}`)].join("\n")
      : results
          .map((r) => [`# ${r.name}`, ...r.bullets.map((b) => `• ${b}`)].join("\n"))
          .join("\n\n");
  };
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
  const handleInsertIntoDraft = () => {
    const payload = {
      mode,
      combinedBullets,
      results,
      savedAt: new Date().toISOString(),
      sourceFiles: files.map(f => ({ name: f.name, type: f.type, size: f.size })),
      noteCount: notes.length + (noteDraft.trim() ? 1 : 0),
    };
    localStorage.setItem("phase3_seed_summary", JSON.stringify(payload));
    alert("Saved for Phase 3.");
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Left Panel – Upload and Notes */}
      <div className="w-1/2 p-6 border-r overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">📄 Phase 2 – Gather Material</h2>

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
            <div className="mt-2">
              <ul className="text-sm text-gray-600 space-y-1">
                {files.map((file, idx) => (
                  <li key={idx} className="flex justify-between items-center border rounded px-2 py-1">
                    <span>{file.name}</span>
                    <button
                      onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 ml-2"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <button
                className="mt-2 text-xs text-gray-500 hover:underline"
                onClick={clearFiles}
              >
                Clear all files
              </button>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="block font-medium mb-1">Paste notes or text:</label>
          <p className="text-xs text-gray-500 mb-1">
            Add excerpts, observations, or background info relevant to your draft.  
            Phase 1 already captured goals, audience, and tone — here, focus on raw material.
          </p>
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
                  className="text-xs text-gray-500 hover:underline ml-2"
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
              Per-file
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
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <button className="px-3 py-1 text-sm border rounded" onClick={handleCopy}>
              Copy
            </button>
            <button className="px-3 py-1 text-sm border rounded" onClick={handleDownload}>
              Download .txt
            </button>
            <button className="px-3 py-1 text-sm border rounded" onClick={handleInsertIntoDraft}>
              Save Summary for Phase 3
            </button>
            <a
              href="https://interopsystems.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Continue to Phase 3
            </a>
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