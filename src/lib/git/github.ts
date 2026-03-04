import { execFile } from "child_process";
import { promisify } from "util";
import { validatePath } from "@/lib/files/filesystem";

const execFileAsync = promisify(execFile);

/**
 * Clone a GitHub repository into a target directory.
 * Supports private repos via GITHUB_TOKEN.
 */
export async function cloneRepo(
  repoUrl: string,
  targetPath: string
): Promise<void> {
  validatePath(targetPath);

  const token = process.env.GITHUB_TOKEN;

  // Inject token into URL for private repo access
  let authenticatedUrl = repoUrl;
  if (token && repoUrl.startsWith("https://github.com/")) {
    authenticatedUrl = repoUrl.replace(
      "https://github.com/",
      `https://${token}@github.com/`
    );
  }

  await execFileAsync("git", ["clone", authenticatedUrl, targetPath], {
    timeout: 300000, // 5 minute timeout
  });
}

/**
 * Pull latest changes in a git repository.
 */
export async function pullRepo(repoPath: string): Promise<string> {
  validatePath(repoPath);

  const { stdout } = await execFileAsync("git", ["-C", repoPath, "pull"], {
    timeout: 120000, // 2 minute timeout
  });

  return stdout.trim();
}

/**
 * Get the current git status of a repository.
 */
export async function getGitStatus(repoPath: string): Promise<{
  isGitRepo: boolean;
  branch: string | null;
  clean: boolean;
  modified: string[];
  ahead: number;
  behind: number;
}> {
  try {
    validatePath(repoPath);

    // Check if it's a git repo
    await execFileAsync("git", ["-C", repoPath, "rev-parse", "--git-dir"]);

    // Get current branch
    const { stdout: branchOutput } = await execFileAsync(
      "git",
      ["-C", repoPath, "rev-parse", "--abbrev-ref", "HEAD"],
      { timeout: 5000 }
    );
    const branch = branchOutput.trim();

    // Get status
    const { stdout: statusOutput } = await execFileAsync(
      "git",
      ["-C", repoPath, "status", "--porcelain"],
      { timeout: 5000 }
    );
    const modified = statusOutput
      .split("\n")
      .filter(Boolean)
      .map((line) => line.trim());

    // Get ahead/behind (may fail if no upstream)
    let ahead = 0;
    let behind = 0;
    try {
      const { stdout: revListOutput } = await execFileAsync(
        "git",
        ["-C", repoPath, "rev-list", "--left-right", "--count", "HEAD...@{u}"],
        { timeout: 5000 }
      );
      const parts = revListOutput.trim().split(/\s+/);
      ahead = parseInt(parts[0]) || 0;
      behind = parseInt(parts[1]) || 0;
    } catch {
      // No upstream configured
    }

    return {
      isGitRepo: true,
      branch,
      clean: modified.length === 0,
      modified,
      ahead,
      behind,
    };
  } catch {
    return {
      isGitRepo: false,
      branch: null,
      clean: true,
      modified: [],
      ahead: 0,
      behind: 0,
    };
  }
}
