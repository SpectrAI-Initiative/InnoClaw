import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireExperimentRunAccess: vi.fn(),
  selectWhere: vi.fn(),
  update: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
}));

vi.mock("@/lib/auth/ownership", () => ({
  requireExperimentRunAccess: mocks.requireExperimentRunAccess,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mocks.selectWhere,
      })),
    })),
    update: mocks.update,
  },
}));

import { GET, PATCH } from "./route";

const run = {
  id: "run-b",
  workspaceId: "workspace-b",
  remoteProfileId: null,
  status: "planning",
  manifestJson: null,
  patchSummary: null,
  syncSummary: null,
  jobId: null,
  monitoringConfigJson: null,
  lastPolledAt: null,
  statusSnapshotJson: null,
  collectApprovedAt: null,
  resultSummaryJson: null,
  recommendationJson: null,
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:00:00.000Z",
};

const context = {
  params: Promise.resolve({ runId: "run-b" }),
};

function request(method: "GET" | "PATCH", body?: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/research-exec/runs/run-b",
    {
      method,
      headers: body === undefined
        ? undefined
        : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.selectWhere.mockResolvedValue([run]);
  mocks.updateWhere.mockResolvedValue(undefined);
  mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
  mocks.update.mockReturnValue({ set: mocks.updateSet });
});

describe("GET /api/research-exec/runs/[runId]", () => {
  it("rejects an inaccessible run before reading it directly", async () => {
    mocks.requireExperimentRunAccess.mockResolvedValue(
      NextResponse.json(
        { error: "Experiment run access denied" },
        { status: 403 },
      ),
    );

    const response = await GET(request("GET"), context);

    expect(response.status).toBe(403);
    expect(mocks.requireExperimentRunAccess).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "run-b",
    );
    expect(mocks.selectWhere).not.toHaveBeenCalled();
  });

  it("serializes the run returned by the access helper", async () => {
    mocks.requireExperimentRunAccess.mockResolvedValue({
      auth: { user: { id: "user-b" } },
      run,
    });

    const response = await GET(request("GET"), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe("run-b");
    expect(mocks.selectWhere).not.toHaveBeenCalled();
  });
});
describe("PATCH /api/research-exec/runs/[runId]", () => {
  it("rejects an inaccessible run before mutation", async () => {
    mocks.requireExperimentRunAccess.mockResolvedValue(
      NextResponse.json(
        { error: "Experiment run access denied" },
        { status: 403 },
      ),
    );

    const response = await PATCH(
      request("PATCH", { status: "running" }),
      context,
    );

    expect(response.status).toBe(403);
    expect(mocks.requireExperimentRunAccess).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "run-b",
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("updates an accessible run", async () => {
    mocks.requireExperimentRunAccess.mockResolvedValue({
      auth: { user: { id: "user-b" } },
      run,
    });
    mocks.selectWhere.mockResolvedValue([{ ...run, status: "running" }]);

    const response = await PATCH(
      request("PATCH", { status: "running" }),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("running");
    expect(mocks.update).toHaveBeenCalledOnce();
  });
});
