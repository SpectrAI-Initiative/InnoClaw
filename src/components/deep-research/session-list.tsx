"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Brain, MoreHorizontal, Trash2 } from "lucide-react";
import { DeleteSessionDialog } from "./delete-session-dialog";
import type { DeepResearchSession } from "@/lib/deep-research/types";

interface SessionListProps {
  sessions: DeepResearchSession[];
  onSelect: (sessionId: string) => void;
  onCreateNew: () => void;
  onDeleted: (sessionId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  intake: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  planning: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  running: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  awaiting_approval: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  awaiting_user_confirmation: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

export function SessionList({ sessions, onSelect, onCreateNew, onDeleted }: SessionListProps) {
  const [deleteTarget, setDeleteTarget] = useState<DeepResearchSession | null>(null);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-500" />
          <h3 className="text-sm font-semibold">Deep Research</h3>
        </div>
        <Button size="sm" onClick={onCreateNew} className="h-7 px-2 gap-1">
          <Plus className="h-3.5 w-3.5" />
          <span className="text-xs">New</span>
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Brain className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No research sessions yet</p>
            <p className="text-xs mt-1">Start a new deep research session</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-start gap-1 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <button
                  onClick={() => onSelect(s.id)}
                  className="flex-1 min-w-0 text-left p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{s.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(s.createdAt).toLocaleDateString()} &middot; {s.phase}
                      </div>
                    </div>
                    <Badge className={STATUS_COLORS[s.status] || ""} variant="secondary">
                      {s.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </button>

                {/* Actions menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-2 mt-2 mr-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all shrink-0">
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[160px]">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(s);
                      }}
                      className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      <span className="text-xs">Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <DeleteSessionDialog
          sessionId={deleteTarget.id}
          sessionTitle={deleteTarget.title}
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          onDeleted={() => {
            onDeleted(deleteTarget.id);
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
}
