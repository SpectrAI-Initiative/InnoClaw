import os from "os";

/**
 * Build a sanitized environment object for child process execution.
 * Provides cross-platform defaults for Windows, macOS, and Linux.
 */
export function buildSafeExecEnv(
  extra?: Record<string, string | undefined>
): NodeJS.ProcessEnv {
  const base: NodeJS.ProcessEnv = {
    PATH:
      process.env.PATH ||
      (process.platform === "win32"
        ? "C:\\Windows\\system32;C:\\Windows"
        : "/usr/local/bin:/usr/bin:/bin"),
    HOME: process.env.HOME || process.env.USERPROFILE || os.homedir(),
    NODE_ENV: process.env.NODE_ENV || "production",
    TERM: "dumb",
    LANG: process.env.LANG || "en_US.UTF-8",
  };

  // Windows requires additional system environment variables
  if (process.platform === "win32") {
    base.SYSTEMROOT = process.env.SYSTEMROOT || process.env.SystemRoot;
    base.COMSPEC = process.env.COMSPEC;
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
