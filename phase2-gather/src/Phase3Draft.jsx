import React, { useEffect, useRef, useState } from "react";

export default function Phase3Draft() {
  const [seed, setSeed] = useState(null);
  const [draft, setDraft] = useState("");
  const draftRef = useRef(null);

  // Load saved summary on mount and auto-fill the draft once
  useEffect(() => {
    const raw = localStorage.getItem("phase3_seed_summary");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      setSeed(parsed);

      // Build a sensible default outline based on the seed
      const outline =
        parsed?.mode === "combined"
          ? [
              "Key Points Outline",
              "",
              ...(parsed.combinedBullets || []).map((b) => `• ${b}`),
            ].join("\n")
          : [
              "Per‑file Outline",
              "",
              ...(parsed.results || []).flatMap((r) => [
                `# ${r.name}`,
                ...(r.bullets || []).map((b) => `• ${b}`),
                "",
              ]),
            ].join("\n");

      setDraft(outline);
    } catch (e) {
      // ignore parse errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-focus and scroll the draft area when it first has content
  useEffect(() => {
    if (draft && draftRef.current) {
      draftRef.current.focus();
      draftRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [draft]);

  const copyOutline = () => {
    const outlineText = draft || "";
    if (!outlineText.trim()) return;
    navigator.clipboard.writeText(outlineText);
  };

  const startWithOutline = () => {
    // Already loaded into draft on first mount, but keep this for UX parity
    if (draftRef.current) {
      draftRef.current.focus();
      draftRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Phase 3 — Draft</h2>
        <a className="px-3 py-1 text-sm border rounded" href="/" title="Back to Phase 1">
          ← Back to Phase 1
        </a>
      </div>

      {seed ? (
        <div className="mb-4 text-sm text-gray-600">
          <div>Loaded summary saved: <b>{new Date(seed.savedAt).toLocaleString()}</b></div>
          <div>Files: <b>{seed.sourceFiles?.length || 0}</b>, Notes: <b>{seed.noteCount || 0}</b></div>
        </div>
      ) : (
        <div className="mb-4 text-sm text-red-600">
          No saved summary found. Go back to Phase 2 and click “Save Summary and Continue to Phase 3.”
        </div>
      )}

      {/* Draft editor */}
      <div className="mb-3 flex items-center gap-2">
        <button className="px-3 py-1 text-sm border rounded" onClick={copyOutline}>
          Copy Outline
        </button>
        <button className="px-3 py-1 text-sm border rounded" onClick={startWithOutline}>
          Start with this outline
        </button>
      </div>

      <textarea
        ref={draftRef}
        rows={18}
        className="w-full border rounded p-3"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Your draft starts here…"
      />
    </div>
  );
}