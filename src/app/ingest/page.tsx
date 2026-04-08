import { FileUpload } from "@/components/ingest/file-upload";
import { IngestHistory } from "@/components/ingest/ingest-history";
import { SyncButton } from "@/components/ingest/sync-button";

// ─────────────────────────────────────────────────────────────────────────────
// T9-T11: Ingest page — drag-and-drop upload, document history table, sync.
// This page is a thin composition of three SRP-focused components.
// ─────────────────────────────────────────────────────────────────────────────

export default function IngestPage() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-3xl w-full mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Document Ingest</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Upload <code>.txt</code> or <code>.md</code> files, or sync connected data sources.
            </p>
          </div>
          <SyncButton />
        </div>

        {/* Dropzone */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
            Upload files
          </h2>
          <FileUpload />
        </section>

        {/* Document history */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
            Ingested documents
          </h2>
          <IngestHistory />
        </section>
      </div>
    </div>
  );
}
