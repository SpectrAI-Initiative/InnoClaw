"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Plus, X, Check, Pencil, Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AgentSession } from "@/lib/hooks/use-agent-sessions";

interface AgentSessionTabsProps {
  sessions: AgentSession[];
  activeSessionId: string;
  loadingSessions?: Record<string, boolean>;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
}

export function AgentSessionTabs({
  sessions,
  activeSessionId,
  loadingSessions = {},
  onSelect,
  onClose,
  onCreate,
  onRename,
}: AgentSessionTabsProps) {
  const t = useTranslations("agent");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Clear confirm timer on unmount
  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleClose = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (sessions.length <= 1) return;

      if (confirmingId === id) {
        // Second click — actually close
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        setConfirmingId(null);
        onClose(id);
      } else {
        // First click — enter confirm state
        setConfirmingId(id);
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = setTimeout(() => {
          setConfirmingId(null);
        }, 3000);
      }
    },
    [confirmingId, sessions.length, onClose]
  );

  const handleDoubleClick = useCallback(
    (id: string, name: string) => {
      setEditingId(id);
      setEditValue(name);
    },
    []
  );

  const commitRename = useCallback(() => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  }, [editingId, editValue, onRename]);

  // With only one session, show just the icon + "+" button (no tab needed)
  if (sessions.length <= 1) {
    const singleSessionLoading = sessions.length === 1 && !!loadingSessions[sessions[0].id];
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 flex-1 min-w-0">
        <Bot className={`h-3.5 w-3.5 text-agent-accent ${singleSessionLoading ? "animate-pulse" : ""}`} />
        {singleSessionLoading && (
          <span className="text-xs text-agent-accent animate-title-breathe font-medium">
            {sessions[0]?.name || "Agent"}
          </span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={onCreate}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {t("newSession")}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 px-1 py-0.5 overflow-x-auto flex-1 min-w-0">
      {sessions.map((session) => {
        const isActive = session.id === activeSessionId;
        const isConfirming = confirmingId === session.id;
        const isEditing = editingId === session.id;
        const isSessionLoading = !!loadingSessions[session.id];

        return (
          <div
            key={session.id}
            className={`group flex items-center gap-1 rounded-md px-2.5 py-1 text-xs cursor-pointer select-none transition-colors ${
              isActive
                ? "bg-background text-foreground shadow-sm border border-border/50"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            } ${isSessionLoading ? "animate-breathe" : ""}`}
            onClick={() => onSelect(session.id)}
            onDoubleClick={() => handleDoubleClick(session.id, session.name)}
          >
            <Bot className={`h-3 w-3 shrink-0 ${isSessionLoading ? "text-agent-accent animate-pulse" : "text-muted-foreground"}`} />
            {isEditing ? (
              <input
                ref={editInputRef}
                className="w-20 bg-transparent text-xs outline-none border-b border-primary"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                {isSessionLoading && (
                  <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                )}
                <span className="max-w-[100px] truncate">{session.name}</span>
              </>
            )}

            {!isEditing && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="rounded p-0.5 transition-colors opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDoubleClick(session.id, session.name);
                    }}
                  >
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {t("renameSession")}
                </TooltipContent>
              </Tooltip>
            )}

            {sessions.length > 1 && !isEditing && (
              <button
                className={`ml-0.5 rounded p-0.5 transition-colors ${
                  isConfirming
                    ? "text-destructive bg-destructive/10"
                    : "opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
                onClick={(e) => handleClose(session.id, e)}
                title={isConfirming ? t("closeConfirm") : t("closeSession")}
              >
                {isConfirming ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              </button>
            )}
          </div>
        );
      })}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 ml-0.5"
            onClick={onCreate}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {t("newSession")}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
