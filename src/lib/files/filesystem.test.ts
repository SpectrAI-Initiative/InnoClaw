import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateEnvLocal: vi.fn(),
}));

vi.mock("@/lib/env-file", () => ({
  updateEnvLocal: mocks.updateEnvLocal,
}));

import { addWorkspaceRoot, getWorkspaceRoots, validatePath } from "./filesystem";

const originalEnv = { ...process.env };

function normalizedResolved(targetPath: string): string {
  return path.resolve(targetPath).replace(/\\/g, "/");
}

function normalizedWorkspaceRoots(): string[] {
  return getWorkspaceRoots().map((root) => root.replace(/\\/g, "/"));
}

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.WORKSPACE_ROOTS;
  delete process.env.WORKSPACE_ROOTS_MAX_ENTRIES;
  mocks.updateEnvLocal.mockReset();
});

describe("workspace root allowlist", () => {
  it("keeps earlier registered workspace roots available across more than three candidates", () => {
    const roots = [
      "/tmp/skillopt_aircraft_candidate_workspaces/formal_train/candidate_01",
      "/tmp/skillopt_aircraft_candidate_workspaces/formal_train/candidate_02",
      "/tmp/skillopt_aircraft_candidate_workspaces/formal_train/candidate_03",
      "/tmp/skillopt_aircraft_candidate_workspaces/formal_train/candidate_04",
    ];

    for (const root of roots) {
      addWorkspaceRoot(root);
    }

    expect(getWorkspaceRoots()).toEqual(roots.map((root) => path.resolve(root)));
    expect(() => validatePath(path.join(roots[0], "scripts", "run_headless.py"))).not.toThrow();
  });

  it("keeps more than three workspace roots when under the configured cap", () => {
    process.env.WORKSPACE_ROOTS = ["/tmp/a", "/tmp/b", "/tmp/c"].join(",");
    process.env.WORKSPACE_ROOTS_MAX_ENTRIES = "5";

    addWorkspaceRoot("/tmp/d");

    expect(normalizedWorkspaceRoots()).toContain(normalizedResolved("/tmp/a"));
    expect(normalizedWorkspaceRoots()).toContain(normalizedResolved("/tmp/d"));
  });

  it("throws instead of silently dropping workspace roots when the cap is exceeded", () => {
    process.env.WORKSPACE_ROOTS = ["/tmp/a", "/tmp/b"].join(",");
    process.env.WORKSPACE_ROOTS_MAX_ENTRIES = "2";

    expect(() => addWorkspaceRoot("/tmp/c")).toThrow("WORKSPACE_ROOTS limit exceeded");
  });

  it("compacts child roots when a parent root is added", () => {
    process.env.WORKSPACE_ROOTS = ["/tmp/project/a", "/tmp/project/b"].join(",");
    process.env.WORKSPACE_ROOTS_MAX_ENTRIES = "5";

    addWorkspaceRoot("/tmp/project");

    expect(normalizedWorkspaceRoots()).toEqual([normalizedResolved("/tmp/project")]);
  });
});
