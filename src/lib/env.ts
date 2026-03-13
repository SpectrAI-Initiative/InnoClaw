import os from "os";
import path from "path";

/**
 * Resolve the user's home directory in a cross-platform way.
 * Works on Windows (USERPROFILE), macOS, and Linux (HOME).
 */
export function resolveHome(): string {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

/**
 * Ensure common user-local binary directories are included in PATH so that
 * tools installed outside the system PATH (e.g. kubectl in ~/.local/bin or
 * the project config/ dir) are discoverable by child processes.
 */
function ensureExtraPaths(basePath: string): string {
  if (process.platform === "win32") return basePath;
  const home = resolveHome();
  const extras = [path.join(home, ".local", "bin")];
  // Python paths: macOS Python.org framework installs & common locations
  if (process.platform === "darwin") {
    extras.push(
      "/Library/Frameworks/Python.framework/Versions/Current/bin",
      "/opt/homebrew/bin"
    );
  }
  const existing = new Set(basePath.split(":"));
  const missing = extras.filter((p) => !existing.has(p));
  return missing.length > 0 ? [...missing, basePath].join(":") : basePath;
}

/**
 * Build a sanitized environment object for child process execution.
 * Provides cross-platform defaults for Windows, macOS, and Linux.
 */
export function buildSafeExecEnv(
  extra?: Record<string, string | undefined>
): NodeJS.ProcessEnv {
  const base: NodeJS.ProcessEnv = {
    PATH:
      ensureExtraPaths(
        process.env.PATH ||
        (process.platform === "win32"
          ? "C:\\Windows\\system32;C:\\Windows"
          : "/usr/local/bin:/usr/bin:/bin")
      ),
    HOME: resolveHome(),
    NODE_ENV: process.env.NODE_ENV || "production",
    TERM: "dumb",
    LANG: process.env.LANG || "en_US.UTF-8",
  };

  // Windows requires additional system environment variables
  if (process.platform === "win32") {
    base.SYSTEMROOT = process.env.SYSTEMROOT || "C:\\Windows";
    base.COMSPEC = process.env.COMSPEC || "C:\\Windows\\system32\\cmd.exe";
    base.PATHEXT =
      process.env.PATHEXT ||
      ".COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC";
    base.TEMP = process.env.TEMP || os.tmpdir();
    base.TMP = process.env.TMP || os.tmpdir();
    base.USERPROFILE = process.env.USERPROFILE || os.homedir();
  }

  if (extra) {
    Object.assign(base, extra);
  }

  return base;
}
