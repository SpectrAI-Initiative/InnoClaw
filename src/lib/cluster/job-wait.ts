import type { createKubectlExecutor, KubectlRequest } from "./kubectl-executor";

type KubectlExecutor = ReturnType<typeof createKubectlExecutor>;

export interface K8sJobResource {
  metadata?: {
    name?: string;
    namespace?: string;
  };
  status?: {
    active?: number;
    succeeded?: number;
    failed?: number;
    completionTime?: string;
    conditions?: Array<{
      type?: string;
      status?: string;
      reason?: string;
      message?: string;
    }>;
  };
}

export interface K8sPodItem {
  metadata?: {
    name?: string;
    creationTimestamp?: string;
  };
  status?: {
    phase?: string;
    reason?: string;
    message?: string;
    conditions?: Array<{
      type?: string;
      status?: string;
      reason?: string;
      message?: string;
    }>;
    containerStatuses?: Array<{
      state?: {
        waiting?: {
          reason?: string;
          message?: string;
        };
        terminated?: {
          reason?: string;
          message?: string;
        };
      };
    }>;
  };
}

export function summarizeK8sJob(job: K8sJobResource) {
  return {
    name: job.metadata?.name ?? "unknown",
    namespace: job.metadata?.namespace ?? null,
    active: job.status?.active ?? 0,
    succeeded: job.status?.succeeded ?? 0,
    failed: job.status?.failed ?? 0,
    completionTime: job.status?.completionTime,
    conditions: job.status?.conditions ?? [],
  };
}

function resolveTerminalStatus(
  job: K8sJobResource,
): "complete" | "failed" | null {
  const conditions = job.status?.conditions ?? [];
  if (
    conditions.some(
      (condition) => condition.type === "Failed" && condition.status === "True",
    )
  ) {
    return "failed";
  }
  if (
    conditions.some(
      (condition) =>
        condition.type === "Complete" && condition.status === "True",
    )
  ) {
    return "complete";
  }
  return null;
}

export function pickNewestPod(items: K8sPodItem[]): K8sPodItem | undefined {
  return [...items].sort((left, right) =>
    (right.metadata?.creationTimestamp ?? "").localeCompare(
      left.metadata?.creationTimestamp ?? "",
    ),
  )[0];
}

export function resolvePodFailure(item?: K8sPodItem) {
  if (!item) return null;
  const podName = item.metadata?.name;
  const waiting = item.status?.containerStatuses
    ?.map((status) => status.state?.waiting)
    .find(Boolean);
  const terminalWaitingReasons = new Set([
    "ImagePullBackOff",
    "ErrImagePull",
    "CreateContainerConfigError",
    "CreateContainerError",
    "InvalidImageName",
    "RunContainerError",
  ]);

  if (waiting?.reason && terminalWaitingReasons.has(waiting.reason)) {
    return {
      podName,
      failureReason: waiting.reason,
      failureMessage: waiting.message,
    };
  }

  const terminated = item.status?.containerStatuses
    ?.map((status) => status.state?.terminated)
    .find(Boolean);
  if (
    terminated?.reason &&
    terminated.reason !== "Completed" &&
    item.status?.phase !== "Succeeded"
  ) {
    return {
      podName,
      failureReason: terminated.reason,
      failureMessage: terminated.message,
    };
  }

  const unschedulable = item.status?.conditions?.find(
    (condition) =>
      condition.type === "PodScheduled" &&
      condition.status === "False" &&
      condition.reason === "Unschedulable",
  );
  if (unschedulable) {
    return {
      podName,
      failureReason: unschedulable.reason,
      failureMessage: unschedulable.message,
    };
  }

  if (item.status?.phase === "Failed") {
    return {
      podName,
      failureReason: item.status.reason ?? "Failed",
      failureMessage: item.status.message,
    };
  }

  return null;
}

async function fetchPods(
  executor: KubectlExecutor,
  scope: Pick<KubectlRequest, "kubeconfigPath" | "context" | "namespace" | "env">,
  jobName: string,
): Promise<K8sPodItem[]> {
  const result = await executor.runJson<{ items?: K8sPodItem[] }>({
    ...scope,
    args: ["get", "pods", "-l", `job-name=${jobName}`, "-o", "json"],
  });
  return result.data.items ?? [];
}

export async function waitForK8sJob(options: {
  executor: KubectlExecutor;
  scope: Pick<KubectlRequest, "kubeconfigPath" | "context" | "namespace" | "env">;
  jobName: string;
  timeoutSeconds: number;
  pollIntervalSeconds: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}) {
  const now = options.now ?? (() => Date.now());
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const deadline = now() + options.timeoutSeconds * 1000;
  let polls = 0;

  while (true) {
    polls += 1;
    const jobResult = await options.executor.runJson<K8sJobResource>({
      ...options.scope,
      args: ["get", "job", options.jobName, "-o", "json"],
    });
    const job = summarizeK8sJob(jobResult.data);
    const terminal = resolveTerminalStatus(jobResult.data);
    if (terminal) {
      return { status: terminal, polls, job };
    }

    const pods = await fetchPods(options.executor, options.scope, options.jobName);
    const podFailure = resolvePodFailure(pickNewestPod(pods));
    if (podFailure) {
      return {
        status: "failed" as const,
        polls,
        job,
        ...podFailure,
      };
    }

    if (now() >= deadline) {
      return { status: "timeout" as const, polls, job };
    }

    await sleep(options.pollIntervalSeconds * 1000);
  }
}

export async function collectK8sJobLogs(options: {
  executor: KubectlExecutor;
  scope: Pick<KubectlRequest, "kubeconfigPath" | "context" | "namespace" | "env">;
  jobName: string;
  tailLines: number;
}) {
  const pods = await fetchPods(options.executor, options.scope, options.jobName);
  const podName = pickNewestPod(pods)?.metadata?.name;
  if (!podName) {
    return {
      podName: null,
      logs: "",
      logsError: "No pod found for job",
    };
  }

  const logs = await options.executor.runText({
    ...options.scope,
    args: ["logs", podName, "--tail", String(options.tailLines)],
  });
  return {
    podName,
    logs: logs.data,
  };
}
