import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { buildSafeExecEnv } from "@/lib/env";
import { getK8sConfig } from "@/lib/cluster/config";

const baseExecEnv = buildSafeExecEnv();

/**
 * GET /api/cluster/status?cluster=a3|muxi
 *
 * Returns a JSON overview of the K8s cluster (nodes, jobs, pods).
 * This endpoint runs read-only kubectl commands only.
 * The optional `cluster` query parameter selects the target cluster (default: a3).
 */
export async function GET(request: NextRequest) {
  // Load config from DB (primary) with env fallback
  const k8sConfig = await getK8sConfig();
  const kubeconfigPath = k8sConfig.kubeconfigPath;

  if (!kubeconfigPath) {
    return NextResponse.json(
      { configured: false, error: "KUBECONFIG_PATH not set" },
      { status: 200 }
    );
  }

  const clusterParam = request.nextUrl.searchParams.get("cluster") || "a3";
  const contextName = k8sConfig.clusterContextMap[clusterParam] || k8sConfig.clusterContextMap.a3;

  const run = (args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> =>
    new Promise((resolve) => {
      execFile(
        "kubectl",
        [...args, "--kubeconfig", kubeconfigPath, "--context", contextName],
        {
          timeout: 15_000,
          maxBuffer: 1024 * 1024,
          env: { ...baseExecEnv, KUBECONFIG: kubeconfigPath } as NodeJS.ProcessEnv,
        },
        (error, stdout, stderr) => {
          resolve({
            stdout: (stdout || "").slice(0, 30000),
            stderr: (stderr || "").slice(0, 2000),
            exitCode: error ? 1 : 0,
          });
        }
      );
    });

  try {
    const [nodesResult, jobsResult, podsResult] = await Promise.all([
      run(["get", "nodes", "-o", "json"]),
      run(["get", "jobs", "--all-namespaces", "-o", "json"]),
      run(["get", "pods", "--all-namespaces", "-o", "json", "--field-selector", "status.phase!=Succeeded"]),
    ]);

    // If nodes query fails, the cluster connection is broken
    if (nodesResult.exitCode !== 0) {
      return NextResponse.json({
        configured: true,
        cluster: clusterParam,
        error: nodesResult.stderr || "Failed to connect to cluster",
        nodes: [],
        jobs: [],
        pods: [],
        timestamp: new Date().toISOString(),
      });
    }

    const parseItems = (raw: string) => {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.items) ? parsed.items : [];
      } catch {
        return [];
      }
    };

    const nodes = parseItems(nodesResult.stdout).map(
      (n: Record<string, unknown>) => {
        const meta = n.metadata as Record<string, unknown> | undefined;
        const status = n.status as Record<string, unknown> | undefined;
        const conditions = (status?.conditions ?? []) as Array<Record<string, string>>;
        const ready = conditions.find((c) => c.type === "Ready");
        const allocatable = (status?.allocatable ?? {}) as Record<string, string>;
        return {
          name: meta?.name ?? "unknown",
          ready: ready?.status === "True",
          roles: Object.keys((meta?.labels ?? {}) as Record<string, string>)
            .filter((l) => l.startsWith("node-role.kubernetes.io/"))
            .map((l) => l.replace("node-role.kubernetes.io/", "")),
          cpu: allocatable.cpu ?? "?",
          memory: allocatable.memory ?? "?",
          gpu: allocatable["huawei.com/Ascend910"] ?? allocatable["metax-tech.com/gpu"] ?? allocatable["nvidia.com/gpu"] ?? "0",
        };
      }
    );

    const jobs = parseItems(jobsResult.stdout).map(
      (j: Record<string, unknown>) => {
        const meta = j.metadata as Record<string, unknown> | undefined;
        const status = j.status as Record<string, unknown> | undefined;
        return {
          name: meta?.name ?? "unknown",
          namespace: meta?.namespace ?? "default",
          active: (status?.active as number) ?? 0,
          succeeded: (status?.succeeded as number) ?? 0,
          failed: (status?.failed as number) ?? 0,
          createdAt: (meta?.creationTimestamp as string) ?? "",
        };
      }
    );

    const pods = parseItems(podsResult.stdout).map(
      (p: Record<string, unknown>) => {
        const meta = p.metadata as Record<string, unknown> | undefined;
        const status = p.status as Record<string, unknown> | undefined;
        return {
          name: meta?.name ?? "unknown",
          namespace: meta?.namespace ?? "default",
          phase: (status?.phase as string) ?? "Unknown",
          nodeName: ((p.spec as Record<string, unknown> | undefined)?.nodeName as string) ?? "",
        };
      }
    );

    return NextResponse.json({
      configured: true,
      cluster: clusterParam,
      nodes,
      jobs: jobs.slice(0, 100),
      pods: pods.slice(0, 200),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ configured: true, cluster: clusterParam, error: msg }, { status: 500 });
  }
}
