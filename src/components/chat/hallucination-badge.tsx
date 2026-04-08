import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// T8: HallucinationBadge — shown when isHallucination=true on a message.
// ─────────────────────────────────────────────────────────────────────────────

export function HallucinationBadge() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="warning" className="cursor-help gap-1">
            <AlertTriangle className="h-3 w-3" />
            Possible hallucination
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          This answer may not be grounded in the retrieved documents. Verify independently before
          relying on it.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
