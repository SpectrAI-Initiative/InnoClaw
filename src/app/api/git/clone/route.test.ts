import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/server";

const mocks = vi.hoisted(() => ({
  cloneRepo: vi.fn(),
  ensureEffectiveWorkspaceRoots: vi.fn(),
  insertValues: vi.fn(),
  pathExists: vi.fn(),
  requireAuth: vi.fn(),
  requireWorkspaceProvisioningPathsAccess: vi.fn(),
  selectLimit: vi.fn(),
}));

vi.mock("@/lib/auth/server", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/server")>(),
  requireAuth: mocks.requireAuth,
}));

vi.mock("@/lib/auth/ownership", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/ownership")>(),
  requireWorkspaceProvisioningPathsAccess:
    mocks.requireWorkspaceProvisioningPathsAccess,
}));

vi.mock("@/lib/auth/workspace-roots", () => ({
  ensureEffectiveWorkspaceRoots: mocks.ensureEffectiveWorkspaceRoots,
}));

vi.mock("@/lib/files/filesystem", () => ({
  getWorkspaceRoots: vi.fn(() => ["/research"]),
  pathExists: mocks.pathExists,
}));

vi.mock("@/lib/git/github", () => ({
  cloneRepo: mocks.cloneRepo,
}));

vi.mock("nanoid", () => ({
  nanoid: () => "workspace-new",
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: mocks.insertValues })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: mocks.selectLimit })),
      })),
    })),
  },
}));

import { POST } from "./route";

const originalAuthMode = process.env.AUTH_MODE;

function authContext(role: "admin" | "user"): AuthContext {
  const id = role === "admin" ? "admin-id" : "user-a";
  return {
    user: {
      id,
      email: `${id}@example.com`,
      name: id,
      role,
      isActive: true,
      lastLoginAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    session: {
      id: `session-${id}`,
      expiresAt: "2027-01-01T00:00:00.000Z",
    },
    token: `token-${id}`,
  };
}

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/git/clone", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_MODE = "local";
  const user = authContext("user");
  mocks.requireAuth.mockResolvedValue(user);
  mocks.ensureEffectiveWorkspaceRoots.mockReturnValue([
    "/research/users/user-a",
  ]);
  mocks.requireWorkspaceProvisioningPathsAccess.mockImplementation(
    async (_request: NextRequest, paths: string[]) => ({
      auth: user,
      canonicalPaths: paths,
    }),
  );
  mocks.pathExists.mockResolvedValue(false);
  mocks.cloneRepo.mockResolvedValue(undefined);
  mocks.insertValues.mockResolvedValue(undefined);
  mocks.selectLimit.mockResolvedValue([{
    id: "workspace-new",
    ownerUserId: "user-a",
    name: "sample-repo",
    folderPath: "/research/users/user-a/sample-repo",
  }]);
});

afterEach(() => {
  if (originalAuthMode === undefined) {
    delete process.env.AUTH_MODE;
  } else {
    process.env.AUTH_MODE = originalAuthMode;
  }
});

describe("POST /api/git/clone", () => {
  it("clones an ordinary user's repository into their private root", async () => {
    const response = await POST(request({
      repoUrl: "https://github.com/example/sample-repo.git",
    }));

    expect(response.status).toBe(201);
    expect(mocks.cloneRepo).toHaveBeenCalledWith(
      "https://github.com/example/sample-repo.git",
      "/research/users/user-a/sample-repo",
    );
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: "user-a",
      name: "sample-repo",
      folderPath: "/research/users/user-a/sample-repo",
    }));
  });

  it.each(["../escape", "nested/repo", "nested\\repo", ".", ""])(
    "rejects unsafe target folder name %j",
    async (targetFolderName) => {
      const response = await POST(request({
        repoUrl: "https://github.com/example/sample-repo.git",
        targetFolderName,
      }));

      expect(response.status).toBe(400);
      expect(mocks.cloneRepo).not.toHaveBeenCalled();
      expect(mocks.insertValues).not.toHaveBeenCalled();
    },
  );

  it("returns 409 when the target directory already exists", async () => {
    mocks.pathExists.mockResolvedValue(true);

    const response = await POST(request({
      repoUrl: "https://github.com/example/sample-repo.git",
    }));

    expect(response.status).toBe(409);
    expect(mocks.cloneRepo).not.toHaveBeenCalled();
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it("uses the configured operator root for an administrator", async () => {
    const admin = authContext("admin");
    mocks.requireAuth.mockResolvedValue(admin);
    mocks.ensureEffectiveWorkspaceRoots.mockReturnValue(["/research"]);
    mocks.requireWorkspaceProvisioningPathsAccess.mockResolvedValue({
      auth: admin,
      canonicalPaths: ["/research/sample-repo"],
    });

    const response = await POST(request({
      repoUrl: "https://github.com/example/sample-repo.git",
    }));

    expect(response.status).toBe(201);
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: "admin-id",
      folderPath: "/research/sample-repo",
    }));
  });

  it("returns provisioning denial before clone or database mutation", async () => {
    mocks.requireWorkspaceProvisioningPathsAccess.mockResolvedValue(
      NextResponse.json({ error: "Path access denied" }, { status: 403 }),
    );

    const response = await POST(request({
      repoUrl: "https://github.com/example/sample-repo.git",
    }));

    expect(response.status).toBe(403);
    expect(mocks.cloneRepo).not.toHaveBeenCalled();
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it("does not insert a workspace when cloning fails", async () => {
    mocks.cloneRepo.mockRejectedValue(new Error("clone failed"));

    const response = await POST(request({
      repoUrl: "https://github.com/example/sample-repo.git",
    }));

    expect(response.status).toBe(500);
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it("maps a workspace-path uniqueness race to 409", async () => {
    mocks.insertValues.mockRejectedValue(
      Object.assign(new Error("UNIQUE constraint failed: workspaces.folder_path"), {
        code: "SQLITE_CONSTRAINT_UNIQUE",
      }),
    );

    const response = await POST(request({
      repoUrl: "https://github.com/example/sample-repo.git",
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "This folder is already registered",
    });
  });
});
