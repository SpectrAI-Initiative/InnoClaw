import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

describe("innoclaw-cli session client", () => {
  beforeEach(() => {
    spawnMock.mockReset();
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
});
