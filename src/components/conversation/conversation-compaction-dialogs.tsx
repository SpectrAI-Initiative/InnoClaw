"use client";

import type { CSSProperties, PointerEventHandler, ReactNode } from "react";
import type { UIMessage } from "ai";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CompactionDialogVariant = "default" | "terminal";

interface DialogLabels {
  title: string;
  description: string;
  roleUser?: string;
  roleAssistant?: string;
  selectAll?: string;
  selectNone?: string;
  cancel: string;
  confirm: string;
  clearAll?: string;
  memoryTitle?: string;
  memoryContent?: string;
}

interface BaseDialogProps {
  open: boolean;
  onCancel: () => void;
  variant?: CompactionDialogVariant;
  className?: string;
  style?: CSSProperties;
  headerClassName?: string;
  footerClassName?: string;
  scrollAreaClassName?: string;
  onHeaderPointerDown?: PointerEventHandler<HTMLDivElement>;
  footerExtra?: ReactNode;
}

interface MessageSelectionDialogProps extends BaseDialogProps {
  messages: UIMessage[];
  selectedMessageIds: Set<string>;
  getMessageText: (message: UIMessage) => string;
  onToggleMessage: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onConfirm: () => void;
  labels: DialogLabels;
  selectedCount?: number;
  totalCount?: number;
  showCount?: boolean;
  onClearAll?: () => void;
}

interface MemoryPreviewDialogProps extends BaseDialogProps {
  titleValue: string;
  contentValue: string;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  labels: DialogLabels;
}

const terminalSelectionClasses = {
  selected: "border-[#7aa2f7]/50 bg-[#7aa2f7]/5",
  idle: "border-[#30363d] hover:border-[#484f58]",
  roleUser: "text-[#bb9af7]",
  roleAssistant: "text-[#7aa2f7]",
  text: "text-[#c9d1d9]",
};

const defaultSelectionClasses = {
  selected: "border-primary bg-primary/5",
  idle: "border-transparent hover:bg-muted/50",
  roleUser: "text-muted-foreground",
  roleAssistant: "text-muted-foreground",
  text: "text-foreground",
};

function getSelectionClasses(variant: CompactionDialogVariant) {
  return variant === "terminal" ? terminalSelectionClasses : defaultSelectionClasses;
}

export function ConversationMessageSelectionDialog({
  open,
  onCancel,
  messages,
  selectedMessageIds,
  getMessageText,
  onToggleMessage,
  onSelectAll,
  onSelectNone,
  onConfirm,
  labels,
  variant = "default",
  className,
  style,
  headerClassName,
  footerClassName,
  scrollAreaClassName,
  onHeaderPointerDown,
  footerExtra,
  selectedCount,
  totalCount,
  showCount = false,
  onClearAll,
}: MessageSelectionDialogProps) {
  const selectionClasses = getSelectionClasses(variant);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) onCancel();
    }}>
      <DialogContent className={className} style={style}>
        <DialogHeader className={headerClassName} onPointerDown={onHeaderPointerDown}>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>

        <div className={variant === "terminal" ? "flex items-center gap-3 px-6 pb-2" : "flex gap-2 mb-2"}>
          <Button size="sm" variant="outline" onClick={onSelectAll}>
            {labels.selectAll}
          </Button>
          <Button size="sm" variant="outline" onClick={onSelectNone}>
            {labels.selectNone}
          </Button>
          {showCount ? (
            <span className="text-xs text-muted-foreground ml-auto">
              {selectedCount ?? selectedMessageIds.size} / {totalCount ?? messages.length}
            </span>
          ) : null}
        </div>

        <ScrollArea className={scrollAreaClassName ?? (variant === "terminal" ? "flex-1 min-h-0 px-6" : "flex-1 min-h-0 max-h-[50vh] pr-2")}>
          <div className={variant === "terminal" ? "space-y-2 py-2 pr-4" : "space-y-1.5"} role="listbox" aria-multiselectable="true">
            {messages.map((message) => {
              const text = getMessageText(message);
              if (!text) return null;
              const isSelected = selectedMessageIds.has(message.id);
              return (
                <div
                  key={message.id}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  className={`flex items-start ${variant === "terminal" ? "gap-3 px-3 py-2" : "gap-2 px-3 py-2"} rounded-md border cursor-pointer transition-colors ${
                    isSelected ? selectionClasses.selected : selectionClasses.idle
                  }`}
                  onClick={() => onToggleMessage(message.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onToggleMessage(message.id);
                    }
                  }}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleMessage(message.id)}
                    onClick={(event: React.MouseEvent) => event.stopPropagation()}
                    className={variant === "terminal" ? "mt-0.5 shrink-0" : "mt-0.5"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-medium ${variant === "default" ? "mb-0.5" : ""} ${
                      message.role === "user" ? selectionClasses.roleUser : selectionClasses.roleAssistant
                    }`}>
                      {message.role === "user" ? (labels.roleUser ?? "User") : (labels.roleAssistant ?? "Assistant")}
                    </div>
                    <div className={`text-xs whitespace-pre-wrap ${variant === "terminal" ? "" : "line-clamp-3"} ${selectionClasses.text}`}>
                      {variant === "terminal" ? text : `${text.slice(0, 300)}${text.length > 300 ? "..." : ""}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className={footerClassName}>
          <Button variant="outline" onClick={onCancel}>{labels.cancel}</Button>
          {onClearAll && labels.clearAll ? (
            <Button variant="destructive" onClick={onClearAll}>
              {labels.clearAll}
            </Button>
          ) : null}
          <Button onClick={onConfirm} disabled={selectedMessageIds.size === 0}>
            {labels.confirm}
          </Button>
        </DialogFooter>
        {footerExtra}
      </DialogContent>
    </Dialog>
  );
}

export function ConversationMemoryPreviewDialog({
  open,
  onCancel,
  titleValue,
  contentValue,
  onTitleChange,
  onContentChange,
  onConfirm,
  confirmDisabled,
  labels,
  variant = "default",
  className,
  style,
  headerClassName,
  footerClassName,
  scrollAreaClassName,
  onHeaderPointerDown,
  footerExtra,
}: MemoryPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) onCancel();
    }}>
      <DialogContent className={className} style={style}>
        <DialogHeader className={headerClassName} onPointerDown={onHeaderPointerDown}>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>

        {variant === "terminal" ? (
          <ScrollArea className={scrollAreaClassName ?? "flex-1 min-h-0 px-6"}>
            <div className="space-y-4 py-2 pr-4">
              <div className="space-y-1.5">
                <Label>{labels.memoryTitle}</Label>
                <Input value={titleValue} onChange={(event) => onTitleChange(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{labels.memoryContent}</Label>
                <Textarea
                  value={contentValue}
                  onChange={(event) => onContentChange(event.target.value)}
                  rows={12}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="space-y-3 flex-1 min-h-0">
            <div>
              <Label className="text-xs">{labels.memoryTitle}</Label>
              <Input
                value={titleValue}
                onChange={(event) => onTitleChange(event.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex-1 min-h-0">
              <Label className="text-xs">{labels.memoryContent}</Label>
              <Textarea
                value={contentValue}
                onChange={(event) => onContentChange(event.target.value)}
                className="mt-1 min-h-[200px] max-h-[40vh] resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter className={footerClassName}>
          <Button variant="outline" onClick={onCancel}>{labels.cancel}</Button>
          <Button onClick={onConfirm} disabled={confirmDisabled}>
            {labels.confirm}
          </Button>
        </DialogFooter>
        {footerExtra}
      </DialogContent>
    </Dialog>
  );
}
