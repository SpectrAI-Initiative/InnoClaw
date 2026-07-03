import { describe, expect, it, vi } from "vitest";
import { createK8sJobTools } from "./k8s-job-tools";
import type { ToolContext } from "./types";

function createCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    validatedCwd: "/tmp/workspace",
    resolvePath: (filePath) => filePath,
    kubeconfigPath: "/tmp/legacy-kubeconfig",
    k8sConfig: {} as never,
    k8sJobConfig: {
      clusters: [
        {
          id: "default",
          kubeconfigPath: "/tmp/kubeconfig",
          context: "kind-local",
          defaultNamespace: "default",
          allowedNamespaces: ["default"],
        },
      ],
      profiles: [
        {
          id: "cpu-smoke",
          clusterId: "default",
          namespace: "default",
          defaultImage: "python:3.12",
        },
      ],
    },
    baseExecEnv: process.env,
    workspaceId: "ws-1",
    ...overrides,
  };
}

describe("createK8sJobTools", () => {
  it("prepares a job and returns a review hash", async () => {
    const executor = {
      runText: vi.fn().mockResolvedValue({
        data: "job.batch/smoke-test dry-run",
        stdout: "",
        stderr: "",
        exitCode: 0,
      }),
      runJson: vi.fn(),
    };
    const recordClusterOp = vi.fn().mockResolvedValue("op-1");
    const tools = createK8sJobTools(createCtx(), {
      executor: executor as never,
      recordClusterOp,
    });

    const result = await (tools.prepareK8sJob as any).execute(
      {
        profileId: "cpu-smoke",
        jobName: "smoke-test",
        command: ["python", "-c"],
        args: ["print('hello')"],
      },
      { toolCallId: "call-1", messages: [] },
    );

    expect(result.success).toBe(true);
    expect(result.jobSpecHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.review).toMatchObject({
      namespace: "default",
      image: "python:3.12",
    });
    expect(executor.runText).toHaveBeenCalledWith(
      expect.objectContaining({
        args: ["apply", "--dry-run=client", "-f", "-"],
        namespace: "default",
      }),
    );
    expect(recordClusterOp).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "prepareK8sJob",
        status: "success",
      }),
    );
  });

  it("rejects run when the supplied hash does not match the rebuilt manifest", async () => {
    const tools = createK8sJobTools(createCtx(), {
      executor: { runText: vi.fn(), runJson: vi.fn() } as never,
      recordClusterOp: vi.fn().mockResolvedValue("op-1"),
    });

    const result = await (tools.runK8sJob as any).execute(
      {
        profileId: "cpu-smoke",
        jobName: "smoke-test",
        command: ["python", "-c"],
        args: ["print('hello')"],
        jobSpecHash: "bad-hash",
        confirmSubmit: true,
      },
      { toolCallId: "call-1", messages: [] },
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/hash does not match/);
  });
});
