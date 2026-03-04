import { listFiles } from "@huggingface/hub";
import type { HfRepoInfo, HfRepoType } from "@/types";
import { getHfToken } from "./token";

function getCredentials(token?: string): { accessToken: string } | undefined {
  return token ? { accessToken: token } : undefined;
}

/**
 * Fetch basic repo metadata from HuggingFace Hub.
 */
export async function getRepoInfo(
  repoId: string,
  repoType: HfRepoType = "dataset",
  token?: string
): Promise<HfRepoInfo> {
  const resolvedToken = token || (await getHfToken());
  const credentials = getCredentials(resolvedToken);

  // Use the HF API directly for repo-level info
  const apiUrl = repoType === "model"
    ? `https://huggingface.co/api/models/${repoId}`
    : repoType === "space"
      ? `https://huggingface.co/api/spaces/${repoId}`
      : `https://huggingface.co/api/datasets/${repoId}`;

  const headers: Record<string, string> = {};
  if (credentials) {
    headers["Authorization"] = `Bearer ${credentials.accessToken}`;
  }

  const res = await fetch(apiUrl, { headers });
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Repository not found: ${repoId}`);
    }
    throw new Error(`Failed to fetch repo info: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  // Count files via listFiles
  let totalFiles = 0;
  let totalSize = 0;
  try {
    for await (const file of listFiles({
      repo: { type: repoType, name: repoId },
      revision: "main",
      recursive: true,
      credentials,
    })) {
      if (file.type === "file") {
        totalFiles++;
        totalSize += file.size ?? 0;
      }
    }
  } catch {
    // If listing fails (e.g. gated repo), use data from API
    totalFiles = data.siblings?.length ?? 0;
    totalSize = 0;
  }

  return {
    repoId,
    repoType,
    description: data.description ?? data.cardData?.description ?? null,
    totalSize: totalSize || null,
    totalFiles,
    lastModified: data.lastModified ?? null,
  };
}

/**
 * List all files in a HuggingFace repo with their sizes.
 */
export async function listRepoFiles(
  repoId: string,
  repoType: HfRepoType = "dataset",
  revision?: string,
  token?: string
): Promise<{ path: string; size: number }[]> {
  const resolvedToken = token || (await getHfToken());
  const credentials = getCredentials(resolvedToken);
  const files: { path: string; size: number }[] = [];

  for await (const file of listFiles({
    repo: { type: repoType, name: repoId },
    revision: revision || "main",
    recursive: true,
    credentials,
  })) {
    if (file.type === "file") {
      files.push({
        path: file.path,
        size: file.size ?? 0,
      });
    }
  }

  return files;
}

/**
 * Validate that a repo exists and is accessible.
 */
export async function validateRepoExists(
  repoId: string,
  repoType: HfRepoType = "dataset",
  token?: string
): Promise<boolean> {
  try {
    await getRepoInfo(repoId, repoType, token);
    return true;
  } catch {
    return false;
  }
}
