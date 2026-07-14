import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const serverMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
}));

vi.mock("./server", async () => {
  const actual = await vi.importActual<typeof import("./server")>("./server");
  return {
    ...actual,
    requireAuth: serverMocks.requireAuth,
  };
});

import { db } from "@/lib/db";
import { hfDatasets, scheduledTasks, skills, workspaces } from "@/lib/db/schema";
import { ANONYMOUS_AUTH_CONTEXT } from "./mode";
import {
  canAccessOwner,
  getOwnerUserIdForWrite,
  ownedDatasetFilter,
  ownedScheduledTaskFilter,
  ownedSkillFilter,
  ownedWorkspaceFilter,
  requireExperimentRunAccess,
  requireWorkspacePathsAccess,
  requireWorkspaceProvisioningPathsAccess,
} from "./ownership";
import type { AuthContext } from "./server";

const originalAuthMode = process.env.AUTH_MODE;
const originalWorkspaceRoots = process.env.WORKSPACE_ROOTS;
const temporaryDirectories: string[] = [];

const localAuth: AuthContext = {
  user: {
    id: "real-user-id",
    email: "user@example.com",
    name: "Real User",
    role: "user",
    isActive: true,
    lastLoginAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  session: {
    id: "session-id",
    expiresAt: "2026-02-01T00:00:00.000Z",
  },
  token: "session-token",
};

const adminAuth: AuthContext = {
  ...localAuth,
  user: {
    ...localAuth.user,
    id: "admin-id",
    email: "admin@example.com",
    role: "admin",
  },
};

function temporaryRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "innoclaw-ownership-"));
  temporaryDirectories.push(root);
  return root;
}

function mockWorkspaceRows(rows: Array<{ folderPath: string }>): void {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn().mockReturnValue({ where });
  vi.spyOn(db, "select").mockReturnValue({ from } as never);
}

function mockExperimentRunRow(
  row: { id: string; workspaceId: string } | undefined,
): void {
  const limit = vi.fn().mockResolvedValue(row ? [{ run: row }] : []);
  const where = vi.fn().mockReturnValue({ limit });
  const innerJoin = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ innerJoin });
  vi.spyOn(db, "select").mockReturnValue({ from } as never);
}

afterEach(() => {
  vi.restoreAllMocks();
  serverMocks.requireAuth.mockReset();
  if (originalAuthMode === undefined) {
    delete process.env.AUTH_MODE;
  } else {
    process.env.AUTH_MODE = originalAuthMode;
  }
  if (originalWorkspaceRoots === undefined) {
    delete process.env.WORKSPACE_ROOTS;
  } else {
    process.env.WORKSPACE_ROOTS = originalWorkspaceRoots;
  }
  while (temporaryDirectories.length > 0) {
    fs.rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe("ownership helpers", () => {
  it("uses null owners for writes when auth is disabled", () => {
    process.env.AUTH_MODE = "disabled";

    expect(getOwnerUserIdForWrite(ANONYMOUS_AUTH_CONTEXT)).toBeNull();
  });

  it("uses the authenticated user id for writes in local auth mode", () => {
    delete process.env.AUTH_MODE;

    expect(getOwnerUserIdForWrite(localAuth)).toBe("real-user-id");
  });

  it("allows disabled auth to access records owned by any user", () => {
    process.env.AUTH_MODE = "disabled";

    expect(canAccessOwner(ANONYMOUS_AUTH_CONTEXT, "existing-user-id")).toBe(true);
  });

  it("does not filter workspaces by the anonymous synthetic user in disabled mode", () => {
    process.env.AUTH_MODE = "disabled";

    const query = db
      .select()
      .from(workspaces)
      .where(ownedWorkspaceFilter(ANONYMOUS_AUTH_CONTEXT))
      .toSQL();

    expect(query.sql.toLowerCase()).not.toContain(" where ");
    expect(query.params).not.toContain("anonymous-admin");
  });

  it("does not filter datasets by the anonymous synthetic user in disabled mode", () => {
    process.env.AUTH_MODE = "disabled";

    const query = db
      .select()
      .from(hfDatasets)
      .where(ownedDatasetFilter(ANONYMOUS_AUTH_CONTEXT))
      .toSQL();

    expect(query.sql.toLowerCase()).not.toContain(" where ");
    expect(query.params).not.toContain("anonymous-admin");
  });

  it("does not filter administrator reads by owner", () => {
    process.env.AUTH_MODE = "local";

    expect(ownedWorkspaceFilter(adminAuth)).toBeUndefined();
    expect(ownedDatasetFilter(adminAuth)).toBeUndefined();
    expect(ownedScheduledTaskFilter(adminAuth)).toBeUndefined();
    expect(ownedSkillFilter(adminAuth)).toBeUndefined();
    expect(canAccessOwner(adminAuth, "another-user-id")).toBe(true);
  });

  it("continues to filter ordinary-user reads by immutable user id", () => {
    process.env.AUTH_MODE = "local";

    const workspaceQuery = db
      .select()
      .from(workspaces)
      .where(ownedWorkspaceFilter(localAuth))
      .toSQL();
    const datasetQuery = db
      .select()
      .from(hfDatasets)
      .where(ownedDatasetFilter(localAuth))
      .toSQL();
    const taskQuery = db
      .select()
      .from(scheduledTasks)
      .where(ownedScheduledTaskFilter(localAuth))
      .toSQL();
    const skillQuery = db
      .select()
      .from(skills)
      .where(ownedSkillFilter(localAuth))
      .toSQL();

    expect(workspaceQuery.params).toContain("real-user-id");
    expect(datasetQuery.params).toContain("real-user-id");
    expect(taskQuery.params).toContain("real-user-id");
    expect(skillQuery.params).toContain("real-user-id");
  });

  it("lets an administrator access another user's registered workspace path", async () => {
    process.env.AUTH_MODE = "local";
    const root = temporaryRoot();
    const userBWorkspace = path.join(root, "users", "user-b", "workspace");
    fs.mkdirSync(userBWorkspace, { recursive: true });
    mockWorkspaceRows([{ folderPath: userBWorkspace }]);
    serverMocks.requireAuth.mockResolvedValue(adminAuth);

    const result = await requireWorkspacePathsAccess(
      new NextRequest("http://localhost/api/files/read"),
      [path.join(userBWorkspace, "notes.md")],
    );

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toMatchObject({
      auth: adminAuth,
      canonicalPaths: [path.join(fs.realpathSync(userBWorkspace), "notes.md")],
    });
  });

  it("rejects an ordinary user's access to another registered workspace path", async () => {
    process.env.AUTH_MODE = "local";
    const root = temporaryRoot();
    const userAWorkspace = path.join(root, "users", "real-user-id", "workspace");
    const userBWorkspace = path.join(root, "users", "user-b", "workspace");
    fs.mkdirSync(userAWorkspace, { recursive: true });
    fs.mkdirSync(userBWorkspace, { recursive: true });
    mockWorkspaceRows([{ folderPath: userAWorkspace }]);
    serverMocks.requireAuth.mockResolvedValue(localAuth);

    const result = await requireWorkspacePathsAccess(
      new NextRequest("http://localhost/api/files/read"),
      [path.join(userBWorkspace, "notes.md")],
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("returns canonical provisioning paths inside the user's effective root", async () => {
    process.env.AUTH_MODE = "local";
    const root = temporaryRoot();
    process.env.WORKSPACE_ROOTS = root;
    const target = path.join(root, "users", "real-user-id", "first-workspace");
    serverMocks.requireAuth.mockResolvedValue(localAuth);

    const result = await requireWorkspaceProvisioningPathsAccess(
      new NextRequest("http://localhost/api/files/mkdir"),
      [target],
    );

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toMatchObject({
      auth: localAuth,
      canonicalPaths: [path.join(fs.realpathSync(root), "users", "real-user-id", "first-workspace")],
    });
  });

  it("returns an accessible experiment run with its auth context", async () => {
    process.env.AUTH_MODE = "local";
    serverMocks.requireAuth.mockResolvedValue(localAuth);
    mockExperimentRunRow({ id: "run-a", workspaceId: "workspace-a" });

    const result = await requireExperimentRunAccess(
      new NextRequest("http://localhost/api/research-exec/runs/run-a"),
      "run-a",
    );

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toMatchObject({
      auth: localAuth,
      run: { id: "run-a", workspaceId: "workspace-a" },
    });
  });

  it("returns 403 when an experiment run is outside the caller's workspaces", async () => {
    process.env.AUTH_MODE = "local";
    serverMocks.requireAuth.mockResolvedValue(localAuth);
    mockExperimentRunRow(undefined);

    const result = await requireExperimentRunAccess(
      new NextRequest("http://localhost/api/research-exec/runs/run-b"),
      "run-b",
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });
});
