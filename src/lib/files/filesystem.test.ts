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
});
