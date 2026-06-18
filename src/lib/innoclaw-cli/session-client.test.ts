import { EventEmitter } from "node:events";
import { chmod, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

describe("innoclaw-cli session client", () => {
  beforeEach(() => {
    spawnMock.mockReset();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock("node:fs/promises");
  });

  it("reports browser launch failure when the launcher emits an async error", async () => {
    const child = new EventEmitter() as EventEmitter & { unref: ReturnType<typeof vi.fn> };
    child.unref = vi.fn();
    spawnMock.mockImplementation(() => {
      queueMicrotask(() => {
        child.emit("error", Object.assign(new Error("not found"), { code: "ENOENT" }));
      });
      return child;
    });

    const { openBrowser } = await import("../../../plugins/innoclaw-cli/src/session-client.mjs");

    await expect(openBrowser("http://localhost:3000/login", { settleMs: 1 })).resolves.toBe(false);
    expect(child.unref).not.toHaveBeenCalled();
  });

  it("persists sessions with private POSIX permissions", async () => {
    if (process.platform === "win32") {
      return;
    }

    const homeDir = await mkdtemp(path.join(os.tmpdir(), "innoclaw-cli-session-"));
    vi.spyOn(os, "homedir").mockReturnValue(homeDir);
    const { createSessionManager } = await import("../../../plugins/innoclaw-cli/src/session-client.mjs");
    const manager = createSessionManager("http://localhost:3000", () => ({
      requestJson: vi.fn(),
    }));

    await manager.save({
      cookies: {
        innoclaw_session: "token-123",
        innoclaw_session_expires: "2026-06-20T00:00:00.000Z",
        innoclaw_session_sig: "sig-123",
      },
      expiresAt: "2026-06-20T00:00:00.000Z",
      updatedAt: "2026-06-18T00:00:00.000Z",
    });

    const sessionDirMode = (await stat(path.join(homeDir, ".innoclaw"))).mode & 0o777;
    const sessionFileMode = (await stat(path.join(homeDir, ".innoclaw", "cli-sessions.json"))).mode & 0o777;
    expect(sessionDirMode).toBe(0o700);
    expect(sessionFileMode).toBe(0o600);
  });

  it("tightens an existing permissive POSIX session file before final save", async () => {
    if (process.platform === "win32") {
      return;
    }

    const homeDir = await mkdtemp(path.join(os.tmpdir(), "innoclaw-cli-session-"));
    const sessionDir = path.join(homeDir, ".innoclaw");
    const sessionFile = path.join(sessionDir, "cli-sessions.json");
    await mkdir(sessionDir);
    await writeFile(sessionFile, JSON.stringify({ version: 1, sessions: {} }), { encoding: "utf-8", mode: 0o666 });
    await chmod(sessionDir, 0o777);
    await chmod(sessionFile, 0o666);

    vi.spyOn(os, "homedir").mockReturnValue(homeDir);
    const { createSessionManager } = await import("../../../plugins/innoclaw-cli/src/session-client.mjs");
    const manager = createSessionManager("http://localhost:3000", () => ({
      requestJson: vi.fn(),
    }));

    await manager.save({
      cookies: {
        innoclaw_session: "token-456",
        innoclaw_session_expires: "2026-06-20T00:00:00.000Z",
        innoclaw_session_sig: "sig-456",
      },
      expiresAt: "2026-06-20T00:00:00.000Z",
      updatedAt: "2026-06-18T00:00:00.000Z",
    });

    const sessionDirMode = (await stat(sessionDir)).mode & 0o777;
    const sessionFileMode = (await stat(sessionFile)).mode & 0o777;
    const saved = JSON.parse(await readFile(sessionFile, "utf-8"));
    expect(sessionDirMode).toBe(0o700);
    expect(sessionFileMode).toBe(0o600);
    expect(saved.sessions["http://localhost:3000"].cookies.innoclaw_session).toBe("token-456");
  });

  it("does not write token material directly into an existing permissive POSIX session file", async () => {
    if (process.platform === "win32") {
      return;
    }

    const homeDir = await mkdtemp(path.join(os.tmpdir(), "innoclaw-cli-session-"));
    const sessionDir = path.join(homeDir, ".innoclaw");
    const sessionFile = path.join(sessionDir, "cli-sessions.json");
    await mkdir(sessionDir);
    await writeFile(sessionFile, JSON.stringify({ version: 1, sessions: {} }), { encoding: "utf-8", mode: 0o666 });
    await chmod(sessionDir, 0o777);
    await chmod(sessionFile, 0o666);

    const actualFs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const directWrites: string[] = [];
    vi.doMock("node:fs/promises", () => ({
      ...actualFs,
      writeFile: vi.fn(async (file: Parameters<typeof writeFile>[0], data: Parameters<typeof writeFile>[1], options) => {
        if (path.resolve(String(file)) === path.resolve(sessionFile) && String(data).includes("token-direct-write")) {
          directWrites.push(String(file));
        }
        return actualFs.writeFile(file, data, options);
      }),
    }));

    vi.spyOn(os, "homedir").mockReturnValue(homeDir);
    const { createSessionManager } = await import("../../../plugins/innoclaw-cli/src/session-client.mjs");
    const manager = createSessionManager("http://localhost:3000", () => ({
      requestJson: vi.fn(),
    }));

    const beforeStat = await stat(sessionFile);
    await manager.save({
      cookies: {
        innoclaw_session: "token-direct-write",
        innoclaw_session_expires: "2026-06-20T00:00:00.000Z",
        innoclaw_session_sig: "sig-direct-write",
      },
      expiresAt: "2026-06-20T00:00:00.000Z",
      updatedAt: "2026-06-18T00:00:00.000Z",
    });
    const afterStat = await stat(sessionFile);

    expect(directWrites).toEqual([]);
    expect(afterStat.ino).not.toBe(beforeStat.ino);
    expect(afterStat.mode & 0o777).toBe(0o600);
  });
});
