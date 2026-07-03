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

type ExecutableTool<Result> = {
  execute: (
    input: Record<string, unknown>,
    options: { toolCallId: string; messages: [] },
  ) => Promise<Result>;
};

interface PrepareK8sJobResult {
  success: boolean;
  jobSpecHash: string;
  review: Record<string, unknown>;
  manifest?: unknown;
}

interface RunK8sJobResult {
  success: boolean;
  error?: string;
}

interface GenericToolResult {
  success?: boolean;
  error?: string;
  status?: string;
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

    const result = await (
      tools.prepareK8sJob as unknown as ExecutableTool<PrepareK8sJobResult>
    ).execute(
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
      command: ["python", "-c"],
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

  it("does not return rendered manifest or private profile details from prepare", async () => {
    const executor = {
      runText: vi.fn().mockResolvedValue({
        data: "job.batch/smoke-test dry-run",
        stdout: "",
        stderr: "",
        exitCode: 0,
      }),
      runJson: vi.fn(),
    };
    const tools = createK8sJobTools(
      createCtx({
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
              id: "private-profile",
              clusterId: "default",
              namespace: "default",
              defaultImage: "registry.local/private/image:tag",
              imagePullSecrets: ["pull-secret"],
              env: [{ name: "SECRET_VALUE", value: "secret-value" }],
            },
          ],
        },
      }),
      {
        executor: executor as never,
        recordClusterOp: vi.fn().mockResolvedValue("op-1"),
      },
    );

    const result = await (
      tools.prepareK8sJob as unknown as ExecutableTool<PrepareK8sJobResult>
    ).execute(
      {
        profileId: "private-profile",
        jobName: "smoke-test",
      },
      { toolCallId: "call-1", messages: [] },
    );

    const serialized = JSON.stringify(result);
    expect(result.success).toBe(true);
    expect(result.manifest).toBeUndefined();
    expect(serialized).not.toContain("registry.local/private");
    expect(serialized).not.toContain("pull-secret");
    expect(serialized).not.toContain("secret-value");
  });

  it("rejects run when the supplied hash does not match the rebuilt manifest", async () => {
    const tools = createK8sJobTools(createCtx(), {
      executor: { runText: vi.fn(), runJson: vi.fn() } as never,
      recordClusterOp: vi.fn().mockResolvedValue("op-1"),
    });

    const result = await (
      tools.runK8sJob as unknown as ExecutableTool<RunK8sJobResult>
    ).execute(
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

  it("rejects malformed follow-up job names before calling kubectl", async () => {
    const executor = {
      runText: vi.fn(),
      runJson: vi.fn().mockResolvedValue({ data: { items: [] } }),
    };
    const recordClusterOp = vi.fn().mockResolvedValue("op-1");
    const tools = createK8sJobTools(createCtx(), {
      executor: executor as never,
      recordClusterOp,
    });

    const result = await (
      tools.collectK8sJobLogs as unknown as ExecutableTool<GenericToolResult>
    ).execute(
      {
        profileId: "cpu-smoke",
        jobName: "--context=prod",
      },
      { toolCallId: "call-1", messages: [] },
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/valid DNS label/);
    expect(executor.runJson).not.toHaveBeenCalled();
    expect(recordClusterOp).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "collectK8sJobLogs",
        status: "error",
      }),
    );
  });

  it("records wait timeouts as an error audit status", async () => {
    const executor = {
      runText: vi.fn(),
      runJson: vi.fn(async (request: { args: string[] }) => {
        if (request.args[0] === "get" && request.args[1] === "pods") {
          return { data: { items: [] } };
        }
        return {
          data: {
            metadata: { name: "smoke-test", namespace: "default" },
            status: { active: 1 },
          },
        };
      }),
    };
    const recordClusterOp = vi.fn().mockResolvedValue("op-1");
    const tools = createK8sJobTools(createCtx(), {
      executor: executor as never,
      recordClusterOp,
    });

    const result = await (
      tools.waitForK8sJob as unknown as ExecutableTool<GenericToolResult>
    ).execute(
      {
        profileId: "cpu-smoke",
        jobName: "smoke-test",
        timeoutSeconds: 1,
        pollIntervalSeconds: 1,
      },
      { toolCallId: "call-1", messages: [] },
    );

    expect(result.status).toBe("timeout");
    expect(recordClusterOp).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "waitForK8sJob",
        status: "error",
      }),
    );
  });

  it("returns structured cleanup errors and records failed attempts", async () => {
    const executor = {
      runText: vi.fn(),
      runJson: vi.fn().mockRejectedValue(new Error("jobs.batch not found")),
    };
    const recordClusterOp = vi.fn().mockResolvedValue("op-1");
    const tools = createK8sJobTools(createCtx(), {
      executor: executor as never,
      recordClusterOp,
    });

    const result = await (
      tools.cleanupK8sJob as unknown as ExecutableTool<GenericToolResult>
    ).execute(
      {
        profileId: "cpu-smoke",
        jobName: "smoke-test",
        confirmDelete: true,
      },
      { toolCallId: "call-1", messages: [] },
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/);
    expect(recordClusterOp).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "cleanupK8sJob",
        jobName: "smoke-test",
        status: "error",
      }),
    );
  });
});
