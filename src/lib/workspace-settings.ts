export interface WorkspaceBrowseSettingsResponse {
  workspaceRoots?: unknown;
  defaultBrowsePath?: unknown;
}

export function normalizeWorkspaceBrowseSettings(
  settings: WorkspaceBrowseSettingsResponse,
): { workspaceRoots: string[]; defaultBrowsePath: string } {
  const workspaceRoots = Array.isArray(settings.workspaceRoots)
    ? settings.workspaceRoots.filter(
        (root): root is string => typeof root === "string" && root.length > 0,
      )
    : [];
  const defaultBrowsePath =
    typeof settings.defaultBrowsePath === "string" &&
    settings.defaultBrowsePath.trim().length > 0
      ? settings.defaultBrowsePath
      : workspaceRoots[0] || "";

  return { workspaceRoots, defaultBrowsePath };
}
