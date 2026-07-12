import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/server";

const mocks = vi.hoisted(() => ({
  canUseHighRiskExecution: vi.fn(),
  exec: vi.fn(),
  requirePathAccess: vi.fn(),
  stat: vi.fn(),
}));

vi.mock("child_process", () => ({ exec: mocks.exec }));
vi.mock("fs/promises", () => ({ stat: mocks.stat }));
vi.mock("@/lib/files/filesystem", () => ({
  validatePath: (target: string) => target,
}));
vi.mock("@/lib/env", () => ({
  buildSafeExecEnv: () => ({}),
  resolveHome: () => "/home/user-a",
}));
vi.mock("@/lib/auth/ownership", () => ({
  requirePathAccess: mocks.requirePathAccess,
}));
vi.mock("@/lib/auth/privileges", () => ({
  canUseHighRiskExecution: mocks.canUseHighRiskExecution,
}));

import { POST } from "./route";

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

function request(command: string, cwd = "/research/users/user-a/workspace") {
  return new NextRequest("http://localhost/api/terminal/exec", {
    method: "POST",
    body: JSON.stringify({ command, cwd }),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  const admin = authContext("admin");
  mocks.requirePathAccess.mockResolvedValue({ auth: admin, canonicalPaths: [] });
  mocks.canUseHighRiskExecution.mockReturnValue(true);
  mocks.exec.mockImplementation(
    (
      _command: string,
      _options: unknown,
      callback: (
        error: { code?: number } | null,
        stdout: string,
        stderr: string,
      ) => void,
    ) =>
      callback(null, "ok\n", ""),
  );
  mocks.stat.mockResolvedValue({ isDirectory: () => true });
});

describe("POST /api/terminal/exec", () => {
  it("rejects an ordinary user before command execution", async () => {
    const user = authContext("user");
    mocks.requirePathAccess.mockResolvedValue({ auth: user, canonicalPaths: [] });
    mocks.canUseHighRiskExecution.mockReturnValue(false);

    const response = await POST(request("pwd"));

    expect(response.status).toBe(403);
    expect(mocks.exec).not.toHaveBeenCalled();
  });

  it("allows an administrator to execute within an authorized workspace", async () => {
    const response = await POST(request("pwd"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.exec).toHaveBeenCalledOnce();
    expect(body).toMatchObject({ stdout: "ok\n", exitCode: 0 });
  });

  it("re-authorizes a cd destination before filesystem access", async () => {
    mocks.requirePathAccess
      .mockResolvedValueOnce({ auth: authContext("admin"), canonicalPaths: [] })
      .mockResolvedValueOnce(
        NextResponse.json({ error: "Path access denied" }, { status: 403 }),
      );

    const response = await POST(request("cd /research/users/user-b/workspace"));

    expect(response.status).toBe(403);
    expect(mocks.requirePathAccess).toHaveBeenNthCalledWith(
      2,
      expect.any(NextRequest),
      "/research/users/user-b/workspace",
    );
    expect(mocks.stat).not.toHaveBeenCalled();
  });
});
