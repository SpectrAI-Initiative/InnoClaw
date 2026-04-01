import { describe, expect, it } from "vitest";
import type { FileEntry } from "@/types";
import {
  filterWorkspaceImageEntries,
  focusAgentInputAfterDialogClose,
  getWorkspaceImageMimeType,
  getWorkspaceImageDisplayPath,
  isWorkspaceImagePath,
} from "./workspace-image-picker-utils";

function createEntry(overrides: Partial<FileEntry>): FileEntry {
  return {
    name: "entry",
    type: "file",
    size: 0,
    modified: "",
    path: "/workspace/entry",
    ...overrides,
  };
}

describe("workspace image picker utils", () => {
  it("keeps directories and image files only, sorted with directories first", () => {
    const entries = filterWorkspaceImageEntries([
      createEntry({ name: "notes.md", path: "/workspace/notes.md" }),
      createEntry({ name: "zeta", type: "directory", path: "/workspace/zeta" }),
      createEntry({ name: "b.png", path: "/workspace/b.png" }),
      createEntry({ name: "alpha", type: "directory", path: "/workspace/alpha" }),
      createEntry({ name: "a.JPG", path: "/workspace/a.JPG" }),
    ]);

    expect(entries.map((entry) => entry.name)).toEqual([
      "alpha",
      "zeta",
      "a.JPG",
      "b.png",
    ]);
  });

  it("detects supported image file paths case-insensitively", () => {
    expect(isWorkspaceImagePath("/workspace/figure.PNG")).toBe(true);
    expect(isWorkspaceImagePath("/workspace/chart.webp")).toBe(true);
    expect(isWorkspaceImagePath("/workspace/readme.md")).toBe(false);
  });

  it("formats paths relative to the workspace root", () => {
    expect(
      getWorkspaceImageDisplayPath("/workspace/project", "/workspace/project/figures")
    ).toBe("project/figures");
    expect(
      getWorkspaceImageDisplayPath("/workspace/project", "/workspace/project")
    ).toBe("project/");
  });

  it("infers a usable image mime type from the file path", () => {
    expect(getWorkspaceImageMimeType("/workspace/icon.ico")).toBe("image/x-icon");
    expect(getWorkspaceImageMimeType("/workspace/scan.bmp")).toBe("image/bmp");
    expect(getWorkspaceImageMimeType("/workspace/photo.png", "image/png")).toBe("image/png");
  });

  it("prevents dialog focus restoration and returns focus to the agent input", () => {
    let prevented = false;
    let focused = false;
    let scheduled: (() => void) | null = null;

    focusAgentInputAfterDialogClose(
      {
        preventDefault() {
          prevented = true;
        },
      },
      {
        focus() {
          focused = true;
        },
      },
      (callback) => {
        scheduled = callback;
      }
    );

    expect(prevented).toBe(true);
    expect(focused).toBe(false);

    const runScheduled = scheduled as (() => void) | null;
    expect(runScheduled).not.toBeNull();
    if (runScheduled) {
      runScheduled();
    }

    expect(focused).toBe(true);
  });
});
