import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  extractPaperFullContent: vi.fn(),
  requireLocalReferenceAccess: vi.fn(),
}));

vi.mock("@/lib/auth/local-reference", () => ({
  requireLocalReferenceAccess: mocks.requireLocalReferenceAccess,
}));
vi.mock("@/lib/ai/provider", () => ({
  isAIAvailable: () => false,
  getConfiguredModel: vi.fn(),
  getModelFromOverride: vi.fn(),
}));
vi.mock("../extract-paper-text", () => ({
  extractPaperFullContent: mocks.extractPaperFullContent,
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireLocalReferenceAccess.mockResolvedValue(
    NextResponse.json({ error: "Path access denied" }, { status: 403 }),
  );
});

describe("POST /api/paper-study/quick-summary", () => {
  it("rejects a cross-user local article before extraction or AI", async () => {
    const response = await POST(new NextRequest(
      "http://localhost/api/paper-study/quick-summary",
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
    expect(mocks.extractPaperFullContent).not.toHaveBeenCalled();
  });
});
