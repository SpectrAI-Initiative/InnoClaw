import type { HfRepoInfo, HfRepoType } from "@/types";

/**
 * Fetch repo info from ModelScope API.
 */
export async function getModelScopeRepoInfo(
  repoId: string,
  repoType: HfRepoType = "dataset"
): Promise<HfRepoInfo> {
  const apiUrl = repoType === "model"
    ? `https://modelscope.cn/api/v1/models/${repoId}`
    : `https://modelscope.cn/api/v1/datasets/${repoId}`;

  const res = await fetch(apiUrl);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Repository not found on ModelScope: ${repoId}`);
    }
    throw new Error(`Failed to fetch ModelScope repo info: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const data = json.Data;

  return {
    repoId,
    repoType,
    description: data?.Description || data?.ChineseName || null,
    totalSize: null,
    totalFiles: data?.Files?.length ?? 0,
    lastModified: data?.LastUpdatedDate || data?.GmtModified || null,
  };
}

/**
 * List files in a ModelScope repo.
 */
export async function listModelScopeFiles(
  repoId: string,
  repoType: HfRepoType = "dataset",
  revision?: string
): Promise<{ path: string; size: number }[]> {
  const rev = revision || "master";
  const apiUrl = repoType === "model"
    ? `https://modelscope.cn/api/v1/models/${repoId}/repo/files?Revision=${encodeURIComponent(rev)}&Recursive=true`
    : `https://modelscope.cn/api/v1/datasets/${repoId}/repo/files?Revision=${encodeURIComponent(rev)}&Recursive=true`;

  const res = await fetch(apiUrl);
  if (!res.ok) {
    throw new Error(`Failed to list ModelScope files: ${res.status}`);
  }

  const json = await res.json();
  const fileList = json.Data?.Files || [];

  return fileList
    .filter((f: { Type: string }) => f.Type === "blob")
    .map((f: { Path: string; Size: number }) => ({
      path: f.Path,
      size: f.Size ?? 0,
    }));
}

/**
 * Get download URL for a single file from ModelScope.
 */
export function getModelScopeDownloadUrl(
  repoId: string,
  filePath: string,
  repoType: HfRepoType = "dataset",
  revision: string = "master"
): string {
  if (repoType === "model") {
    return `https://modelscope.cn/models/${repoId}/resolve/${encodeURIComponent(revision)}/${encodeURIComponent(filePath)}`;
  }
  return `https://modelscope.cn/datasets/${repoId}/resolve/${encodeURIComponent(revision)}/${encodeURIComponent(filePath)}`;
}
