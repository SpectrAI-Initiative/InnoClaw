export const SHELL_VIEWS = ["agent", "skills", "library", "research", "settings"] as const;

export type ShellView = (typeof SHELL_VIEWS)[number];

/** Control-plane surface. It names what is on screen, not the payload. */
export interface ShellSurface {
  view: ShellView;
  researchSessionId: string | null;
  intake: boolean;
  previewPath: string | null;
}

export interface ResearchFocus {
  sessionId: string | null;
  intake: boolean;
}

const DEFAULT_SURFACE: ShellSurface = {
  view: "agent",
  researchSessionId: null,
  intake: false,
  previewPath: null,
};

function isShellView(value: string | null): value is ShellView {
  return SHELL_VIEWS.some((view) => view === value);
}

export function parseShellSurface(params: Pick<URLSearchParams, "get">): ShellSurface {
  const viewValue = params.get("view");
  const view = isShellView(viewValue) ? viewValue : "agent";
  const researchSessionId = params.get("research");
  const previewPath = params.get("file");

  return {
    view,
    researchSessionId: researchSessionId || null,
    intake: params.get("intake") === "1",
    previewPath: view === "agent" && previewPath ? previewPath : null,
  };
}

export function researchFocusOf(surface: ShellSurface): ResearchFocus {
  return {
    sessionId: surface.researchSessionId,
    intake: surface.intake,
  };
}

export function surfaceFromResearchFocus(surface: ShellSurface, focus: ResearchFocus): ShellSurface {
  return {
    ...surface,
    view: "research",
    researchSessionId: focus.intake ? null : focus.sessionId,
    intake: focus.intake,
    previewPath: null,
  };
}

export function buildWorkspaceHref(workspaceId: string, surface: ShellSurface): string {
  const params = new URLSearchParams();
  if (surface.view !== "agent") params.set("view", surface.view);
  if (surface.view === "research") {
    if (surface.intake) params.set("intake", "1");
    else if (surface.researchSessionId) params.set("research", surface.researchSessionId);
  }
  if (surface.view === "agent" && surface.previewPath) params.set("file", surface.previewPath);
  const query = params.toString();
  return query ? `/workspace/${workspaceId}?${query}` : `/workspace/${workspaceId}`;
}

export function closePreview(surface: ShellSurface): ShellSurface {
  return { ...surface, previewPath: null };
}

export function openPreview(surface: ShellSurface, previewPath: string): ShellSurface {
  return { ...DEFAULT_SURFACE, ...surface, view: "agent", previewPath };
}
