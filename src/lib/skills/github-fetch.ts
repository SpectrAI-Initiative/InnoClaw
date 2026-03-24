import {
  buildGitHubBranchCandidates,
  buildGitHubSingleFileCandidates,
  getGitHubFallbackSlug,
  parseGitHubUrl,
} from "./github-import";
import { parseSkillMd } from "@/lib/db/skills-insert";

export const MAX_FETCH_BYTES = 1_000_000; // 1 MB safety limit

export interface PluginContentFile {
  path: string;
  fallbackSlug: string;
}

export interface PreviewSkillItem {
  path: string;
  fallbackSlug: string;
  name: string;
  slug: string;
  description: string | null;
}

export function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  const githubToken = process.env.GITHUB_TOKEN;
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }
  return headers;
}

export async function fetchGitHubDefaultBranch(
  owner: string,
  repo: string
): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: getGitHubHeaders(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { default_branch?: unknown };
    return typeof data.default_branch === "string" && data.default_branch.trim()
      ? data.default_branch.trim()
      : null;
  } catch {
    return null;
  }
}

export async function fetchRaw(
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): Promise<string | null> {
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const timeout = 15_000 + attempt * 10_000;
      const res = await fetch(rawUrl, { signal: AbortSignal.timeout(timeout) });
      if (!res.ok) {
        if (res.status === 404) return null;
        console.error("Failed to fetch GitHub raw file: non-OK response", {
          url: rawUrl,
          status: res.status,
          attempt,
        });
        continue;
      }

      const contentLengthHeader = res.headers.get("content-length");
      if (contentLengthHeader) {
        const contentLength = Number.parseInt(contentLengthHeader, 10);
        if (!Number.isNaN(contentLength) && contentLength > MAX_FETCH_BYTES) {
          return null;
        }
      }

      const text = await res.text();
      if (text.length > MAX_FETCH_BYTES) return null;
      return text;
    } catch (error) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
        continue;
      }
      console.error("Failed to fetch GitHub raw file after retries", {
        url: rawUrl,
        error,
      });
      return null;
    }
  }
  return null;
}

/** Discover importable content (skills, commands, agents) from a GitHub repo */
export async function discoverPluginContent(
  owner: string,
  repo: string,
  branch: string,
  basePath: string
): Promise<PluginContentFile[]> {
  const headers = getGitHubHeaders();
  const normalizedBasePath = basePath.replace(/^\/+|\/+$/g, "");

  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  try {
    const res = await fetch(treeUrl, {
      headers,
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];

    const data: {
      tree?: Array<{ path: string; type: string }>;
      truncated?: boolean;
    } = await res.json();
    if (!data.tree) return [];

    const results: PluginContentFile[] = [];

    for (const item of data.tree) {
      if (item.type !== "blob") continue;
      const p = item.path;

      if (
        normalizedBasePath &&
        p !== normalizedBasePath &&
        !p.startsWith(`${normalizedBasePath}/`)
      ) {
        continue;
      }

      if (p === "SKILL.md") {
        results.push({ path: p, fallbackSlug: repo });
        continue;
      }

      const skillMatch = p.match(/(?:^|\/)skills\/([^/]+)\/SKILL\.md$/);
      if (skillMatch) {
        results.push({ path: p, fallbackSlug: skillMatch[1] });
        continue;
      }

      const cmdMatch = p.match(/(?:^|\/)commands\/([^/]+)\.md$/);
      if (cmdMatch) {
        results.push({ path: p, fallbackSlug: cmdMatch[1] });
        continue;
      }

      if (
        /(?:^|\/)agents\/[^/]+\.md$/.test(p) &&
        !/(?:^|\/)skills\/[^/]+\/agents\//.test(p)
      ) {
        const agentSlug = p.match(/(?:^|\/)agents\/([^/]+)\.md$/)?.[1];
        if (agentSlug) {
          results.push({ path: p, fallbackSlug: agentSlug });
        }
      }
    }

    return results;
  } catch (error) {
    console.error("[skills/import] GitHub tree API failed:", error);
    return [];
  }
}

/** Batch helper: process items with a concurrency limit */
export async function batchProcess<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

/**
 * Resolve a GitHub URL to its branch and discover content files.
 * Returns null if the URL can't be parsed or no content is found for single-file paths.
 */
export async function resolveGitHubRepo(url: string): Promise<{
  owner: string;
  repo: string;
  branch: string;
  contentFiles: PluginContentFile[];
  singleFile: { path: string; content: string; fallbackSlug: string } | null;
} | null> {
  const gh = parseGitHubUrl(url);
  if (!gh) return null;

  const defaultBranch = gh.branch
    ? null
    : await fetchGitHubDefaultBranch(gh.owner, gh.repo);
  const branchCandidates = buildGitHubBranchCandidates(
    gh.branch,
    defaultBranch
  );

  for (const branch of branchCandidates) {
    // Try single file first
    for (const singlePath of buildGitHubSingleFileCandidates(gh.path)) {
      const content = await fetchRaw(gh.owner, gh.repo, branch, singlePath);
      if (!content) continue;
      const parsed = parseSkillMd(
        content,
        getGitHubFallbackSlug(singlePath, gh.repo)
      );
      if (!parsed) continue;
      return {
        owner: gh.owner,
        repo: gh.repo,
        branch,
        contentFiles: [],
        singleFile: {
          path: singlePath,
          content,
          fallbackSlug: getGitHubFallbackSlug(singlePath, gh.repo),
        },
      };
    }

    // Try discovering multiple files
    const contentFiles = await discoverPluginContent(
      gh.owner,
      gh.repo,
      branch,
      gh.path
    );
    if (contentFiles.length > 0) {
      return {
        owner: gh.owner,
        repo: gh.repo,
        branch,
        contentFiles,
        singleFile: null,
      };
    }
  }

  return null;
}
