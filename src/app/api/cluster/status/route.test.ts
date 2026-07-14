import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getK8sConfig: vi.fn(),
  requireHighRiskExecution: vi.fn(),
}));

vi.mock("@/lib/auth/privileges", () => ({
  requireHighRiskExecution: mocks.requireHighRiskExecution,
}));

vi.mock("@/lib/cluster/config", () => ({
  getK8sConfig: mocks.getK8sConfig,
}));

vi.mock("@/lib/env", () => ({
  buildSafeExecEnv: vi.fn(() => ({})),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireHighRiskExecution.mockResolvedValue({
    user: { id: "admin-id", role: "admin" },
  });
  mocks.getK8sConfig.mockResolvedValue({
    kubeconfigPath: "",
    clusterContextMap: {},
  });
});
describe("GET /api/cluster/status", () => {
  it("rejects an ordinary strict-mode user before loading cluster config", async () => {
    mocks.requireHighRiskExecution.mockResolvedValue(
      NextResponse.json(
        { error: "High-risk execution access required" },
        { status: 403 },
      ),
    );

    const response = await GET(
      new NextRequest("http://localhost/api/cluster/status?cluster=muxi"),
    );

    expect(response.status).toBe(403);
    expect(mocks.getK8sConfig).not.toHaveBeenCalled();
  });

  it("loads cluster configuration for a privileged caller", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/cluster/status?cluster=muxi"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.configured).toBe(false);
    expect(mocks.requireHighRiskExecution).toHaveBeenCalledOnce();
    expect(mocks.getK8sConfig).toHaveBeenCalledOnce();
  });
});
