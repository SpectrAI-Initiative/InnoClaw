import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

class FakeNextRequest {
  nextUrl: URL;
  constructor(url: string) {
    this.nextUrl = new URL(url, "http://localhost");
  }
}

let GET: (req: unknown) => Promise<Response>;

describe("/api/models", () => {
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/app/api/models/route");
    GET = mod.GET as (req: unknown) => Promise<Response>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the managed DeepSeek catalog by default", async () => {
    const req = new FakeNextRequest("http://localhost/api/models");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.models).toEqual([
      { id: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash" },
      { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
    ]);
  });

  it("rejects archived providers", async () => {
    const req = new FakeNextRequest("http://localhost/api/models?provider=openai");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("archived");
  });

  it("rejects unknown providers", async () => {
    const req = new FakeNextRequest("http://localhost/api/models?provider=qwen");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("archived");
  });
});
