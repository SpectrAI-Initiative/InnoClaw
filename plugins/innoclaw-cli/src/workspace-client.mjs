import path from "node:path";
import { getWorkspaceName } from "./runtime.mjs";

export async function ensureWorkspace(apiClient, folderPath, explicitName) {
  const resolved = path.resolve(folderPath);
  const { payload: workspaces } = await apiClient.requestJson("/api/workspaces");
  const existing = Array.isArray(workspaces)
    ? workspaces.find((workspace) => workspace.folderPath === resolved)
    : null;

  if (existing) {
    return existing;
  }

  const { payload } = await apiClient.requestJson("/api/workspaces", {
    method: "POST",
    body: {
      name: explicitName || getWorkspaceName(resolved),
      folderPath: resolved,
    },
  });
  return payload;
}
