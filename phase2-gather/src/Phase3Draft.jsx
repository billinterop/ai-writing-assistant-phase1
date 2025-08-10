import React, { useEffect, useState } from "react";

export default function Phase3Draft() {
  const [seed, setSeed] = useState(null);
  const [draft, setDraft] = useState("");

  // Load saved summary on mount and auto-fill the draft once
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const raw = localStorage.getItem("phase3_seed_summary");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      setSeed(parsed);

      // If we have combined bullets, prefill the draft automatically
      if (parsed?.combinedBullets?.length) {
        const text = parsed.combinedBullets.map((b) => `• ${b}`).join("\n");
        setDraft(text);

        // Smooth scroll to the draft textarea so the user lands where they type
        setTimeout(() => {
          const el = document.getElementById("draftTextArea");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
      }
    } catch {
      // ignore parse errors silently
    }
  }, []);

  const applyOutline = () => {
    if (!seed?.combinedBullets?.length) return;
    const text = seed.combinedBullets.map((b) => `• ${b}`).join("\n");
    setDraft(text);

    // bring the text area into view when applying
    const el = document.getElementById("draftTextArea");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Phase 3: Draft</h1>
          <a
            href="/"
            className="text-sm text-blue-600 hover:underline"
            title="Back to Phase 2"
          >
            ← Back to Phase 2
          </a>
        </div>

        {/* Seed summary context */}
        {seed ? (
          <div className="mb-6 bg-gray-50 border rounded p-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
              <span>
                <span className="font-medium">Mode:</span> {seed.mode || "combined"}
              </span>
              {Array.isArray(seed.sourceFiles) && (
                <span>
                  <span className="font-medium">Files:</span> {seed.sourceFiles.length}
                </span>
              )}
              {typeof seed.noteCount === "number" && (
                <span>
                  <span className="font-medium">Notes:</span> {seed.noteCount}
                </span>
              )}
              {seed.savedAt && (
                <span className="text-gray-500">
                  Saved {new Date(seed.savedAt).toLocaleString()}
                </span>
              )}
            </div>

            {/* Outline preview */}
            {Array.isArray(seed.combinedBullets) && seed.combinedBullets.length > 0 && (
              <div className="mt-4">
                <h2 className="font-medium mb-2">Key Points from Your Material</h2>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {seed.combinedBullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>

                <div className="mt-3">
                  <button
                    type="button"
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                    onClick={applyOutline}
                    title="Insert the outline bullets into the draft editor"
                  >
                    Start with this outline
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-6 text-sm text-gray-600">
            No saved summary found. Go back to Phase 2 to create one.
          </div>
        )}

        {/* Draft editor */}
        <div>
          <label htmlFor="draftTextArea" className="block font-medium mb-2">
            Draft
          </label>
          <textarea
            id="draftTextArea"
            rows={14}
            className="w-full border rounded p-3 font-mono text-sm"
            placeholder="Start drafting here…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}