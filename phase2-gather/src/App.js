import React from "react";
import Phase2Gather from "./Phase2Gather";
import Phase3Draft from "./Phase3Draft";

export default function App() {
  const path = window.location.pathname;

  if (path === "/phase3") {
    return <Phase3Draft />;
  }

  // Default to Phase 2
  return <Phase2Gather />;
}
