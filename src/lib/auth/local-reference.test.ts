import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireLocalReferenceAccess } from "./local-reference";

const mocks = vi.hoisted(() => ({
  requireWorkspaceProvisioningPathsAccess: vi.fn(),
}));

vi.mock("./ownership", () => ({
  requireWorkspaceProvisioningPathsAccess:
    mocks.requireWorkspaceProvisioningPathsAccess,
}));

function request(): NextRequest {
  return new NextRequest("http://localhost/api/paper-study/quick-summary", {
    method: "POST",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireWorkspaceProvisioningPathsAccess.mockResolvedValue({
    auth: { user: { id: "user-a" } },
    canonicalPaths: ["/research/users/user-a/paper.pdf"],
  });
});

describe("requireLocalReferenceAccess", () => {
  it.each([
    "",
    "https://example.com/paper.pdf",
    "http://example.com/paper.pdf",
    "doi:10.1000/example",
    "10.1000/example",
  ])("leaves non-filesystem reference %j unchanged", async (reference) => {
    await expect(requireLocalReferenceAccess(request(), reference)).resolves.toEqual({
      canonicalReference: reference,
    });
    expect(mocks.requireWorkspaceProvisioningPathsAccess).not.toHaveBeenCalled();
  });

  it("canonicalizes an absolute local reference through provisioning access", async () => {
    const result = await requireLocalReferenceAccess(
      request(),
      "/research/users/user-a/alias/../paper.pdf",
    );

    expect(result).toEqual({
      canonicalReference: "/research/users/user-a/paper.pdf",
    });
    expect(mocks.requireWorkspaceProvisioningPathsAccess).toHaveBeenCalledWith(
      expect.any(NextRequest),
      ["/research/users/user-a/alias/../paper.pdf"],
    );
  });

  it("returns cross-user denial unchanged", async () => {
    const denied = NextResponse.json(
      { error: "Path access denied" },
      { status: 403 },
    );
    mocks.requireWorkspaceProvisioningPathsAccess.mockResolvedValue(denied);

    const result = await requireLocalReferenceAccess(
      request(),
      "/research/users/user-b/paper.pdf",
    );

    expect(result).toBe(denied);
  });
});
