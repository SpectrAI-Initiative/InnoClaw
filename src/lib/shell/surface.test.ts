import { describe, expect, it } from "vitest";
import {
  buildWorkspaceHref,
  openPreview,
  parseShellSurface,
  surfaceFromResearchFocus,
} from "./surface";

describe("shell surface", () => {
  it("defaults to the agent view and drops a preview that belongs to another view", () => {
    const surface = parseShellSurface(new URLSearchParams("view=skills&file=/tmp/a.md"));
    expect(surface).toEqual({
      view: "skills",
      researchSessionId: null,
      intake: false,
      previewPath: null,
    });
  });

  it("keeps a file preview only on the agent view", () => {
    const surface = parseShellSurface(new URLSearchParams("file=/work/note.md"));
    expect(surface.view).toBe("agent");
    expect(surface.previewPath).toBe("/work/note.md");
  });

  it("builds a research intake href without a session id", () => {
    const href = buildWorkspaceHref("ws-1", {
      view: "research",
      researchSessionId: "old",
      intake: true,
      previewPath: "/work/note.md",
    });
    expect(href).toBe("/workspace/ws-1?view=research&intake=1");
  });

  it("moves the surface onto a research session from a focus event", () => {
    const next = surfaceFromResearchFocus(
      { view: "agent", researchSessionId: null, intake: false, previewPath: "/a.md" },
      { sessionId: "dr-1", intake: false },
    );
    expect(buildWorkspaceHref("ws-1", next)).toBe("/workspace/ws-1?view=research&research=dr-1");
  });

  it("opens a preview by returning to the agent view", () => {
    const next = openPreview(
      { view: "library", researchSessionId: null, intake: false, previewPath: null },
      "/work/out.html",
    );
    expect(next.view).toBe("agent");
    expect(next.previewPath).toBe("/work/out.html");
  });
});
