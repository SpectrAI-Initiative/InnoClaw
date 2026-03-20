"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { RequirementState } from "@/lib/deep-research/types";

interface RequirementPanelProps {
  requirementState: RequirementState | null;
}

export function RequirementPanel({ requirementState }: RequirementPanelProps) {
  const [showConstraints, setShowConstraints] = useState(false);

  if (!requirementState) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No requirements tracked yet. They will appear after the intake phase.
      </div>
    );
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "satisfied":
        return <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />;
      case "dropped":
        return <XCircle className="h-3.5 w-3.5 text-gray-400 shrink-0" />;
      default:
        return <div className="h-3.5 w-3.5 rounded-full border-2 border-blue-500 shrink-0" />;
    }
  };

  const priorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "text-red-600 border-red-300";
      case "high": return "text-orange-600 border-orange-300";
      case "medium": return "text-blue-600 border-blue-300";
      case "low": return "text-gray-600 border-gray-300";
      default: return "";
    }
  };

  const constraintStatusIcon = (status: string) => {
    switch (status) {
      case "violated":
        return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
      case "relaxed":
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
      default:
        return <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />;
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        {/* Version badge */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            v{requirementState.version}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Last modified by {requirementState.lastModifiedBy}
          </span>
        </div>

        {/* Requirements list */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Requirements ({requirementState.requirements.filter(r => r.status === "active").length} active)
          </div>
          {requirementState.requirements.map((req) => (
            <div
              key={req.id}
              className={`flex items-start gap-2 p-2 rounded border ${
                req.status === "dropped" ? "opacity-50" : ""
              }`}
            >
              {statusIcon(req.status)}
              <div className="flex-1 min-w-0">
                <div className="text-xs leading-relaxed">{req.text}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="outline" className={`text-[9px] ${priorityColor(req.priority)}`}>
                    {req.priority}
                  </Badge>
                  <span className="text-[9px] text-muted-foreground">
                    from {req.source}
                  </span>
                  {req.satisfiedByNodeIds.length > 0 && (
                    <span className="text-[9px] text-green-600">
                      ({req.satisfiedByNodeIds.length} node{req.satisfiedByNodeIds.length > 1 ? "s" : ""})
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Constraints */}
        <div>
          <button
            onClick={() => setShowConstraints(!showConstraints)}
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground"
          >
            Constraints ({requirementState.constraints.length})
            {showConstraints ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showConstraints && (
            <div className="mt-2 space-y-1.5">
              {requirementState.constraints.map((con) => (
                <div key={con.id} className="flex items-center gap-2 p-1.5 rounded bg-muted/50">
                  {constraintStatusIcon(con.status)}
                  <span className="text-xs flex-1">{con.text}</span>
                  <Badge variant="outline" className="text-[9px]">{con.type}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
