import { IMAGE_EXTS } from "@/lib/constants";
import type { FileEntry } from "@/types";

const IMAGE_MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
};

export function isWorkspaceImagePath(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return (IMAGE_EXTS as readonly string[]).includes(ext);
}

export function getWorkspaceImageMimeType(
  filePath: string,
  fallback?: string
): string {
  if (fallback?.startsWith("image/")) {
    return fallback;
  }

  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_MIME_TYPES[ext] ?? "image/png";
}

export function filterWorkspaceImageEntries(entries: FileEntry[]): FileEntry[] {
  return entries
    .filter(
      (entry) =>
        entry.type === "directory" ||
        (entry.type === "file" && isWorkspaceImagePath(entry.path))
    )
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === "directory" ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
}

export function getWorkspaceImageDisplayPath(
  workspaceRoot: string,
  currentPath: string
): string {
  const rootName = workspaceRoot.split("/").filter(Boolean).pop() || workspaceRoot;
  if (currentPath === workspaceRoot) {
    return `${rootName}/`;
  }

  const relativePath = currentPath.startsWith(`${workspaceRoot}/`)
    ? currentPath.slice(workspaceRoot.length + 1)
    : currentPath;

  return `${rootName}/${relativePath}`;
}

export function focusAgentInputAfterDialogClose(
  event: { preventDefault?: () => void },
  input:
    | {
        focus: () => void;
      }
    | null
    | undefined,
  scheduleFocus?: (callback: () => void) => void
): void {
  event.preventDefault?.();
  if (!input) {
    return;
  }

  const scheduler =
    scheduleFocus ??
    ((callback: () => void) => {
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => callback());
        return;
      }
      setTimeout(callback, 0);
    });

  scheduler(() => input.focus());
}
