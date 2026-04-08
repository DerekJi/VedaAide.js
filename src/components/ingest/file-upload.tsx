"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File as FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIngestMutation } from "@/lib/queries/rag.queries";
import { useToast } from "@/components/ui/toast";

// ─────────────────────────────────────────────────────────────────────────────
// T9: FileUpload — drag-and-drop / click-to-upload.
// Supports .txt, .md, .mdx. Calls the ingestAction Server Action via mutation.
// ─────────────────────────────────────────────────────────────────────────────

export function FileUpload() {
  const { mutate, isPending } = useIngestMutation();
  const { toast } = useToast();

  const onDrop = useCallback(
    (accepted: File[]) => {
      for (const file of accepted) {
        mutate(file, {
          onSuccess: (data) => {
            toast({
              variant: "success",
              title: data.skipped ? "Already ingested" : "Ingested",
              description: data.skipped
                ? `${file.name} — no changes.`
                : `${file.name} — ${data.chunkCount} chunk${data.chunkCount !== 1 ? "s" : ""} stored.`,
            });
          },
          onError: (err) => {
            toast({ variant: "error", title: "Ingest failed", description: err.message });
          },
        });
      }
    },
    [mutate, toast],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/plain": [".txt"],
      "text/markdown": [".md", ".mdx"],
    },
    multiple: true,
    disabled: isPending,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
        isDragActive
          ? "border-blue-500 bg-blue-50"
          : "border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50",
        isPending && "opacity-60 pointer-events-none",
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3 text-gray-500">
        {isDragActive ? (
          <FileIcon className="h-10 w-10 text-blue-500" />
        ) : (
          <Upload className="h-10 w-10" />
        )}
        <div>
          <p className="font-medium text-sm">
            {isDragActive ? "Drop files here" : "Drag & drop or click to upload"}
          </p>
          <p className="text-xs mt-1 text-gray-400">.txt, .md, .mdx files supported</p>
        </div>
        {isPending && (
          <div className="flex items-center gap-2 text-blue-600 text-xs">
            <div className="h-3 w-3 rounded-full border border-blue-600 border-t-transparent animate-spin" />
            Ingesting…
          </div>
        )}
      </div>
    </div>
  );
}
