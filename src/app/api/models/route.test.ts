import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Unit tests for the /api/models route helper functions.
 *
 * We import the route handler and test it with mocked fetch / env vars.
 */

// Provide a minimal NextRequest-compatible class for tests
class FakeNextRequest {
  nextUrl: URL;
  constructor(url: string) {
    this.nextUrl = new URL(url, "http://localhost");
  }
}

// We'll dynamically import the route after mocking globals
let GET: (req: unknown) => Promise<Response>;

describe("/api/models", () => {
  const originalEnv = { ...process.env };
  const fetchSpy = vi.fn();

  beforeEach(async () => {
    // Reset env
    process.env = { ...originalEnv };

    // Mock global fetch used inside the route handler
    vi.stubGlobal("fetch", fetchSpy);

    // Dynamically import so env vars are read at import time
    const mod = await import("@/app/api/models/route");
    GET = mod.GET as (req: unknown) => Promise<Response>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  it("returns 400 when OPENAI_API_KEY is missing (openai provider)", async () => {
    delete process.env.OPENAI_API_KEY;

    const req = new FakeNextRequest("http://localhost/api/models?provider=openai");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("OPENAI_API_KEY");
  });

  it("returns 400 when ANTHROPIC_API_KEY is missing (anthropic provider)", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const req = new FakeNextRequest(
      "http://localhost/api/models?provider=anthropic",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("ANTHROPIC_API_KEY");
  });

  it("returns sorted models for openai provider", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_BASE_URL = "https://api.example.com/v1";

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: "gpt-4o", owned_by: "openai" },
          { id: "gpt-3.5-turbo", owned_by: "openai" },
        ],
      }),
    });

    const req = new FakeNextRequest("http://localhost/api/models?provider=openai");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.models).toEqual([
      { id: "gpt-3.5-turbo", name: "gpt-3.5-turbo" },
      { id: "gpt-4o", name: "gpt-4o" },
    ]);
  });

  it("returns sorted models for anthropic provider", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: "claude-3-opus", display_name: "Claude 3 Opus" },
          { id: "claude-2", display_name: "Claude 2" },
        ],
      }),
    });

    const req = new FakeNextRequest(
      "http://localhost/api/models?provider=anthropic",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.models).toEqual([
      { id: "claude-2", name: "Claude 2" },
      { id: "claude-3-opus", name: "Claude 3 Opus" },
    ]);
  });

  it("returns 502 when upstream provider returns error", async () => {
    process.env.OPENAI_API_KEY = "sk-test";

    fetchSpy.mockResolvedValueOnce({ ok: false, status: 500 });

    const req = new FakeNextRequest("http://localhost/api/models");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toContain("500");
  });

  it("handles empty data array gracefully", async () => {
    process.env.OPENAI_API_KEY = "sk-test";

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const req = new FakeNextRequest("http://localhost/api/models");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.models).toEqual([]);
  });

  it("handles missing data field gracefully", async () => {
    process.env.OPENAI_API_KEY = "sk-test";

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const req = new FakeNextRequest("http://localhost/api/models");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.models).toEqual([]);
  });

  it("constructs correct URL when OPENAI_BASE_URL already has /v1", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_BASE_URL = "https://custom.api.com/v1";

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const req = new FakeNextRequest("http://localhost/api/models");
    await GET(req);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://custom.api.com/v1/models",
      expect.objectContaining({
        headers: { Authorization: "Bearer sk-test" },
      }),
    );
  });

  it("constructs correct URL when OPENAI_BASE_URL lacks /v1", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_BASE_URL = "https://custom.api.com";

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const req = new FakeNextRequest("http://localhost/api/models");
    await GET(req);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://custom.api.com/v1/models",
      expect.objectContaining({
        headers: { Authorization: "Bearer sk-test" },
      }),
    );
  });
});
