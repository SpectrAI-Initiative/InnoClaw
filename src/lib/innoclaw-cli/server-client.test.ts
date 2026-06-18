import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();
const delayMock = vi.fn(() => Promise.resolve());

function jsonResponse(status: number, body: unknown) {
  return {
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  };
}

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
      .mockResolvedValueOnce(jsonResponse(
        200,
        {
          user: { id: "user-1" },
          authMode: "disabled",
        },
      ));
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

  it("does not treat an arbitrary login page as a reachable InnoClaw server", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      json: async () => {
        throw new SyntaxError("Unexpected token '<'");
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { ensureServerReady } = await import("../../../plugins/innoclaw-cli/src/server-client.mjs");

    await expect(ensureServerReady({
      appRoot: "/tmp/innoclaw-app",
      baseUrl: "https://example.com",
      autoStart: false,
      waitTimeoutMs: 1_000,
    })).rejects.toThrow("InnoClaw is not reachable at https://example.com");

    expect(spawnMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/api/auth/me", expect.any(Object));
  });

  it("rejects text responses even when the body looks like a valid auth probe", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ "content-type": "text/plain" }),
      json: async () => ({
        user: { id: "user-1" },
        authMode: "disabled",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { ensureServerReady } = await import("../../../plugins/innoclaw-cli/src/server-client.mjs");

    await expect(ensureServerReady({
      appRoot: "/tmp/innoclaw-app",
      baseUrl: "https://example.com",
      autoStart: false,
      waitTimeoutMs: 1_000,
    })).rejects.toThrow("InnoClaw is not reachable at https://example.com");

    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("accepts an authenticated InnoClaw auth probe", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      200,
      {
        user: { id: "user-1", email: "dev@example.com" },
        authMode: "oauth",
      },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const { ensureServerReady } = await import("../../../plugins/innoclaw-cli/src/server-client.mjs");

    await expect(ensureServerReady({
      appRoot: "/tmp/innoclaw-app",
      baseUrl: "http://localhost:3000",
      waitTimeoutMs: 1_000,
    })).resolves.toBeUndefined();

    expect(spawnMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000/api/auth/me", expect.any(Object));
  });

  it("accepts an unauthenticated InnoClaw auth probe", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: "Unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);

    const { ensureServerReady } = await import("../../../plugins/innoclaw-cli/src/server-client.mjs");

    await expect(ensureServerReady({
      appRoot: "/tmp/innoclaw-app",
      baseUrl: "http://localhost:3000",
      waitTimeoutMs: 1_000,
    })).resolves.toBeUndefined();

    expect(spawnMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000/api/auth/me", expect.any(Object));
  });

  it("accepts a local server that is reachable on 127.0.0.1 when localhost fetch fails", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("localhost unavailable"))
      .mockResolvedValueOnce(jsonResponse(
        200,
        {
          user: { id: "user-1" },
          authMode: "disabled",
        },
      ));
    vi.stubGlobal("fetch", fetchMock);

    const { ensureServerReady } = await import("../../../plugins/innoclaw-cli/src/server-client.mjs");

    await expect(ensureServerReady({
      appRoot: "/tmp/innoclaw-app",
      baseUrl: "http://localhost:3000",
      waitTimeoutMs: 1_000,
    })).resolves.toBeUndefined();

    expect(spawnMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:3000/api/auth/me", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://127.0.0.1:3000/api/auth/me", expect.any(Object));
  });
});

describe("dev-start.sh", () => {
  it("requires the auth probe to return JSON with an InnoClaw auth shape", async () => {
    const script = await readFile("dev-start.sh", "utf8");
    const serverResponding = script.slice(
      script.indexOf("server_responding() {"),
      script.indexOf("pid_elapsed_seconds() {"),
    );

    expect(serverResponding).toContain("application/json");
    expect(serverResponding).toContain("authMode");
    expect(serverResponding).toContain("user");
    expect(serverResponding).toContain("Unauthorized");
  });

  it("keeps the unrelated occupied-port branch fail-fast without killing processes", async () => {
    const script = await readFile("dev-start.sh", "utf8");
    const portConflictBranch = script.slice(
      script.indexOf("if check_port $PORT; then"),
      script.indexOf("# Install dependencies if needed"),
    );
    const unrelatedPortBranch = portConflictBranch.slice(
      portConflictBranch.indexOf("echo \"Error: Port $PORT is already in use"),
      portConflictBranch.indexOf("exit 1") + "exit 1".length,
    );

    expect(unrelatedPortBranch).toContain("exit 1");
    expect(unrelatedPortBranch).not.toContain("kill");
    expect(unrelatedPortBranch).not.toContain("npm");
    expect(unrelatedPortBranch).not.toContain("npx");
  });
});
