"use client";
/* eslint-disable @next/next/no-img-element */

import type { FileUIPart } from "ai";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageAttachmentGridProps {
  attachments: FileUIPart[];
  onRemove?: (index: number) => void;
  className?: string;
  imageClassName?: string;
  removeLabel: string;
}

export function ImageAttachmentGrid({
  attachments,
  onRemove,
  className,
  imageClassName,
  removeLabel,
}: ImageAttachmentGridProps) {
  if (attachments.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {attachments.map((attachment, index) => {
        const label = attachment.filename || `image-${index + 1}`;

        return (
          <div
            key={`${attachment.url}-${index}`}
            className="relative overflow-hidden rounded-lg border border-border/70 bg-background/40"
          >
            <img
              src={attachment.url}
              alt={label}
              className={cn("h-24 w-24 object-cover", imageClassName)}
              loading="lazy"
            />
            {attachment.filename ? (
              <div className="max-w-24 truncate border-t border-border/70 bg-background/85 px-2 py-1 text-[10px] text-muted-foreground">
                {attachment.filename}
              </div>
            ) : null}
            {onRemove ? (
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white transition-colors hover:bg-black/85"
                aria-label={`${removeLabel}: ${label}`}
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
