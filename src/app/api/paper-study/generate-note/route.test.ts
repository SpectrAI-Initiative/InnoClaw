import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireLocalReferenceAccess: vi.fn(),
  requireWorkspaceProvisioningPathsAccess: vi.fn(),
  resolveProvisioningPath: vi.fn(),
}));

vi.mock("@/lib/auth/local-reference", () => ({
  requireLocalReferenceAccess: mocks.requireLocalReferenceAccess,
}));
vi.mock("@/lib/auth/ownership", () => ({
  requireWorkspaceProvisioningPathsAccess:
    mocks.requireWorkspaceProvisioningPathsAccess,
}));
vi.mock("@/lib/auth/workspace-roots", () => ({
  resolveProvisioningPath: mocks.resolveProvisioningPath,
}));
vi.mock("@/lib/ai/provider", () => ({
  isAIAvailable: () => false,
  getConfiguredModel: vi.fn(),
  getModelFromOverride: vi.fn(),
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireWorkspaceProvisioningPathsAccess.mockResolvedValue({
    auth: { user: { id: "user-a" } },
    canonicalPaths: ["/research/users/user-a/notes"],
  });
  mocks.requireLocalReferenceAccess.mockResolvedValue(
    NextResponse.json({ error: "Path access denied" }, { status: 403 }),
  );
});

describe("POST /api/paper-study/generate-note", () => {
  it("rejects a cross-user local article before extraction or writes", async () => {
    const response = await POST(new NextRequest(
      "http://localhost/api/paper-study/generate-note",
      {
        method: "POST",
        body: JSON.stringify({
          notesDir: "/research/users/user-a/notes",
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

  it("rejects a nested output symlink escape before checking AI availability", async () => {
    mocks.requireLocalReferenceAccess.mockResolvedValue({
      canonicalReference: "https://example.com/paper.pdf",
    });
    mocks.resolveProvisioningPath.mockImplementation(() => {
      throw new Error("Path is outside the allowed roots");
    });

    const response = await POST(new NextRequest(
      "http://localhost/api/paper-study/generate-note",
      {
        method: "POST",
        body: JSON.stringify({
          notesDir: "/research/users/user-a/notes",
          article: {
            title: "Paper Method",
            source: "remote",
            url: "https://example.com/paper.pdf",
          },
        }),
        headers: { "Content-Type": "application/json" },
      },
    ));

    expect(response.status).toBe(403);
  });
});
