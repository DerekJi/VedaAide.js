"use client";

import { useState, useRef } from "react";
import { ingestAction } from "@/app/actions/rag.actions";

// ─────────────────────────────────────────────────────────────────────────────
// T27: Document ingest form
// Calls the ingestAction Server Action to upload a .txt / .md file into the
// knowledge base. Displays success/failure feedback inline.
// ─────────────────────────────────────────────────────────────────────────────

interface IngestStatus {
  type: "success" | "error";
  message: string;
}

export default function IngestPage() {
  const [status, setStatus] = useState<IngestStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setIsLoading(true);

    try {
      const formData = new FormData(event.currentTarget);
      const result = await ingestAction(formData);

      if (result.error) {
        setStatus({ type: "error", message: result.error });
      } else if (result.data) {
        const { chunkCount, skipped } = result.data;
        const msg = skipped
          ? "File already ingested — no changes made."
          : `Ingested successfully (${chunkCount} chunk${chunkCount !== 1 ? "s" : ""}).`;
        setStatus({ type: "success", message: msg });
        formRef.current?.reset();
      }
    } catch {
      setStatus({ type: "error", message: "Unexpected error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Ingest Document</h1>
      <p className="text-gray-500 mb-6">
        Upload a <code>.txt</code> or <code>.md</code> file to add it to the knowledge base.
      </p>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-1">
            File
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".txt,.md,.mdx"
            required
            disabled={isLoading}
            className="block w-full text-sm text-gray-700 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 p-2"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isLoading ? "Ingesting…" : "Upload & Ingest"}
        </button>
      </form>

      {status && (
        <div
          className={`mt-4 p-3 rounded-lg text-sm ${
            status.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}
