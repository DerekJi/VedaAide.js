import { FlaskConical } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation page — placeholder for Phase 4 evaluations feature.
// ─────────────────────────────────────────────────────────────────────────────

export default function EvaluationPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <FlaskConical className="h-16 w-16 text-gray-300 mb-4" />
      <h1 className="text-2xl font-bold text-gray-700 mb-2">Evaluation</h1>
      <p className="text-gray-400 max-w-sm">
        RAG quality evaluation reports are coming in Phase 4. Stay tuned!
      </p>
    </div>
  );
}
