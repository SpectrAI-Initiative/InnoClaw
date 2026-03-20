"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface DeleteSessionDialogProps {
  sessionId: string;
  sessionTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export function DeleteSessionDialog({
  sessionId,
  sessionTitle,
  open,
  onOpenChange,
  onDeleted,
}: DeleteSessionDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/deep-research/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete session");
      }
      toast.success("Research session deleted");
      onOpenChange(false);
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete session");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <DialogTitle className="text-base">Delete research session</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-sm leading-relaxed">
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground">&ldquo;{sessionTitle}&rdquo;</span>?
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 p-3 text-xs text-red-800 dark:text-red-200 leading-relaxed space-y-1">
          <p>This will permanently delete:</p>
          <ul className="list-disc list-inside space-y-0.5 pl-1">
            <li>All messages and conversation history</li>
            <li>All workflow nodes and execution records</li>
            <li>All research artifacts and reports</li>
            <li>All event logs</li>
          </ul>
          <p className="font-medium pt-1">This action cannot be undone.</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
            className="gap-1.5 text-xs"
          >
            {deleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                Delete permanently
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
