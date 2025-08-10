import React, { useEffect, useState, useRef } from "react";

export default function Phase3Draft() {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("phase3_seed_summary");
    if (saved) {
      try {
        const payload = JSON.parse(saved);

        // Build initial text from combined or per-file
        let text = "";
        if (payload.mode === "combined" && payload.combinedBullets?.length) {
          text = ["Key Points from Your Material:", ...payload.combinedBullets.map((b) => `• ${b}`)].join("\n");
        } else if (payload.results?.length) {
          text = payload.results
            .map((r) => [`# ${r.name}`, ...r.bullets.map((b) => `• ${b}`)].join("\n"))
            .join("\n\n");
        }

        setDraft(text);

        // Auto-scroll + focus
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
            textareaRef.current.focus();
          }
        }, 200);
      } catch (err) {
        console.error("Failed to parse phase3_seed_summary", err);
      }
    }
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white p-6">
      <h2 className="text-xl font-semibold mb-4">✍️ Phase 3 – Draft Your Piece</h2>

      <textarea
        ref={textareaRef}
        className="border p-2 rounded w-full flex-1"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Start writing your draft here..."
      />

      <div className="mt-4 flex gap-2">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => alert("Draft saved! (placeholder)")}
        >
          Save Draft
        </button>
      </div>
    </div>
  );
}