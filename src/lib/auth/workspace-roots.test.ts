import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { ANONYMOUS_AUTH_CONTEXT } from "./mode";
import type { AuthContext } from "./server";
import {
  ensureEffectiveWorkspaceRoots,
  getEffectiveWorkspaceRoots,
  resolveProvisioningPath,
} from "./workspace-roots";

const originalEnv = { ...process.env };
const sandboxes: string[] = [];

function authContext(id: string, role: "admin" | "user"): AuthContext {
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

function temporaryRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "innoclaw-user-roots-"));
  sandboxes.push(root);
  return root;
}

afterEach(() => {
  process.env = { ...originalEnv };
  while (sandboxes.length > 0) {
    fs.rmSync(sandboxes.pop()!, { recursive: true, force: true });
  }
});

describe("effective workspace roots", () => {
  it("derives one private root per configured root for ordinary users", () => {
    process.env.AUTH_MODE = "local";

    expect(
      getEffectiveWorkspaceRoots(authContext("user-a", "user"), [
        "/research",
        "/projects",
      ]),
    ).toEqual([
      path.resolve("/research/users/user-a"),
      path.resolve("/projects/users/user-a"),
    ]);
  });

  it("keeps configured roots unchanged for administrators", () => {
    process.env.AUTH_MODE = "local";

    expect(
      getEffectiveWorkspaceRoots(authContext("admin-a", "admin"), [
        "/research",
        "/projects",
      ]),
    ).toEqual([path.resolve("/research"), path.resolve("/projects")]);
  });

  it("keeps configured roots unchanged when authentication is disabled", () => {
    process.env.AUTH_MODE = "disabled";

    expect(
      getEffectiveWorkspaceRoots(ANONYMOUS_AUTH_CONTEXT, ["/research", "/projects"]),
    ).toEqual([path.resolve("/research"), path.resolve("/projects")]);
  });

  it.each(["../escape", "nested/user", "nested\\user", ".", ""])(
    "rejects unsafe immutable user id %j",
    (id) => {
      process.env.AUTH_MODE = "local";

      expect(() =>
        getEffectiveWorkspaceRoots(authContext(id, "user"), ["/research"]),
      ).toThrow(/user id/i);
    },
  );

  it("creates and restricts only the ordinary user's derived root", () => {
    process.env.AUTH_MODE = "local";
    const configuredRoot = temporaryRoot();
    const userRoot = path.join(configuredRoot, "users", "user-a");

    expect(
      ensureEffectiveWorkspaceRoots(authContext("user-a", "user"), [configuredRoot]),
    ).toEqual([fs.realpathSync(userRoot)]);
    expect(fs.existsSync(path.join(configuredRoot, "users", "user-b"))).toBe(false);
    if (process.platform !== "win32") {
      expect(fs.statSync(userRoot).mode & 0o777).toBe(0o700);
    }
  });

  it("does not create a derived administrator directory", () => {
    process.env.AUTH_MODE = "local";
    const configuredRoot = temporaryRoot();

    expect(
      ensureEffectiveWorkspaceRoots(authContext("admin-a", "admin"), [configuredRoot]),
    ).toEqual([fs.realpathSync(configuredRoot)]);
    expect(fs.existsSync(path.join(configuredRoot, "users"))).toBe(false);
  });

  it("rejects a symlinked users directory before provisioning outside the configured root", (context) => {
    process.env.AUTH_MODE = "local";
    const sandbox = temporaryRoot();
    const configuredRoot = path.join(sandbox, "configured");
    const outsideRoot = path.join(sandbox, "outside");
    fs.mkdirSync(configuredRoot);
    fs.mkdirSync(outsideRoot);
    try {
      fs.symlinkSync(
        outsideRoot,
        path.join(configuredRoot, "users"),
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (process.platform === "win32" && (code === "EPERM" || code === "EACCES")) {
        context.skip();
        return;
      }
      throw error;
    }

    expect(() =>
      ensureEffectiveWorkspaceRoots(authContext("user-a", "user"), [configuredRoot]),
    ).toThrow(/outside/i);
    expect(fs.existsSync(path.join(outsideRoot, "user-a"))).toBe(false);
  });

  it("rejects provisioning outside the ordinary user's effective root", () => {
    process.env.AUTH_MODE = "local";
    const configuredRoot = temporaryRoot();
    process.env.WORKSPACE_ROOTS = configuredRoot;
    const user = authContext("user-a", "user");
    ensureEffectiveWorkspaceRoots(user, [configuredRoot]);

    expect(() =>
      resolveProvisioningPath(
        user,
        path.join(configuredRoot, "users", "user-b", "workspace"),
      ),
    ).toThrow(/outside/i);
  });

  it("rejects an empty configured-root list", () => {
    process.env.AUTH_MODE = "local";

    expect(() =>
      ensureEffectiveWorkspaceRoots(authContext("user-a", "user"), []),
    ).toThrow(/workspace roots/i);
  });
});
