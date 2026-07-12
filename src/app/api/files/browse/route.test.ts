import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addWorkspaceRoot: vi.fn(),
  listDirectory: vi.fn(),
  requirePathAccess: vi.fn(),
  requireWorkspaceProvisioningPathsAccess: vi.fn(),
}));

vi.mock("@/lib/files/filesystem", () => ({
  addWorkspaceRoot: mocks.addWorkspaceRoot,
  listDirectory: mocks.listDirectory,
}));

vi.mock("@/lib/auth/ownership", () => ({
  requirePathAccess: mocks.requirePathAccess,
  requireWorkspaceProvisioningPathsAccess:
    mocks.requireWorkspaceProvisioningPathsAccess,
}));

import { GET } from "./route";

function request(targetPath: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/files/browse?path=${encodeURIComponent(targetPath)}`,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePathAccess.mockResolvedValue({ auth: { user: { id: "user-a" } } });
  mocks.requireWorkspaceProvisioningPathsAccess.mockResolvedValue({
    auth: { user: { id: "user-a" } },
    canonicalPaths: ["/research/users/user-a"],
  });
  mocks.listDirectory.mockResolvedValue([]);
});

describe("GET /api/files/browse", () => {
  it("browses a canonical provisioning path before any workspace row exists", async () => {
    const submittedPath = "/research/users/user-a/alias/..";

    const response = await GET(request(submittedPath));

    expect(response.status).toBe(200);
    expect(mocks.requireWorkspaceProvisioningPathsAccess).toHaveBeenCalledWith(
      expect.any(NextRequest),
      [submittedPath],
    );
    expect(mocks.listDirectory).toHaveBeenCalledWith("/research/users/user-a");
    expect(mocks.addWorkspaceRoot).not.toHaveBeenCalled();
  });

  it("returns cross-user denial before listing a directory", async () => {
    mocks.requireWorkspaceProvisioningPathsAccess.mockResolvedValue(
      NextResponse.json({ error: "Path access denied" }, { status: 403 }),
    );

    const response = await GET(request("/research/users/user-b"));

    expect(response.status).toBe(403);
    expect(mocks.listDirectory).not.toHaveBeenCalled();
    expect(mocks.addWorkspaceRoot).not.toHaveBeenCalled();
  });
});
