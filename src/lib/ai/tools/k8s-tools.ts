import { tool } from "ai";
import { z } from "zod";
import { execFile } from "child_process";
import path from "path";
import os from "os";
import fsp from "fs/promises";
import { recordClusterOp } from "@/lib/cluster/operations";
import { TRUNCATE, BUFFER } from "@/lib/constants";
import { parseShellArgs } from "@/lib/utils/shell";
import { yamlEscape } from "@/lib/utils/yaml";
import { isValidDnsLabel, isValidImageRef } from "@/lib/utils/validators";
import { logAndIgnore } from "@/lib/utils/log";
import type { ToolContext } from "./types";

import type { K8sConfig } from "@/lib/cluster/config";

/** Cluster short-name enum used by all K8s tools. */
const CLUSTER_ENUM = ["a3", "muxi"] as const;
type ClusterName = (typeof CLUSTER_ENUM)[number];

/** Read-only kubectl subcommands that don't require confirmDangerous. */
const READ_ONLY_PATTERNS = [
  /^get\b/,
  /^describe\b/,
  /^logs\b/,
  /^top\b/,
  /^config\s+view\b/,
  /^config\s+current-context\b/,
  /^config\s+get-contexts\b/,
  /^cluster-info\b/,
  /^api-resources\b/,
  /^api-versions\b/,
  /^version\b/,
  /^auth\s+can-i\b/,
  /^explain\b/,
  /^events?\b/,
  /^job\s+get\b/,
  /^pod\s+get\b/,
  /^pod\s+logs\b/,
];

/** Permanently forbidden kubectl subcommands. */
const FORBIDDEN_PATTERNS = [
  /^delete\s+(namespace|ns)\s+(kube-system|kube-public|default)\b/,
  /^delete\s+node\b/,
];

/** Flags that could bypass the fixed KUBECONFIG (user-supplied subcommand). */
const FORBIDDEN_FLAGS = [
  "--kubeconfig", "--context", "--cluster", "--server",
  "--token", "--as", "--as-group", "--certificate-authority",
  "--client-certificate", "--client-key", "--insecure-skip-tls-verify",
];

/** Resolve a cluster short-name to its kubeconfig --context value. */
function resolveContext(ctx: ToolContext, cluster: ClusterName): string {
  return ctx.k8sConfig.clusterContextMap[cluster] || ctx.k8sConfig.clusterContextMap.a3 || "vc-a3-ai4s";
}

/** Return the default container image for the given cluster. */
function defaultImageForCluster(k8s: K8sConfig, cluster: ClusterName): string {
  return cluster === "muxi" ? k8s.muxi.defaultImage : k8s.a3.defaultImage;
}

/**
 * Generate a Volcano Job YAML for the A3 cluster (Ascend 910B NPUs).
 */
function generateA3VolcanoJobYaml(k8s: K8sConfig, params: {
  jobName: string;
  command: string;
  image: string;
  gpuCount: number;
  namespace: string;
}): string {
  const { jobName, command, image, gpuCount, namespace } = params;

  const safeCommand = yamlEscape(command);
  const safeImage = yamlEscape(image);
  const safeNamespace = yamlEscape(namespace);
  const safeJobName = yamlEscape(jobName);

  const submitter = yamlEscape(k8s.submitter);
  const imagePullSecret = yamlEscape(k8s.imagePullSecret);
  const pvcAi4s = yamlEscape(k8s.a3.pvcAi4s);
  const pvcUser = yamlEscape(k8s.a3.pvcUser);
  const pvcAi4sA2 = yamlEscape(k8s.a3.pvcAi4sA2);
  const mountUser = yamlEscape(k8s.mountUser);

  return `apiVersion: batch.volcano.sh/v1alpha1
kind: Job
metadata:
  name: '${safeJobName}'
  namespace: '${safeNamespace}'
  labels:
    lepton.sensetime.com/framework-type: 'PyTorch'
    lepton.sensetime.com/submitter: '${submitter}'
    ring-controller.atlas: 'ascend-910b'
  annotations:
    sp-block: '${gpuCount}'
spec:
  schedulerName: 'volcano'
  minAvailable: 1
  tasks:
    - name: 'worker'
      replicas: 1
      template:
        metadata:
          labels:
            lepton.sensetime.com/submitter: '${submitter}'
            ring-controller.atlas: 'ascend-910b'
        spec:
          volumes:
            - name: 'vol-ai4s'
              persistentVolumeClaim:
                claimName: '${pvcAi4s}'
            - name: 'vol-user'
              persistentVolumeClaim:
                claimName: '${pvcUser}'
            - name: 'vol-ai4s-a2'
              persistentVolumeClaim:
                claimName: '${pvcAi4sA2}'
            - name: 'shm-data'
              emptyDir:
                medium: 'Memory'
                sizeLimit: '64Gi'
          containers:
            - name: 'worker'
              image: '${safeImage}'
              command:
                - 'bash'
                - '-c'
              args:
                - '${safeCommand}'
              resources:
                limits:
                  cpu: '64'
                  huawei.com/Ascend910: '${gpuCount}'
                  memory: '480Gi'
                requests:
                  cpu: '64'
                  huawei.com/Ascend910: '${gpuCount}'
                  memory: '480Gi'
              volumeMounts:
                - name: 'vol-ai4s'
                  mountPath: '/mnt/ai4s'
                - name: 'vol-user'
                  mountPath: '/mnt/${mountUser}'
                - name: 'vol-ai4s-a2'
                  mountPath: '/mnt/ai4s-a2'
                - name: 'shm-data'
                  mountPath: '/dev/shm'
              imagePullPolicy: 'IfNotPresent'
          restartPolicy: 'Never'
          nodeSelector:
            accelerator-type: 'module-910c-8'
            host-arch: 'huawei-arm'
          imagePullSecrets:
            - name: '${imagePullSecret}'
          affinity:
            nodeAffinity:
              requiredDuringSchedulingIgnoredDuringExecution:
                nodeSelectorTerms:
                  - matchExpressions:
                      - key: 'resource.compute.sensecore.cn/machine-type'
                        operator: 'In'
                        values:
                          - 'h2ls.ru.k10'
      policies:
        - action: 'RestartJob'
          event: 'PodEvicted'
      maxRetry: 3
  policies:
    - action: 'RestartJob'
      event: 'PodEvicted'
  plugins:
    hcclrank: []
    pytorch:
      - '--master=master'
      - '--worker=worker'
      - '--port=23456'
    svc: []
  queue: 'default'
  maxRetry: 1
  priorityClassName: 'normal'`;
}

/**
 * Generate a Volcano Job YAML for the Muxi cluster (MetaX GPUs).
 */
function generateMuxiVolcanoJobYaml(k8s: K8sConfig, params: {
  jobName: string;
  command: string;
  image: string;
  gpuCount: number;
  namespace: string;
}): string {
  const { jobName, command, image, gpuCount, namespace } = params;

  const safeCommand = yamlEscape(command);
  const safeImage = yamlEscape(image);
  const safeNamespace = yamlEscape(namespace);
  const safeJobName = yamlEscape(jobName);

  const submitter = yamlEscape(k8s.submitter);
  const imagePullSecret = yamlEscape(k8s.imagePullSecret);
  const pvcAi4s = yamlEscape(k8s.muxi.pvcAi4s);
  const pvcUser = yamlEscape(k8s.muxi.pvcUser);
  const pvcAi4sA2 = yamlEscape(k8s.muxi.pvcAi4sA2);
  const mountUser = yamlEscape(k8s.mountUser);

  return `apiVersion: batch.volcano.sh/v1alpha1
kind: Job
metadata:
  name: '${safeJobName}'
  namespace: '${safeNamespace}'
  labels:
    lepton.sensetime.com/framework-type: 'PyTorch'
    lepton.sensetime.com/submitter: '${submitter}'
    ring-controller.atlas: 'ascend-910b'
  annotations:
    sp-block: '${gpuCount}'
spec:
  schedulerName: 'volcano'
  minAvailable: 1
  tasks:
    - name: 'worker'
      replicas: 1
      template:
        metadata:
          labels:
            lepton.sensetime.com/submitter: '${submitter}'
            ring-controller.atlas: 'ascend-910b'
        spec:
          volumes:
            - name: 'vol-ai4s'
              persistentVolumeClaim:
                claimName: '${pvcAi4s}'
            - name: 'vol-user'
              persistentVolumeClaim:
                claimName: '${pvcUser}'
            - name: 'vol-ai4s-a2'
              persistentVolumeClaim:
                claimName: '${pvcAi4sA2}'
            - name: 'shm-data'
              emptyDir:
                medium: 'Memory'
                sizeLimit: '64Gi'
          containers:
            - name: 'worker'
              image: '${safeImage}'
              command:
                - 'bash'
                - '-c'
              args:
                - '${safeCommand}'
              resources:
                limits:
                  cpu: '224'
                  metax-tech.com/gpu: '${gpuCount}'
                  memory: '1440Gi'
                requests:
                  cpu: '224'
                  metax-tech.com/gpu: '${gpuCount}'
                  memory: '1440Gi'
              volumeMounts:
                - name: 'vol-ai4s'
                  mountPath: '/mnt/ai4s'
                - name: 'vol-user'
                  mountPath: '/mnt/${mountUser}'
                - name: 'vol-ai4s-a2'
                  mountPath: '/mnt/ai4s-a2'
                - name: 'shm-data'
                  mountPath: '/dev/shm'
              imagePullPolicy: 'IfNotPresent'
          restartPolicy: 'Never'
          imagePullSecrets:
            - name: '${imagePullSecret}'
          affinity:
            nodeAffinity:
              requiredDuringSchedulingIgnoredDuringExecution:
                nodeSelectorTerms:
                  - matchExpressions:
                      - key: 'resource.compute.sensecore.cn/machine-type'
                        operator: 'In'
                        values:
                          - 'x2ls.ri.i80'
      policies:
        - action: 'RestartJob'
          event: 'PodEvicted'
      maxRetry: 3
  policies:
    - action: 'RestartJob'
      event: 'PodEvicted'
  plugins:
    pytorch:
      - '--master=master'
      - '--worker=worker'
      - '--port=23456'
    svc: []
  queue: 'default'
  maxRetry: 1
  priorityClassName: 'normal'`;
}

/** Select the correct YAML generator based on cluster. */
function generateVolcanoJobYaml(
  k8s: K8sConfig,
  cluster: ClusterName,
  params: { jobName: string; command: string; image: string; gpuCount: number; namespace: string },
): string {
  return cluster === "muxi"
    ? generateMuxiVolcanoJobYaml(k8s, params)
    : generateA3VolcanoJobYaml(k8s, params);
}

export function createK8sTools(ctx: ToolContext) {
  const k8s = ctx.k8sConfig;
  const DEFAULT_A3_IMAGE = k8s.a3.defaultImage;
  const DEFAULT_MUXI_IMAGE = k8s.muxi.defaultImage;

  return {
    kubectl: tool({
      description:
        "Execute kubectl or vcctl commands against a Kubernetes cluster. Supports two clusters: 'a3' (Ascend 910B NPUs, default) and 'muxi' (MetaX GPUs). Use for monitoring pods, jobs, deployments, nodes, logs, and cluster status. Set useVcctl=true to use the vcctl CLI for Volcano job management. Mutating operations require confirmDangerous=true.",
      inputSchema: z.object({
        subcommand: z
          .string()
          .describe(
            "The subcommand and arguments, e.g. 'get pods -n default', 'get vcjob', 'describe node host-10-12-104-1', 'logs my-pod --tail=100'. Do NOT include the 'kubectl' or 'vcctl' prefix."
          ),
        cluster: z
          .enum(CLUSTER_ENUM)
          .optional()
          .describe(
            "Target cluster: 'a3' (A3 cluster, Ascend 910B NPUs, default) or 'muxi' (沐曦 cluster, MetaX GPUs)."
          ),
        namespace: z
          .string()
          .optional()
          .describe(
            "Kubernetes namespace (\u4e00\u822c\u4e3a\u7528\u6237AD\u8d26\u6237\u540d\u5b57). If omitted, uses the default namespace or the one specified in the subcommand."
          ),
        useVcctl: z
          .boolean()
          .optional()
          .describe(
            "Set to true to use vcctl instead of kubectl. Use vcctl for Volcano job management: job get/run/delete/clone/suspend/resume, pod get/logs/exec, image load."
          ),
        confirmDangerous: z
          .boolean()
          .optional()
          .describe(
            "Must be set to true to execute non-read-only operations (anything not in the allowlist: get, describe, logs, top, etc.). Default is false."
          ),
      }),
      execute: async ({ subcommand, cluster, namespace, useVcctl, confirmDangerous }) => {
        const resolvedCluster: ClusterName = cluster || "a3";
        const contextName = resolveContext(ctx, resolvedCluster);

        const isReadOnly = READ_ONLY_PATTERNS.some((p) =>
          p.test(subcommand.trim())
        );

        if (!isReadOnly && !confirmDangerous) {
          const blockedBin = useVcctl ? "vcctl" : "kubectl";
          recordClusterOp({
            workspaceId: ctx.workspaceId,
            toolName: "kubectl",
            subcommand,
            namespace,
            status: "blocked",
            summary: `Blocked: ${blockedBin} ${subcommand.slice(0, 80)} [${resolvedCluster}]`,
            input: { subcommand, namespace, useVcctl, cluster: resolvedCluster },
          }).catch(logAndIgnore("recordClusterOp"));

          return {
            stdout: "",
            stderr: `SAFETY BLOCK: "${subcommand}" may modify the cluster. Set confirmDangerous=true to proceed.`,
            exitCode: 1,
            blocked: true,
          };
        }

        if (FORBIDDEN_PATTERNS.some((p) => p.test(subcommand.trim()))) {
          const forbiddenBin = useVcctl ? "vcctl" : "kubectl";
          recordClusterOp({
            workspaceId: ctx.workspaceId,
            toolName: "kubectl",
            subcommand,
            namespace,
            status: "blocked",
            summary: `Forbidden: ${forbiddenBin} ${subcommand.slice(0, 80)} [${resolvedCluster}]`,
            input: { subcommand, namespace, useVcctl, cluster: resolvedCluster },
          }).catch(logAndIgnore("recordClusterOp"));

          return {
            stdout: "",
            stderr: `FORBIDDEN: "${subcommand}" is permanently blocked for safety.`,
            exitCode: 1,
            blocked: true,
          };
        }

        const bin = useVcctl ? "vcctl" : "kubectl";
        const args = parseShellArgs(subcommand.trim());

        const hasOverrideFlag = args.some((arg) =>
          FORBIDDEN_FLAGS.some((flag) => arg === flag || arg.startsWith(flag + "="))
        );
        if (hasOverrideFlag) {
          return {
            stdout: "",
            stderr: `SAFETY BLOCK: subcommand contains a context-override flag (e.g. --kubeconfig, --context, --token). These are not allowed.`,
            exitCode: 1,
            blocked: true,
          };
        }

        args.push("--kubeconfig", ctx.kubeconfigPath);
        args.push("--context", contextName);

        if (
          !useVcctl &&
          namespace &&
          !subcommand.includes("-n ") &&
          !subcommand.includes("--namespace") &&
          !subcommand.includes("--all-namespaces")
        ) {
          args.push("-n", namespace);
        }

        return new Promise<{
          stdout: string;
          stderr: string;
          exitCode: number;
          blocked?: boolean;
        }>((resolve) => {
          execFile(
            bin,
            args,
            {
              cwd: ctx.validatedCwd,
              timeout: 30_000,
              maxBuffer: BUFFER.DEFAULT,
              env: {
                ...ctx.baseExecEnv,
                KUBECONFIG: ctx.kubeconfigPath,
              } as NodeJS.ProcessEnv,
            },
            (error: Error | null, stdout: string, stderr: string) => {
              const result = {
                stdout: (stdout || "").slice(0, TRUNCATE.STDOUT),
                stderr: (stderr || "").slice(0, TRUNCATE.STDERR),
                exitCode: (error as NodeJS.ErrnoException)?.code
                  ? Number((error as NodeJS.ErrnoException).code) || 1
                  : error
                    ? 1
                    : 0,
              };

              recordClusterOp({
                workspaceId: ctx.workspaceId,
                toolName: "kubectl",
                subcommand,
                namespace,
                status: result.exitCode === 0 ? "success" : "error",
                exitCode: result.exitCode,
                summary: `${bin} ${subcommand.slice(0, 80)} [${resolvedCluster}]`,
                input: { subcommand, namespace, useVcctl, cluster: resolvedCluster },
                output: { exitCode: result.exitCode, stdoutLen: result.stdout.length },
              }).catch(logAndIgnore("recordClusterOp"));

              resolve(result);
            }
          );
        });
      },
    }),

    submitK8sJob: tool({
      description:
        `Submit a Volcano K8s job to a cluster. Supports two clusters: 'a3' (A3 cluster, Ascend 910B NPUs, default image: ${DEFAULT_A3_IMAGE}) and 'muxi' (沐曦 cluster, MetaX GPUs, default image: ${DEFAULT_MUXI_IMAGE}). Generates a cluster-specific job YAML and submits via kubectl. IMPORTANT: Before using this tool, always confirm with the user: (1) the target cluster, (2) the container image, (3) the GPU count (default: 4), and (4) the exact command to run. Set confirmSubmit=true only after the user has explicitly confirmed.`,
      inputSchema: z.object({
        jobName: z
          .string()
          .describe(
            "Unique name for the Volcano job (DNS-compatible: lowercase alphanumeric and hyphens, max 63 chars). Example: 'hello-world-test-01'"
          ),
        command: z
          .string()
          .describe(
            "The bash command to run inside the container. For scripts, use the full path, e.g. 'bash /mnt/tangshixiang/research_folder/research/hello_word.sh'."
          ),
        cluster: z
          .enum(CLUSTER_ENUM)
          .optional()
          .describe(
            "Target cluster: 'a3' (A3 cluster, Ascend 910B NPUs, default) or 'muxi' (沐曦 cluster, MetaX GPUs)."
          ),
        image: z
          .string()
          .optional()
          .describe(
            `Container image. Default depends on cluster: A3='${DEFAULT_A3_IMAGE}', Muxi='${DEFAULT_MUXI_IMAGE}'`
          ),
        gpuCount: z
          .number()
          .optional()
          .describe(
            "Number of GPUs to request. Default: 4. For A3: Ascend 910B NPUs; for Muxi: MetaX GPUs. Common values: 1, 2, 4, 8."
          ),
        namespace: z
          .string()
          .optional()
          .describe(
            "Kubernetes namespace. Default: 'default'."
          ),
        confirmSubmit: z
          .boolean()
          .optional()
          .describe(
            "Set this to true only after you have explicitly confirmed with the user the target cluster, container image, GPU count, and exact command. If false or omitted, the job will NOT be submitted."
          ),
      }),
      execute: async ({ jobName, command, cluster, image, gpuCount, namespace, confirmSubmit = false }) => {
        const resolvedCluster: ClusterName = cluster || "a3";
        const contextName = resolveContext(ctx, resolvedCluster);

        if (!confirmSubmit) {
          return {
            success: false,
            error:
              "Job submission blocked: confirmSubmit must be true to submit a K8s job. First confirm with the user the target cluster, container image, GPU count, and exact command, then call this tool again with confirmSubmit set to true.",
            stdout: "",
            stderr: "",
            exitCode: 1,
          };
        }

        const resolvedImage = image || defaultImageForCluster(k8s, resolvedCluster);
        const resolvedGpuCount = gpuCount ?? 4;
        const resolvedNamespace = namespace || "default";

        if (!isValidDnsLabel(jobName)) {
          return {
            success: false,
            error:
              "Invalid jobName: must be lowercase alphanumeric with hyphens, start/end with alphanumeric, max 63 chars.",
            stdout: "",
            stderr: "",
            exitCode: 1,
          };
        }

        if (!isValidDnsLabel(resolvedNamespace)) {
          return {
            success: false,
            error:
              "Invalid namespace: must be a valid DNS label (lowercase alphanumeric with hyphens, max 63 chars).",
            stdout: "",
            stderr: "",
            exitCode: 1,
          };
        }

        if (!isValidImageRef(resolvedImage)) {
          return {
            success: false,
            error:
              "Invalid image: must be a valid OCI image reference.",
            stdout: "",
            stderr: "",
            exitCode: 1,
          };
        }

        if (resolvedGpuCount < 1 || resolvedGpuCount > 8) {
          return {
            success: false,
            error: "gpuCount must be between 1 and 8.",
            stdout: "",
            stderr: "",
            exitCode: 1,
          };
        }

        const yaml = generateVolcanoJobYaml(k8s, resolvedCluster, {
          jobName,
          command,
          image: resolvedImage,
          gpuCount: resolvedGpuCount,
          namespace: resolvedNamespace,
        });

        const tmpFile = path.join(
          os.tmpdir(),
          `vcjob-${jobName}-${Date.now()}.yaml`
        );

        try {
          await fsp.writeFile(tmpFile, yaml, "utf-8");

          const result = await new Promise<{
            stdout: string;
            stderr: string;
            exitCode: number;
          }>((resolve) => {
            execFile(
              "kubectl",
              ["create", "-f", tmpFile, "--kubeconfig", ctx.kubeconfigPath, "--context", contextName],
              {
                cwd: ctx.validatedCwd,
                timeout: 30_000,
                maxBuffer: BUFFER.DEFAULT,
                env: {
                  ...ctx.baseExecEnv,
                  KUBECONFIG: ctx.kubeconfigPath,
                } as NodeJS.ProcessEnv,
              },
              (error: Error | null, stdout: string, stderr: string) => {
                resolve({
                  stdout: (stdout || "").slice(0, TRUNCATE.STDOUT),
                  stderr: (stderr || "").slice(0, TRUNCATE.STDERR),
                  exitCode: (error as NodeJS.ErrnoException)?.code
                    ? Number((error as NodeJS.ErrnoException).code) || 1
                    : error
                      ? 1
                      : 0,
                });
              }
            );
          });

          recordClusterOp({
            workspaceId: ctx.workspaceId,
            toolName: "submitK8sJob",
            jobName,
            namespace: resolvedNamespace,
            status: result.exitCode === 0 ? "success" : "error",
            exitCode: result.exitCode,
            summary: `Submit ${jobName} (${resolvedGpuCount} GPUs) [${resolvedCluster}]`,
            input: { jobName, command, image: resolvedImage, gpuCount: resolvedGpuCount, cluster: resolvedCluster },
            output: { exitCode: result.exitCode, success: result.exitCode === 0 },
          }).catch(logAndIgnore("recordClusterOp"));

          return {
            success: result.exitCode === 0,
            cluster: resolvedCluster,
            jobName,
            namespace: resolvedNamespace,
            image: resolvedImage,
            gpuCount: resolvedGpuCount,
            command,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            ...(result.exitCode !== 0 ? { yaml } : {}),
          };
        } finally {
          await fsp.unlink(tmpFile).catch(logAndIgnore("tmpFileCleanup"));
        }
      },
    }),

    collectJobResults: tool({
      description:
        "Collect and summarize the results (logs, status, exit code) of a completed K8s job. " +
        "Supports two clusters: 'a3' (default) and 'muxi'. " +
        "Returns the job status and the last N lines of logs from the job's pods.",
      inputSchema: z.object({
        jobName: z
          .string()
          .describe("Name of the K8s job to collect results from"),
        cluster: z
          .enum(CLUSTER_ENUM)
          .optional()
          .describe(
            "Target cluster: 'a3' (A3 cluster, default) or 'muxi' (沐曦 cluster)."
          ),
        namespace: z
          .string()
          .optional()
          .describe("Kubernetes namespace. Default: 'default'."),
        tailLines: z
          .number()
          .optional()
          .describe("Number of log lines to fetch (default: 200, max: 2000)"),
      }),
      execute: async ({ jobName, cluster, namespace, tailLines }) => {
        const resolvedCluster: ClusterName = cluster || "a3";
        const contextName = resolveContext(ctx, resolvedCluster);
        const resolvedNamespace = namespace || "default";
        const resolvedTailLines = Math.max(1, Math.min(tailLines ?? 200, 2000));

        if (!isValidDnsLabel(jobName)) {
          return {
            success: false,
            error: "Invalid jobName: must be a valid DNS label.",
          };
        }

        if (!isValidDnsLabel(resolvedNamespace)) {
          return {
            success: false,
            error: "Invalid namespace: must be a valid DNS label.",
          };
        }

        // Run status and logs queries concurrently — they are independent reads
        const [statusResult, logsResult] = await Promise.all([
          new Promise<{
            stdout: string;
            stderr: string;
            exitCode: number;
          }>((resolve) => {
            execFile(
              "kubectl",
              [
                "get", "job", jobName,
                "-n", resolvedNamespace,
                "-o", "json",
                "--kubeconfig", ctx.kubeconfigPath,
                "--context", contextName,
              ],
              {
                cwd: ctx.validatedCwd,
                timeout: 15_000,
                maxBuffer: BUFFER.DEFAULT,
                env: { ...ctx.baseExecEnv, KUBECONFIG: ctx.kubeconfigPath } as NodeJS.ProcessEnv,
              },
              (error: Error | null, stdout: string, stderr: string) => {
                resolve({
                  stdout: (stdout || "").slice(0, TRUNCATE.STDOUT_LARGE),
                  stderr: (stderr || "").slice(0, TRUNCATE.STDERR),
                  exitCode: error ? 1 : 0,
                });
              }
            );
          }),
          new Promise<{
            stdout: string;
            stderr: string;
            exitCode: number;
          }>((resolve) => {
            execFile(
              "kubectl",
              [
                "logs",
                `job/${jobName}`,
                "-n", resolvedNamespace,
                `--tail=${resolvedTailLines}`,
                "--kubeconfig", ctx.kubeconfigPath,
                "--context", contextName,
              ],
              {
                cwd: ctx.validatedCwd,
                timeout: 30_000,
                maxBuffer: BUFFER.LARGE,
                env: { ...ctx.baseExecEnv, KUBECONFIG: ctx.kubeconfigPath } as NodeJS.ProcessEnv,
              },
              (error: Error | null, stdout: string, stderr: string) => {
                resolve({
                  stdout: (stdout || "").slice(0, TRUNCATE.STDOUT_MAX),
                  stderr: (stderr || "").slice(0, TRUNCATE.STDERR),
                  exitCode: error ? 1 : 0,
                });
              }
            );
          }),
        ]);

        let jobStatus: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(statusResult.stdout);
          const s = parsed?.status ?? {};
          jobStatus = {
            active: s.active ?? 0,
            succeeded: s.succeeded ?? 0,
            failed: s.failed ?? 0,
            startTime: s.startTime ?? null,
            completionTime: s.completionTime ?? null,
            conditions: (s.conditions ?? []).map(
              (c: Record<string, string>) => ({
                type: c.type,
                status: c.status,
                reason: c.reason,
              })
            ),
          };
        } catch {
          jobStatus = { raw: statusResult.stdout.slice(0, TRUNCATE.JOB_STATUS) };
        }

        const result = {
          success: statusResult.exitCode === 0,
          cluster: resolvedCluster,
          jobName,
          namespace: resolvedNamespace,
          jobStatus,
          logs: logsResult.stdout,
          logsError: logsResult.stderr || undefined,
        };

        recordClusterOp({
          workspaceId: ctx.workspaceId,
          toolName: "collectJobResults",
          jobName,
          namespace: resolvedNamespace,
          status: statusResult.exitCode === 0 ? "success" : "error",
          exitCode: statusResult.exitCode,
          summary: `Collect results for ${jobName} [${resolvedCluster}]`,
          input: { jobName, namespace: resolvedNamespace, tailLines: resolvedTailLines, cluster: resolvedCluster },
          output: { jobStatus, logsLength: logsResult.stdout.length },
        }).catch(logAndIgnore("recordClusterOp"));

        return result;
      },
    }),
  };
}
