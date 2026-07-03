import { describe, expect, it, vi } from "vitest";
import { createKubectlExecutor } from "./kubectl-executor";

describe("createKubectlExecutor", () => {
  it("injects kubeconfig, context, and namespace before user args", async () => {
    const runner = vi.fn(async () => ({
      stdout: "{\"items\":[]}",
      stderr: "",
      exitCode: 0,
    }));
    const executor = createKubectlExecutor({ runner, defaultTimeoutMs: 30_000 });

    await executor.runJson({
      kubeconfigPath: "/tmp/kubeconfig",
      context: "kind-local",
      namespace: "default",
      args: ["get", "pods", "-o", "json"],
    });

    expect(runner).toHaveBeenCalledWith(
      [
        "--kubeconfig",
        "/tmp/kubeconfig",
        "--context",
        "kind-local",
        "-n",
        "default",
        "get",
        "pods",
        "-o",
        "json",
      ],
      expect.objectContaining({ timeoutMs: 30_000 }),
    );
  });

  it.each([
    ["--kubeconfig", ["--kubeconfig", "/tmp/other", "get", "pods"]],
    ["--context", ["--context", "prod", "get", "pods"]],
    ["--namespace", ["--namespace", "prod", "get", "pods"]],
    ["--namespace=prod", ["--namespace=prod", "get", "pods"]],
    ["-n", ["-n", "prod", "get", "pods"]],
    ["-nprod", ["-nprod", "get", "pods"]],
    ["--token", ["--token", "secret", "get", "pods"]],
  ])("rejects scope override flag %s", async (_label, args) => {
    const runner = vi.fn();
    const executor = createKubectlExecutor({ runner, defaultTimeoutMs: 30_000 });

    await expect(
      executor.runText({
        kubeconfigPath: "/tmp/kubeconfig",
        context: "kind-local",
        namespace: "default",
        args,
      }),
    ).rejects.toThrow(/must not override Kubernetes scope/);
    expect(runner).not.toHaveBeenCalled();
  });

  it("maps invalid JSON output to an execution error", async () => {
    const runner = vi.fn(async () => ({
      stdout: "{",
      stderr: "",
      exitCode: 0,
    }));
    const executor = createKubectlExecutor({ runner, defaultTimeoutMs: 30_000 });

    await expect(
      executor.runJson({
        kubeconfigPath: "/tmp/kubeconfig",
        context: "kind-local",
        args: ["get", "jobs", "-o", "json"],
      }),
    ).rejects.toThrow(/invalid JSON/);
  });

  it("returns bounded text output", async () => {
    const runner = vi.fn(async () => ({
      stdout: "x".repeat(50_000),
      stderr: "y".repeat(10_000),
      exitCode: 0,
    }));
    const executor = createKubectlExecutor({
      runner,
      defaultTimeoutMs: 30_000,
      truncate: { stdout: 100, stderr: 50 },
    });

    await expect(
      executor.runText({
        kubeconfigPath: "/tmp/kubeconfig",
        context: "kind-local",
        args: ["get", "jobs"],
      }),
    ).resolves.toMatchObject({
      stdout: "x".repeat(100),
      stderr: "y".repeat(50),
      exitCode: 0,
    });
  });

  it("parses JSON from full stdout before returning a truncated preview", async () => {
    const items = Array.from({ length: 50 }, (_item, index) => ({
      metadata: { name: `pod-${index}` },
      payload: "x".repeat(100),
    }));
    const stdout = JSON.stringify({ items });
    const runner = vi.fn(async () => ({
      stdout,
      stderr: "",
      exitCode: 0,
    }));
    const executor = createKubectlExecutor({
      runner,
      defaultTimeoutMs: 30_000,
      truncate: { stdout: 80, stderr: 50 },
    });

    const result = await executor.runJson<{ items: unknown[] }>({
      kubeconfigPath: "/tmp/kubeconfig",
      context: "kind-local",
      args: ["get", "pods", "-o", "json"],
    });

    expect(result.data.items).toHaveLength(50);
    expect(result.stdout).toHaveLength(80);
  });
});
