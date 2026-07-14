import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/server";

const mocks = vi.hoisted(() => ({
  ensureProjectDefaultSkills: vi.fn(),
  orderBy: vi.fn(),
  ownedSkillFilter: vi.fn(),
  queryWhere: vi.fn(),
  requireAuth: vi.fn(),
  requireWorkspaceAccess: vi.fn(),
}));

vi.mock("@/lib/auth/server", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/server")>(),
  requireAuth: mocks.requireAuth,
}));

vi.mock("@/lib/auth/ownership", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/ownership")>(),
  ownedSkillFilter: mocks.ownedSkillFilter,
  requireWorkspaceAccess: mocks.requireWorkspaceAccess,
}));

vi.mock("@/lib/db/default-skills", () => ({
  ensureProjectDefaultSkills: mocks.ensureProjectDefaultSkills,
}));

vi.mock("@/lib/db/skills-utils", () => ({
  parseSkillRow: (row: unknown) => row,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mocks.queryWhere,
      })),
    })),
    insert: vi.fn(),
  },
}));

import { GET } from "./route";

const userAuth: AuthContext = {
  user: {
    id: "user-a",
    email: "user-a@example.com",
    name: "User A",
    role: "user",
    isActive: true,
    lastLoginAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  session: {
    id: "session-a",
    expiresAt: "2027-01-01T00:00:00.000Z",
  },
  token: "token-a",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ensureProjectDefaultSkills.mockResolvedValue(undefined);
  mocks.requireAuth.mockResolvedValue(userAuth);
  mocks.ownedSkillFilter.mockReturnValue(undefined);
  mocks.orderBy.mockResolvedValue([]);
  mocks.queryWhere.mockReturnValue({ orderBy: mocks.orderBy });
});

describe("GET /api/skills", () => {
  it("rejects listing another user's workspace skills", async () => {
    mocks.requireWorkspaceAccess.mockResolvedValue(
      NextResponse.json(
        { error: "Workspace access denied" },
        { status: 403 },
      ),
    );

    const response = await GET(new NextRequest(
      "http://localhost/api/skills?workspaceId=workspace-b",
    ));

    expect(response.status).toBe(403);
    expect(mocks.requireWorkspaceAccess).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "workspace-b",
    );
    expect(mocks.queryWhere).not.toHaveBeenCalled();
  });

  it("applies the owner filter to an ordinary user's global listing", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/skills"),
    );

    expect(response.status).toBe(200);
    expect(mocks.ownedSkillFilter).toHaveBeenCalledWith(userAuth);
    expect(mocks.queryWhere).toHaveBeenCalledOnce();
  });

  it("applies the owner filter after authorizing a workspace listing", async () => {
    mocks.requireWorkspaceAccess.mockResolvedValue({
      auth: userAuth,
      workspace: { id: "workspace-a" },
    });

    const response = await GET(new NextRequest(
      "http://localhost/api/skills?workspaceId=workspace-a",
    ));

    expect(response.status).toBe(200);
    expect(mocks.requireWorkspaceAccess).toHaveBeenCalledOnce();
    expect(mocks.ownedSkillFilter).toHaveBeenCalledWith(userAuth);
    expect(mocks.queryWhere).toHaveBeenCalledOnce();
  });
});

