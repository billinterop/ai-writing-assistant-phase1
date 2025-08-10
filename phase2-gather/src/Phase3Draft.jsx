import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

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

      // If first-time (no existing draft), auto-fill from bullets
      if (!draft) {
        const bullets =
          parsed?.combinedBullets?.length
            ? parsed.combinedBullets
            : (parsed?.results?.[0]?.bullets || []);
        const text = bullets.map((b) => `• ${b}`).join("\n");
        setDraft(text);

        // After paint, scroll/focus to textarea to start typing
        setTimeout(() => {
          draftRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          draftRef.current?.focus();
        }, 0);
      }
    } catch {
      // ignore
    }
  }, []); // run once

  const handleStartWithOutline = () => {
    if (!seed) return;
    const bullets =
      seed?.combinedBullets?.length ? seed.combinedBullets : (seed?.results?.[0]?.bullets || []);
    const text = bullets.map((b) => `• ${b}`).join("\n");
    setDraft(text);

    setTimeout(() => {
      draftRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      draftRef.current?.focus();
    }, 0);
  };

  const fileList =
    seed?.sourceFiles?.length
      ? seed.sourceFiles.map((f) => f.name).join(", ")
      : "—";

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Top bar */}
      <div className="flex items-center gap-3 p-6 border-b">
        <h2 className="text-xl font-semibold">Phase 3 — Draft</h2>
        <div className="ml-auto flex items-center gap-3">
          <Link className="text-sm text-blue-700 underline" to="/phase2">
            ← Back to Phase 2
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 overflow-y-auto">
        {!seed ? (
          <div className="text-gray-600">
            <p className="mb-3">
              No saved summary found. Head back to <Link className="text-blue-700 underline" to="/phase2">Phase 2</Link>, create a summary, and click <b>Save Summary and Continue to Phase 3</b>.
            </p>
          </div>
        ) : (
          <>
            {/* Context block */}
            <div className="mb-4 text-sm text-gray-700">
              <div><span className="font-medium">Saved:</span> {new Date(seed.savedAt).toLocaleString()}</div>
              <div><span className="font-medium">Sources:</span> {fileList}</div>
              <div><span className="font-medium">Notes:</span> {seed.noteCount ?? 0}</div>
            </div>

            {/* Outline preview */}
            <div className="mb-4 bg-gray-50 border rounded p-4">
              <h4 className="font-medium mb-2">Outline from Phase 2</h4>
              <ul className="list-disc pl-5 space-y-1">
                {(seed.combinedBullets?.length
                  ? seed.combinedBullets
                  : (seed.results?.[0]?.bullets || [])
                ).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>

              <div className="mt-3">
                <button
                  className="px-3 py-1 text-sm border rounded"
                  onClick={handleStartWithOutline}
                >
                  Start with this outline
                </button>
              </div>
            </div>

            {/* Draft editor */}
            <div>
              <label className="block font-medium mb-2" htmlFor="draft">
                Draft
              </label>
              <textarea
                id="draft"
                ref={draftRef}
                className="border p-3 rounded w-full h-64"
                placeholder="Begin your draft here..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}