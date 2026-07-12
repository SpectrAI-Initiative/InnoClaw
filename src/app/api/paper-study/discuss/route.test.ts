import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireLocalReferenceAccess: vi.fn() }));

vi.mock("@/lib/auth/local-reference", () => ({
  requireLocalReferenceAccess: mocks.requireLocalReferenceAccess,
}));
vi.mock("@/lib/ai/provider", () => ({
  isAIAvailable: () => false,
  getConfiguredModelWithProvider: vi.fn(),
  getModelFromOverride: vi.fn(),
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireLocalReferenceAccess.mockResolvedValue(
    NextResponse.json({ error: "Path access denied" }, { status: 403 }),
  );
});

describe("POST /api/paper-study/discuss", () => {
  it("rejects a cross-user local article before discussion orchestration", async () => {
    const response = await POST(new NextRequest(
      "http://localhost/api/paper-study/discuss",
      {
        method: "POST",
        body: JSON.stringify({
          article: {
            title: "Paper",
            source: "local",
            url: "/research/users/user-b/paper.pdf",
          },
        }),
        headers: { "Content-Type": "application/json" },
      },
    ));

    expect(response.status).toBe(403);
  });
});
