import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();
const delayMock = vi.fn(() => Promise.resolve());

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

vi.mock("node:timers/promises", () => ({
  setTimeout: delayMock,
}));

describe("innoclaw-cli ensureServerReady", () => {
  beforeEach(() => {
    spawnMock.mockReset();
    delayMock.mockClear();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("keeps polling when dev-start exits non-zero but the server becomes reachable", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("booting"))
      .mockResolvedValueOnce({ status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    spawnMock.mockImplementation(() => {
      const child = new EventEmitter();
      queueMicrotask(() => {
        child.emit("exit", 1);
      });
      return child;
    });

    const { ensureServerReady } = await import("../../../plugins/innoclaw-cli/src/server-client.mjs");

    await expect(ensureServerReady({
      appRoot: "/tmp/innoclaw-app",
      baseUrl: "http://localhost:3000",
      waitTimeoutMs: 5_000,
    })).resolves.toBeUndefined();

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("accepts a local server that is reachable on 127.0.0.1 when localhost fetch fails", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("localhost unavailable"))
      .mockResolvedValueOnce({ status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const { ensureServerReady } = await import("../../../plugins/innoclaw-cli/src/server-client.mjs");

    await expect(ensureServerReady({
      appRoot: "/tmp/innoclaw-app",
      baseUrl: "http://localhost:3000",
      waitTimeoutMs: 1_000,
    })).resolves.toBeUndefined();

    expect(spawnMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:3000/login", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://127.0.0.1:3000/login", expect.any(Object));
  });
});
