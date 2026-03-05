"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, FileText, Trash2, Pencil, Calendar, CalendarDays } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useNotes } from "@/lib/hooks/use-notes";
import { toast } from "sonner";
import type { Note } from "@/types";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface NotesPanelProps {
  workspaceId: string;
}

export function NotesPanel({ workspaceId }: NotesPanelProps) {
  const t = useTranslations("notes");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { notes, isLoading, mutate } = useNotes(workspaceId);
  const { data: settings } = useSWR("/api/settings", fetcher);
  const aiEnabled = settings?.hasAIKey ?? false;
  const [generating, setGenerating] = useState(false);
  const [generatingDailyReport, setGeneratingDailyReport] = useState(false);
  const [generatingWeeklyReport, setGeneratingWeeklyReport] = useState(false);
  const [showNewNote, setShowNewNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [viewingNote, setViewingNote] = useState<Note | null>(null);

  // Editing state
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const handleGenerate = async (type: string) => {
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, type }),
      });
      if (!res.ok) throw new Error("Generation failed");
      mutate();
      toast.success(t("generate") + " " + tCommon("success"));
    } catch {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateDailyReport = async () => {
    setGeneratingDailyReport(true);
    try {
      const res = await fetch("/api/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, locale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      if (data.skipped) {
        toast.info(
          data.reason === "exists"
            ? t("dailyReportExists")
            : t("dailyReportSkipped")
        );
      } else {
        toast.success(t("dailyReportSuccess"));
      }
      mutate();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate daily report"
      );
    } finally {
      setGeneratingDailyReport(false);
    }
  };

  const handleGenerateWeeklyReport = async () => {
    setGeneratingWeeklyReport(true);
    try {
      const res = await fetch("/api/weekly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, locale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      if (data.skipped) {
        toast.info(
          data.reason === "exists"
            ? t("weeklyReportExists")
            : t("weeklyReportSkipped")
        );
      } else {
        toast.success(t("weeklyReportSuccess"));
      }
      mutate();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate weekly report"
      );
    } finally {
      setGeneratingWeeklyReport(false);
    }
  };

  const handleCreateNote = async () => {
    if (!noteTitle) return;
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title: noteTitle,
          content: noteContent,
          type: "manual",
        }),
      });
      setShowNewNote(false);
      setNoteTitle("");
      setNoteContent("");
      mutate();
    } catch {
      toast.error("Failed to create note");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
      mutate();
    } catch {
      toast.error("Failed to delete note");
    }
  };

  const handleOpenEdit = (note: Note) => {
    setEditingNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setViewingNote(null);
  };

  const handleSaveEdit = async () => {
    if (!editingNote || !editTitle) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/notes/${editingNote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });
      if (!res.ok) {
        toast.error(tCommon("error"));
        return;
      }
      setEditingNote(null);
      mutate();
      toast.success(tCommon("success"));
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <div className="flex gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={generating || !aiEnabled} title={!aiEnabled ? t("generateDisabled") : undefined}>
                <Sparkles className="mr-1 h-4 w-4" />
                {generating ? t("generating") : t("generate")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleGenerate("summary")}>
                {t("summary")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleGenerate("faq")}>
                {t("faq")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleGenerate("briefing")}>
                {t("briefing")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleGenerate("timeline")}>
                {t("timeline")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleGenerateDailyReport}
                disabled={generatingDailyReport}
              >
                <Calendar className="mr-1 h-4 w-4" />
                {generatingDailyReport
                  ? t("generatingDailyReport")
                  : t("generateDailyReport")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleGenerateWeeklyReport}
                disabled={generatingWeeklyReport}
              >
                <CalendarDays className="mr-1 h-4 w-4" />
                {generatingWeeklyReport
                  ? t("generatingWeeklyReport")
                  : t("generateWeeklyReport")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNewNote(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("addNote")}
          </Button>
        </div>
      </div>

      {/* Notes List */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-lg border bg-muted"
              />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
            <FileText className="mb-2 h-8 w-8" />
            <p>{t("emptyState")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <Card
                key={note.id}
                className="cursor-pointer transition-colors hover:bg-accent/50"
                onClick={() => setViewingNote(note)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm">{note.title}</CardTitle>
                    <div className="flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(note);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNote(note.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="text-xs">
                    {t(note.type)} &middot;{" "}
                    {new Date(note.createdAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-3 text-xs text-muted-foreground">
                    {note.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* New Note Dialog */}
      <Dialog open={showNewNote} onOpenChange={setShowNewNote}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addNote")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("noteTitle")}</Label>
              <Input
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("content")}</Label>
              <Textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={6}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowNewNote(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button onClick={handleCreateNote} disabled={!noteTitle}>
                {tCommon("create")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Note Dialog */}
      <Dialog
        open={!!viewingNote}
        onOpenChange={() => setViewingNote(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle>{viewingNote?.title}</DialogTitle>
              {viewingNote && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => handleOpenEdit(viewingNote)}
                >
                  <Pencil className="h-3 w-3" />
                  {t("editNote")}
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm">
            {viewingNote?.content}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Note Dialog */}
      <Dialog
        open={!!editingNote}
        onOpenChange={() => setEditingNote(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("editNote")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("noteTitle")}</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("content")}</Label>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingNote(null)}
              >
                {tCommon("cancel")}
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={!editTitle || savingEdit}
              >
                {savingEdit ? "..." : t("saveEdit")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
