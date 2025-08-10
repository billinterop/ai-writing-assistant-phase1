import { Routes, Route, Navigate } from "react-router-dom";
import Phase2Gather from "./Phase2Gather";
import Phase3Draft from "./Phase3Draft";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/phase2" replace />} />
      <Route path="/phase2" element={<Phase2Gather />} />
      <Route path="/phase3" element={<Phase3Draft />} />
      <Route path="*" element={<Navigate to="/phase2" replace />} />
    </Routes>
  );
}
