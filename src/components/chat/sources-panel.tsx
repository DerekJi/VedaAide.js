"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { VectorSearchResult } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// T7: SourcesPanel — collapsible list of retrieved source chunks.
// ─────────────────────────────────────────────────────────────────────────────

interface SourcesPanelProps {
  sources: VectorSearchResult[];
}

export function SourcesPanel({ sources }: SourcesPanelProps) {
  const [open, setOpen] = useState(false);

  if (sources.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mt-2 select-none">
        <FileText className="h-3.5 w-3.5" />
        <span>
          {sources.length} source{sources.length > 1 ? "s" : ""}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-2">
          {sources.map((source, i) => (
            <Card key={i} className="text-xs">
              <CardHeader className="p-2 pb-0">
                <CardTitle className="text-xs flex items-center justify-between gap-2">
                  <span className="truncate text-gray-600">
                    {(source.metadata?.source as string | undefined) ?? `Source ${i + 1}`}
                  </span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {(source.score * 100).toFixed(0)}%
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-1">
                <p className="text-gray-500 line-clamp-3">{source.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
