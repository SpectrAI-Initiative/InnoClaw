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

const DEFAULT_CONTAINER_IMAGE =
  "registry2.d.pjlab.org.cn/ccr-hw/910c:82rc2ipc";

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

/** Flags that could bypass the fixed KUBECONFIG. */
const FORBIDDEN_FLAGS = [
  "--kubeconfig", "--context", "--cluster", "--server",
  "--token", "--as", "--as-group", "--certificate-authority",
  "--client-certificate", "--client-key", "--insecure-skip-tls-verify",
];

/**
 * Generate a clean Volcano Job YAML from template parameters.
 * Based on config/d_k8s_job.yaml structure, stripped of runtime fields.
 * Submitter, PVC, and imagePullSecrets are parameterized via env vars with defaults.
 */
function generateVolcanoJobYaml(params: {
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

  const rawSubmitter = process.env.K8S_SUBMITTER || "tangshixiang";
  const submitter = yamlEscape(rawSubmitter);
  const imagePullSecret = yamlEscape(process.env.K8S_IMAGE_PULL_SECRET || rawSubmitter);
  const pvcAi4s = yamlEscape(process.env.K8S_PVC_AI4S || "pvc-mdjl8");
  const pvcUser = yamlEscape(process.env.K8S_PVC_USER || "pvc-tzsf9");
  const pvcAi4sA2 = yamlEscape(process.env.K8S_PVC_AI4S_A2 || "pvc-r4sjn");
  const mountUser = yamlEscape(process.env.K8S_MOUNT_USER || rawSubmitter);

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

export function createK8sTools(ctx: ToolContext) {
  return {
    kubectl: tool({
      description:
        "Execute kubectl or vcctl commands against the configured Kubernetes cluster (Volcano scheduler, Ascend910 NPUs). Use for monitoring pods, jobs, deployments, nodes, logs, and cluster status. Set useVcctl=true to use the vcctl CLI for Volcano job management (job get/run/delete/clone/suspend/resume, pod get/logs/exec). Mutating operations require confirmDangerous=true.",
      inputSchema: z.object({
        subcommand: z
          .string()
          .describe(
            "The subcommand and arguments, e.g. 'get pods -n default', 'get vcjob', 'describe node host-10-12-104-1', 'logs my-pod --tail=100'. Do NOT include the 'kubectl' or 'vcctl' prefix."
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
      execute: async ({ subcommand, namespace, useVcctl, confirmDangerous }) => {
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
            summary: `Blocked: ${blockedBin} ${subcommand.slice(0, 80)}`,
            input: { subcommand, namespace, useVcctl },
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
            summary: `Forbidden: ${forbiddenBin} ${subcommand.slice(0, 80)}`,
            input: { subcommand, namespace, useVcctl },
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
                summary: `${bin} ${subcommand.slice(0, 80)}`,
                input: { subcommand, namespace, useVcctl },
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
        `Submit a Volcano K8s job to the D cluster (Ascend 910B NPUs). Generates a job YAML from the standard template and submits it via kubectl. IMPORTANT: Before using this tool, always confirm with the user: (1) the container image to use (default: ${DEFAULT_CONTAINER_IMAGE}), (2) the GPU count (default: 4), and (3) the exact command to run. Set confirmSubmit=true only after the user has explicitly confirmed.`,
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
        image: z
          .string()
          .optional()
          .describe(
            `Container image. Default: '${DEFAULT_CONTAINER_IMAGE}'`
          ),
        gpuCount: z
          .number()
          .optional()
          .describe(
            "Number of Ascend 910B NPUs to request. Default: 4. Common values: 1, 2, 4, 8."
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
            "Set this to true only after you have explicitly confirmed with the user the container image, GPU count, and exact command. If false or omitted, the job will NOT be submitted."
          ),
      }),
      execute: async ({ jobName, command, image, gpuCount, namespace, confirmSubmit = false }) => {
        if (!confirmSubmit) {
          return {
            success: false,
            error:
              "Job submission blocked: confirmSubmit must be true to submit a K8s job. First confirm with the user the container image, GPU count, and exact command, then call this tool again with confirmSubmit set to true.",
            stdout: "",
            stderr: "",
            exitCode: 1,
          };
        }

        const resolvedImage = image || DEFAULT_CONTAINER_IMAGE;
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

        const yaml = generateVolcanoJobYaml({
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
              ["create", "-f", tmpFile],
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
            summary: `Submit ${jobName} (${resolvedGpuCount} GPUs)`,
            input: { jobName, command, image: resolvedImage, gpuCount: resolvedGpuCount },
            output: { exitCode: result.exitCode, success: result.exitCode === 0 },
          }).catch(logAndIgnore("recordClusterOp"));

          return {
            success: result.exitCode === 0,
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
        "Useful for automated result collection after job submission. " +
        "Returns the job status and the last N lines of logs from the job's pods.",
      inputSchema: z.object({
        jobName: z
          .string()
          .describe("Name of the K8s job to collect results from"),
        namespace: z
          .string()
          .optional()
          .describe("Kubernetes namespace. Default: 'default'."),
        tailLines: z
          .number()
          .optional()
          .describe("Number of log lines to fetch (default: 200, max: 2000)"),
      }),
      execute: async ({ jobName, namespace, tailLines }) => {
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
          summary: `Collect results for ${jobName}`,
          input: { jobName, namespace: resolvedNamespace, tailLines: resolvedTailLines },
          output: { jobStatus, logsLength: logsResult.stdout.length },
        }).catch(logAndIgnore("recordClusterOp"));

        return result;
      },
    }),
  };
}
