"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSyncedFiles, type SyncedFile } from "@/lib/queries/rag.queries";

// ─────────────────────────────────────────────────────────────────────────────
// T10: IngestHistory — TanStack Table listing all ingested documents.
// ─────────────────────────────────────────────────────────────────────────────

const col = createColumnHelper<SyncedFile>();

const STATUS_VARIANT: Record<string, "default" | "secondary" | "warning" | "destructive"> = {
  completed: "default",
  processing: "warning",
  pending: "secondary",
  failed: "destructive",
};

const columns = [
  col.accessor("name", {
    header: "File name",
    cell: (info) => (
      <span
        className="font-medium text-gray-800 truncate max-w-[200px] block"
        title={info.getValue()}
      >
        {info.getValue()}
      </span>
    ),
  }),
  col.accessor("status", {
    header: "Status",
    cell: (info) => (
      <Badge variant={STATUS_VARIANT[info.getValue()] ?? "secondary"}>{info.getValue()}</Badge>
    ),
  }),
  col.accessor("chunkCount", {
    header: "Chunks",
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  }),
  col.accessor("createdAt", {
    header: "Ingested at",
    cell: (info) => (
      <span className="text-gray-500 text-sm">{new Date(info.getValue()).toLocaleString()}</span>
    ),
  }),
];

export function IngestHistory() {
  const { data: files = [], isLoading, isError } = useSyncedFiles();
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: files,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (isLoading) {
    return <div className="text-center py-8 text-gray-400 text-sm">Loading documents…</div>;
  }

  if (isError) {
    return <div className="text-center py-8 text-red-500 text-sm">Failed to load documents.</div>;
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No documents ingested yet. Upload a file above to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-left font-semibold text-gray-600 select-none"
                  onClick={header.column.getToggleSortingHandler()}
                  style={{ cursor: header.column.getCanSort() ? "pointer" : "default" }}
                >
                  <span className="inline-flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() && (
                      <>
                        {header.column.getIsSorted() === "asc" && (
                          <ChevronUp className="h-3.5 w-3.5" />
                        )}
                        {header.column.getIsSorted() === "desc" && (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                        {!header.column.getIsSorted() && (
                          <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400" />
                        )}
                      </>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-gray-100">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50 transition-colors">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
