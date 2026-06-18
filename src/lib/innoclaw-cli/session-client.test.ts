import { EventEmitter } from "node:events";
import { mkdtemp, stat } from "node:fs/promises";
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
});
