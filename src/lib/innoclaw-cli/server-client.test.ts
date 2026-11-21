import { beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(status: number, body: unknown) {
  return {
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  };
}

describe("innoclaw-cli ensureServerReady", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
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
      baseUrl: "https://example.com",
    })).rejects.toThrow("InnoClaw is not reachable at https://example.com");

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
      baseUrl: "https://example.com",
    })).rejects.toThrow("InnoClaw is not reachable at https://example.com");
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
      baseUrl: "http://localhost:3000",
    })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000/api/auth/me", expect.any(Object));
  });

  it("accepts an unauthenticated InnoClaw auth probe", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: "Unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);

    const { ensureServerReady } = await import("../../../plugins/innoclaw-cli/src/server-client.mjs");

    await expect(ensureServerReady({
      baseUrl: "http://localhost:3000",
    })).resolves.toBeUndefined();

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
      baseUrl: "http://localhost:3000",
    })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:3000/api/auth/me", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://127.0.0.1:3000/api/auth/me", expect.any(Object));
  });

  it("tells the caller to start the container when nothing is listening", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);

    const { ensureServerReady } = await import("../../../plugins/innoclaw-cli/src/server-client.mjs");

    await expect(ensureServerReady({
      baseUrl: "http://localhost:3000",
    })).rejects.toThrow("scripts/docker-up-local.ps1 or scripts/docker-up-local.sh");
  });
});
