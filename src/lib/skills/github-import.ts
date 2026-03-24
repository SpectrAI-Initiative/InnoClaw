export interface GitHubUrlParts {
  owner: string;
  repo: string;
  branch: string | null;
  path: string;
  source: "repo" | "tree" | "blob" | "raw";
}

function stripRepoSuffix(repo: string): string {
  return repo.replace(/\.git$/i, "");
}

function splitPathname(pathname: string): string[] {
  return pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function isGitHubUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host === "github.com" || host === "www.github.com" || host === "raw.githubusercontent.com";
  } catch {
    return false;
  }
}

export function parseGitHubUrl(url: string): GitHubUrlParts | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const parts = splitPathname(parsed.pathname);

    if (host === "raw.githubusercontent.com") {
      if (parts.length < 4) return null;
      const [owner, repo, branch, ...rest] = parts;
      return {
        owner,
        repo: stripRepoSuffix(repo),
        branch,
        path: rest.join("/"),
        source: "raw",
      };
    }

    if (host !== "github.com" && host !== "www.github.com") {
      return null;
    }

    if (parts.length < 2) return null;
    const owner = parts[0];
    const repo = stripRepoSuffix(parts[1]);

    if (parts.length === 2) {
      return { owner, repo, branch: null, path: "", source: "repo" };
    }

    const mode = parts[2];
    if ((mode === "tree" || mode === "blob") && parts.length >= 4) {
      return {
        owner,
        repo,
        branch: parts[3],
        path: parts.slice(4).join("/"),
        source: mode,
      };
    }

    return {
      owner,
      repo,
      branch: null,
      path: parts.slice(2).join("/"),
      source: "repo",
    };
  } catch {
    return null;
  }
}

export function buildGitHubBranchCandidates(
  explicitBranch: string | null,
  defaultBranch: string | null
): string[] {
  const seen = new Set<string>();
  const branches = [explicitBranch, defaultBranch, "main", "master"];
  const result: string[] = [];

  for (const branch of branches) {
    const normalized = branch?.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function buildGitHubSingleFileCandidates(path: string): string[] {
  const normalized = path.replace(/^\/+|\/+$/g, "");
  if (!normalized) {
    return ["SKILL.md"];
  }
  if (/\.md$/i.test(normalized)) {
    return [normalized];
  }
  return [`${normalized}/SKILL.md`];
}

export function getGitHubFallbackSlug(path: string, repo: string): string {
  const normalized = path.replace(/\/+$/g, "");
  const segments = normalized.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || repo;
  if (/^SKILL\.md$/i.test(last) && segments.length >= 2) {
    return segments[segments.length - 2];
  }
  return last.replace(/\.md$/i, "") || repo;
}
