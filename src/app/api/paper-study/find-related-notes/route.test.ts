import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listDirectory: vi.fn(),
  readFile: vi.fn(),
  requireWorkspaceProvisioningPathsAccess: vi.fn(),
  resolveProvisioningPath: vi.fn(),
}));

vi.mock("@/lib/auth/ownership", () => ({
  requireWorkspaceProvisioningPathsAccess:
    mocks.requireWorkspaceProvisioningPathsAccess,
}));
vi.mock("@/lib/auth/workspace-roots", () => ({
  resolveProvisioningPath: mocks.resolveProvisioningPath,
}));
vi.mock("@/lib/files/filesystem", () => ({
  listDirectory: mocks.listDirectory,
  readFile: mocks.readFile,
}));
vi.mock("@/lib/ai/provider", () => ({
  isAIAvailable: () => true,
  getConfiguredModel: vi.fn(),
  getModelFromOverride: vi.fn(),
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireWorkspaceProvisioningPathsAccess.mockResolvedValue(
    NextResponse.json({ error: "Path access denied" }, { status: 403 }),
  );
});

describe("POST /api/paper-study/find-related-notes", () => {
  it("rejects a cross-user notes directory before recursive reads", async () => {
    const response = await POST(new NextRequest(
      "http://localhost/api/paper-study/find-related-notes",
      {
        method: "POST",
        body: JSON.stringify({
          notesDir: "/research/users/user-b/notes",
          article: { title: "Paper" },
        }),
        headers: { "Content-Type": "application/json" },
      },
    ));

    expect(response.status).toBe(403);
    expect(mocks.listDirectory).not.toHaveBeenCalled();
    expect(mocks.readFile).not.toHaveBeenCalled();
  });
});
