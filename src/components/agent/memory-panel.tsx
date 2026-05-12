"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface MemoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

interface MemoryNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export function MemoryPanel({ open, onOpenChange, workspaceId }: MemoryPanelProps) {
  const [notes, setNotes] = useState<MemoryNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [dreaming, setDreaming] = useState(false);
  const [rememberText, setRememberText] = useState("");

  const loadMemories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agent/memory?workspaceId=${encodeURIComponent(workspaceId)}`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (open && workspaceId) {
      loadMemories();
    }
  }, [open, workspaceId, loadMemories]);

  const handleRemember = async () => {
    if (!rememberText.trim()) return;
    try {
      const res = await fetch("/api/agent/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, action: "remember", text: rememberText.trim() }),
      });
      if (res.ok) {
        toast.success("Memory saved");
        setRememberText("");
        loadMemories();
      } else {
        toast.error("Failed to save memory");
      }
    } catch {
      toast.error("Failed to save memory");
    }
  };

  const handleDream = async () => {
    setDreaming(true);
    try {
      const res = await fetch("/api/agent/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, action: "dream" }),
      });
      if (res.ok) {
        toast.success("Dream consolidation complete");
        loadMemories();
      } else {
        toast.error("Dream consolidation failed");
      }
    } catch {
      toast.error("Dream consolidation failed");
    } finally {
      setDreaming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Memory
          </DialogTitle>
          <DialogDescription>
            Cross-session memory for this workspace. Memories persist across conversations.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No memories yet. Use <code>/remember</code> or <code>&lt;memory&gt;</code> tags to save.
            </div>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="rounded-md border border-[#30363d] p-3 text-xs">
                <div className="font-semibold text-[#c9d1d9] mb-1">{note.title}</div>
                <div className="text-[#8b949e] whitespace-pre-wrap line-clamp-4">
                  {note.content}
                </div>
                <div className="text-[#565f89] text-[10px] mt-1">
                  {new Date(note.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2 pt-2 border-t border-[#30363d]">
          <div className="flex gap-2">
            <Textarea
              value={rememberText}
              onChange={(e) => setRememberText(e.target.value)}
              placeholder="Remember something..."
              className="text-xs min-h-[60px]"
            />
          </div>
          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDream}
              disabled={dreaming || notes.length === 0}
            >
              {dreaming ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-3 w-3 mr-1" />
              )}
              Dream
            </Button>
            <Button
              size="sm"
              onClick={handleRemember}
              disabled={!rememberText.trim()}
            >
              Remember
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
