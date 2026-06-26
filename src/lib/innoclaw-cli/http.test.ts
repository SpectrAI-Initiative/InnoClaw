import { beforeEach, describe, expect, it, vi } from "vitest";

describe("innoclaw-cli http client", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("retries local requests on 127.0.0.1 when localhost fetch fails", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("localhost unavailable"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { createApiClient } = await import("../../../plugins/innoclaw-cli/src/http.mjs");
    const client = createApiClient({ baseUrl: "http://localhost:3000" });
    const { payload } = await client.requestJson("/api/workspaces");

    expect(payload).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:3000/api/workspaces", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://127.0.0.1:3000/api/workspaces", expect.any(Object));
  });
});
