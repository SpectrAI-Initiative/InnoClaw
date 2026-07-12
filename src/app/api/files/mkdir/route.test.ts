import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createDirectory: vi.fn(),
  requirePathAccess: vi.fn(),
  requireWorkspaceProvisioningPathsAccess: vi.fn(),
}));

vi.mock("@/lib/files/filesystem", () => ({
  createDirectory: mocks.createDirectory,
}));

vi.mock("@/lib/auth/ownership", () => ({
  requirePathAccess: mocks.requirePathAccess,
  requireWorkspaceProvisioningPathsAccess:
    mocks.requireWorkspaceProvisioningPathsAccess,
}));

import { POST } from "./route";

function request(targetPath: string): NextRequest {
  return new NextRequest("http://localhost/api/files/mkdir", {
    method: "POST",
    body: JSON.stringify({ path: targetPath }),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePathAccess.mockResolvedValue({ auth: { user: { id: "user-a" } } });
  mocks.requireWorkspaceProvisioningPathsAccess.mockResolvedValue({
    auth: { user: { id: "user-a" } },
    canonicalPaths: ["/research/users/user-a/new-workspace"],
  });
  mocks.createDirectory.mockResolvedValue(undefined);
});

describe("POST /api/files/mkdir", () => {
  it("creates only the canonical provisioning path", async () => {
    const submittedPath = "/research/users/user-a/alias/../new-workspace";

    const response = await POST(request(submittedPath));

    expect(response.status).toBe(200);
    expect(mocks.requireWorkspaceProvisioningPathsAccess).toHaveBeenCalledWith(
      expect.any(NextRequest),
      [submittedPath],
    );
    expect(mocks.createDirectory).toHaveBeenCalledWith(
      "/research/users/user-a/new-workspace",
    );
  });

  it("returns cross-user denial before creating a directory", async () => {
    mocks.requireWorkspaceProvisioningPathsAccess.mockResolvedValue(
      NextResponse.json({ error: "Path access denied" }, { status: 403 }),
    );

    const response = await POST(request("/research/users/user-b/workspace"));

    expect(response.status).toBe(403);
    expect(mocks.createDirectory).not.toHaveBeenCalled();
  });
});
