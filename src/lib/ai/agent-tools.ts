import { tool } from "ai";
import { z } from "zod";
import { exec, execFile } from "child_process";
import path from "path";
import os from "os";
import fsp from "fs/promises";
import { buildSafeExecEnv } from "@/lib/env";
import { recordClusterOp } from "@/lib/cluster/operations";
import {
  validatePath,
  readFile as fsReadFile,
  writeFile as fsWriteFile,
  listDirectory as fsListDirectory,
} from "@/lib/files/filesystem";
import {
  searchArticles as doSearchArticles,
  findRelatedArticles,
} from "@/lib/article-search";
import type { Article } from "@/lib/article-search";

/** Format an Article for LLM-friendly output. */
const MAX_AUTHORS_DISPLAY = 5;
const MAX_ABSTRACT_LENGTH = 500;

function formatArticle(a: Article) {
  return {
    id: a.id,
    title: a.title,
    authors: a.authors.slice(0, MAX_AUTHORS_DISPLAY).join(", ") + (a.authors.length > MAX_AUTHORS_DISPLAY ? " et al." : ""),
    abstract: a.abstract.length > MAX_ABSTRACT_LENGTH ? a.abstract.slice(0, MAX_ABSTRACT_LENGTH) + "…" : a.abstract,
    url: a.url,
    pdfUrl: a.pdfUrl,
    publishedDate: a.publishedDate,
    source: a.source,
  };
}

const DEFAULT_CONTAINER_IMAGE =
  "registry2.d.pjlab.org.cn/ccr-hw/910c:82rc2ipc";

/** Base environment variables for all exec() calls. */
const baseExecEnv = buildSafeExecEnv();

/**
 * Execute a shell command in the workspace directory and return truncated output.
 * Shared helper that eliminates boilerplate across bash and grep tools.
 */
function execInWorkspace(
  command: string,
  cwd: string,
  opts?: { timeout?: number; maxBuffer?: number; env?: Record<string, string> }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    exec(
      command,
      {
        cwd,
        timeout: opts?.timeout ?? 30_000,
        maxBuffer: opts?.maxBuffer ?? 1024 * 1024,
        env: { ...baseExecEnv, ...opts?.env } as NodeJS.ProcessEnv,
      },
      (error, stdout, stderr) => {
        resolve({
          stdout: (stdout || "").slice(0, 10000),
          stderr: (stderr || "").slice(0, 5000),
          exitCode: error?.code ?? (error ? 1 : 0),
        });
      }
    );
  });
}

/** Escape a value for use in a YAML single-quoted scalar (double any single quotes). */
function yamlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Parse a shell-style command string into an argv array.
 * Handles single-quoted, double-quoted, and unquoted tokens.
 * Backslash escaping within double quotes is supported.
 */
function parseShellArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    if (ch === "'") {
      // Single-quoted segment: take everything until closing '
      i++;
      while (i < len && input[i] !== "'") {
        current += input[i];
        i++;
      }
      i++; // skip closing '
    } else if (ch === '"') {
      // Double-quoted segment: supports backslash escaping
      i++;
      while (i < len && input[i] !== '"') {
        if (input[i] === "\\" && i + 1 < len) {
          i++;
          current += input[i];
        } else {
          current += input[i];
        }
        i++;
      }
      i++; // skip closing "
    } else if (/\s/.test(ch)) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
      i++;
    } else {
      current += ch;
      i++;
    }
  }

  if (current.length > 0) {
    args.push(current);
  }

  return args;
}

/** Validate that a string is a valid DNS label (used for namespace / jobName). */
function isValidDnsLabel(value: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value) && value.length <= 63;
}

/** Validate that a string looks like a valid OCI image reference. */
function isValidImageRef(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._\-/:@]+$/.test(value) && value.length <= 512;
}

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

  // Escape all interpolated values for YAML single-quoted string safety
  const safeCommand = yamlEscape(command);
  const safeImage = yamlEscape(image);
  const safeNamespace = yamlEscape(namespace);
  const safeJobName = yamlEscape(jobName);

  // Parameterized values from environment with defaults
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

export function createAgentTools(
  workspaceCwd: string,
  allowedTools?: string[] | null,
  workspaceId?: string | null
) {
  const validatedCwd = validatePath(workspaceCwd);

  const kubeconfigPath =
    process.env.KUBECONFIG_PATH ||
    path.join(process.cwd(), "config", "d_k8s");

  /**
   * Resolves a file path relative to the workspace and validates it against
   * allowed workspace roots.
   * @throws {Error} If the resolved path is outside the allowed workspace roots
   * or contains invalid characters (e.g. null bytes).
   */
  function resolvePath(filePath: string): string {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.join(validatedCwd, filePath);
    return validatePath(resolved);
  }

  const allTools = {
    bash: tool({
      description:
        "Execute a shell command in the workspace directory. Use for running builds, tests, git operations, package management, etc.",
      inputSchema: z.object({
        command: z.string().describe("The shell command to execute"),
      }),
      execute: async ({ command }) => {
        return execInWorkspace(command, validatedCwd);
      },
    }),

    readFile: tool({
      description:
        "Read a file's content. Path can be relative to workspace root or absolute.",
      inputSchema: z.object({
        filePath: z.string().describe("Path to the file to read"),
      }),
      execute: async ({ filePath }) => {
        const resolved = resolvePath(filePath);
        const content = await fsReadFile(resolved);
        const truncated =
          content.length > 50000
            ? content.slice(0, 50000) + "\n... (truncated)"
            : content;
        return { content: truncated, path: resolved };
      },
    }),

    writeFile: tool({
      description:
        "Write content to a file. Creates parent directories if needed. Use for creating or overwriting files.",
      inputSchema: z.object({
        filePath: z.string().describe("Path to the file to write"),
        content: z.string().describe("The content to write"),
      }),
      execute: async ({ filePath, content }) => {
        const resolved = resolvePath(filePath);
        await fsWriteFile(resolved, content);
        return {
          success: true,
          path: resolved,
          bytesWritten: content.length,
        };
      },
    }),

    listDirectory: tool({
      description:
        "List files and directories in a given path. Returns name, type, size, and modified time for each entry.",
      inputSchema: z.object({
        dirPath: z
          .string()
          .describe(
            "Path to the directory to list (defaults to workspace root if empty)"
          ),
      }),
      execute: async ({ dirPath }) => {
        const resolved = dirPath ? resolvePath(dirPath) : validatedCwd;
        const entries = await fsListDirectory(resolved);
        return {
          entries: entries.slice(0, 200).map((e) => ({
            name: e.name,
            type: e.type,
            size: e.size,
          })),
          total: entries.length,
          path: resolved,
        };
      },
    }),

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
        // Safety: allowlist read-only subcommands; require confirmation for everything else
        const readOnlyPatterns = [
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

        const isReadOnly = readOnlyPatterns.some((p) =>
          p.test(subcommand.trim())
        );

        if (!isReadOnly && !confirmDangerous) {
          // Record blocked attempt
          const blockedBin = useVcctl ? "vcctl" : "kubectl";
          recordClusterOp({
            workspaceId,
            toolName: "kubectl",
            subcommand,
            namespace,
            status: "blocked",
            summary: `Blocked: ${blockedBin} ${subcommand.slice(0, 80)}`,
            input: { subcommand, namespace, useVcctl },
          }).catch(() => {});

          return {
            stdout: "",
            stderr: `SAFETY BLOCK: "${subcommand}" may modify the cluster. Set confirmDangerous=true to proceed.`,
            exitCode: 1,
            blocked: true,
          };
        }

        // Block truly forbidden operations
        const forbiddenPatterns = [
          /^delete\s+(namespace|ns)\s+(kube-system|kube-public|default)\b/,
          /^delete\s+node\b/,
        ];

        if (forbiddenPatterns.some((p) => p.test(subcommand.trim()))) {
          // Record forbidden attempt
          const forbiddenBin = useVcctl ? "vcctl" : "kubectl";
          recordClusterOp({
            workspaceId,
            toolName: "kubectl",
            subcommand,
            namespace,
            status: "blocked",
            summary: `Forbidden: ${forbiddenBin} ${subcommand.slice(0, 80)}`,
            input: { subcommand, namespace, useVcctl },
          }).catch(() => {});

          return {
            stdout: "",
            stderr: `FORBIDDEN: "${subcommand}" is permanently blocked for safety.`,
            exitCode: 1,
            blocked: true,
          };
        }

        // Build the command as args array (no shell) using shell-style parsing
        const bin = useVcctl ? "vcctl" : "kubectl";
        const args = parseShellArgs(subcommand.trim());

        // Reject context-override flags that could bypass the fixed KUBECONFIG
        const forbiddenFlags = [
          "--kubeconfig", "--context", "--cluster", "--server",
          "--token", "--as", "--as-group", "--certificate-authority",
          "--client-certificate", "--client-key", "--insecure-skip-tls-verify",
        ];
        const hasOverrideFlag = args.some((arg) =>
          forbiddenFlags.some((flag) => arg === flag || arg.startsWith(flag + "="))
        );
        if (hasOverrideFlag) {
          return {
            stdout: "",
            stderr: `SAFETY BLOCK: subcommand contains a context-override flag (e.g. --kubeconfig, --context, --token). These are not allowed.`,
            exitCode: 1,
            blocked: true,
          };
        }

        // Always inject --kubeconfig to enforce the configured cluster
        args.push("--kubeconfig", kubeconfigPath);

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
              cwd: validatedCwd,
              timeout: 30_000,
              maxBuffer: 1024 * 1024,
              env: {
                ...baseExecEnv,
                KUBECONFIG: kubeconfigPath,
              },
            },
            (error: Error | null, stdout: string, stderr: string) => {
              const result = {
                stdout: (stdout || "").slice(0, 10000),
                stderr: (stderr || "").slice(0, 5000),
                exitCode: (error as NodeJS.ErrnoException)?.code
                  ? Number((error as NodeJS.ErrnoException).code) || 1
                  : error
                    ? 1
                    : 0,
              };

              // Record operation asynchronously (fire and forget)
              recordClusterOp({
                workspaceId,
                toolName: "kubectl",
                subcommand,
                namespace,
                status: result.exitCode === 0 ? "success" : "error",
                exitCode: result.exitCode,
                summary: `${bin} ${subcommand.slice(0, 80)}`,
                input: { subcommand, namespace, useVcctl },
                output: { exitCode: result.exitCode, stdoutLen: result.stdout.length },
              }).catch(() => {});

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

        // Validate jobName is DNS-compatible
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

        // Validate namespace is a DNS label
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

        // Validate image reference
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

        // Validate gpuCount
        if (resolvedGpuCount < 1 || resolvedGpuCount > 8) {
          return {
            success: false,
            error: "gpuCount must be between 1 and 8.",
            stdout: "",
            stderr: "",
            exitCode: 1,
          };
        }

        // Generate YAML
        const yaml = generateVolcanoJobYaml({
          jobName,
          command,
          image: resolvedImage,
          gpuCount: resolvedGpuCount,
          namespace: resolvedNamespace,
        });

        // Write to temp file, submit, clean up
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
                cwd: validatedCwd,
                timeout: 30_000,
                maxBuffer: 1024 * 1024,
                env: {
                  ...baseExecEnv,
                  KUBECONFIG: kubeconfigPath,
                },
              },
              (error: Error | null, stdout: string, stderr: string) => {
                resolve({
                  stdout: (stdout || "").slice(0, 10000),
                  stderr: (stderr || "").slice(0, 5000),
                  exitCode: (error as NodeJS.ErrnoException)?.code
                    ? Number((error as NodeJS.ErrnoException).code) || 1
                    : error
                      ? 1
                      : 0,
                });
              }
            );
          });

          // Record operation with actual result status
          recordClusterOp({
            workspaceId,
            toolName: "submitK8sJob",
            jobName,
            namespace: resolvedNamespace,
            status: result.exitCode === 0 ? "success" : "error",
            exitCode: result.exitCode,
            summary: `Submit ${jobName} (${resolvedGpuCount} GPUs)`,
            input: { jobName, command, image: resolvedImage, gpuCount: resolvedGpuCount },
            output: { exitCode: result.exitCode, success: result.exitCode === 0 },
          }).catch(() => {});

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
            // Only include YAML on failure for debugging; saves LLM tokens on success
            ...(result.exitCode !== 0 ? { yaml } : {}),
          };
        } finally {
          await fsp.unlink(tmpFile).catch(() => {});
        }
      },
    }),

    grep: tool({
      description:
        "Search for a regex pattern in files. Returns matching lines with file paths and line numbers.",
      inputSchema: z.object({
        pattern: z.string().describe("Regex pattern to search for"),
        path: z
          .string()
          .optional()
          .describe(
            "Directory or file to search in (defaults to workspace root)"
          ),
        include: z
          .string()
          .optional()
          .describe("File glob pattern to include, e.g. '*.ts'"),
      }),
      execute: async ({ pattern, path: searchPath, include }) => {
        const target = searchPath ? resolvePath(searchPath) : validatedCwd;

        let cmd = `grep -rn --max-count=50`;
        if (include) cmd += ` --include='${include.replace(/'/g, "'\\''")}'`;
        cmd += ` -- '${pattern.replace(/'/g, "'\\''")}' '${target.replace(/'/g, "'\\''")}'`;

        const result = await execInWorkspace(cmd, validatedCwd, {
          timeout: 15_000,
          maxBuffer: 512 * 1024,
        });
        return {
          matches: result.stdout.slice(0, 20000) || result.stderr,
          exitCode: result.exitCode,
        };
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

        // Validate jobName
        if (!isValidDnsLabel(jobName)) {
          return {
            success: false,
            error: "Invalid jobName: must be a valid DNS label.",
          };
        }

        // Validate namespace
        if (!isValidDnsLabel(resolvedNamespace)) {
          return {
            success: false,
            error: "Invalid namespace: must be a valid DNS label.",
          };
        }

        // 1. Get job status
        const statusResult = await new Promise<{
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
              "--kubeconfig", kubeconfigPath,
            ],
            {
              cwd: validatedCwd,
              timeout: 15_000,
              maxBuffer: 1024 * 1024,
              env: { ...baseExecEnv, KUBECONFIG: kubeconfigPath },
            },
            (error: Error | null, stdout: string, stderr: string) => {
              resolve({
                stdout: (stdout || "").slice(0, 20000),
                stderr: (stderr || "").slice(0, 5000),
                exitCode: error ? 1 : 0,
              });
            }
          );
        });

        // 2. Get pod logs for the job
        const logsResult = await new Promise<{
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
              "--kubeconfig", kubeconfigPath,
            ],
            {
              cwd: validatedCwd,
              timeout: 30_000,
              maxBuffer: 2 * 1024 * 1024,
              env: { ...baseExecEnv, KUBECONFIG: kubeconfigPath },
            },
            (error: Error | null, stdout: string, stderr: string) => {
              resolve({
                stdout: (stdout || "").slice(0, 30000),
                stderr: (stderr || "").slice(0, 5000),
                exitCode: error ? 1 : 0,
              });
            }
          );
        });

        // Parse job status
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
          jobStatus = { raw: statusResult.stdout.slice(0, 2000) };
        }

        const result = {
          success: statusResult.exitCode === 0,
          jobName,
          namespace: resolvedNamespace,
          jobStatus,
          logs: logsResult.stdout,
          logsError: logsResult.stderr || undefined,
        };

        // Record operation
        recordClusterOp({
          workspaceId,
          toolName: "collectJobResults",
          jobName,
          namespace: resolvedNamespace,
          status: statusResult.exitCode === 0 ? "success" : "error",
          exitCode: statusResult.exitCode,
          summary: `Collect results for ${jobName}`,
          input: { jobName, namespace: resolvedNamespace, tailLines: resolvedTailLines },
          output: { jobStatus, logsLength: logsResult.stdout.length },
        }).catch(() => {});

        return result;
      },
    }),

    searchArticles: tool({
      description:
        "Search for academic articles from arXiv and Hugging Face Daily Papers. " +
        "Returns matching articles with title, authors, abstract, link, and date. " +
        "Supports keyword search with optional date filtering. " +
        "After displaying results, users can ask for a detailed summary of specific articles and related article recommendations.",
      inputSchema: z
        .object({
          keywords: z
            .array(z.string())
            .default([])
            .describe(
              "Keywords to search for (e.g. ['transformer', 'attention']). " +
                "Required for keyword search; can be omitted when using 'findRelatedTo'."
            ),
          maxResults: z
            .number()
            .min(1)
            .max(30)
            .optional()
            .describe("Maximum results per source (default: 10, max: 30)"),
          dateFrom: z
            .string()
            .optional()
            .describe(
              "Only return articles published after this date (ISO 8601, e.g. '2025-01-01')"
            ),
          dateTo: z
            .string()
            .optional()
            .describe(
              "Only return articles published before this date (ISO 8601, e.g. '2025-12-31')"
            ),
          sources: z
            .array(z.enum(["arxiv", "huggingface"]))
            .optional()
            .describe(
              "Data sources to search (default: both 'arxiv' and 'huggingface')"
            ),
          findRelatedTo: z
            .object({
              id: z.string(),
              title: z.string(),
              source: z.enum(["arxiv", "huggingface"]),
            })
            .optional()
            .describe(
              "If provided, find articles related to this article instead of performing a keyword search"
            ),
        })
        .refine(
          (data) =>
            (Array.isArray(data.keywords) && data.keywords.length > 0) ||
            !!data.findRelatedTo,
          {
            message:
              "Provide at least one keyword or a 'findRelatedTo' article.",
            path: ["keywords"],
          }
        ),
      execute: async ({
        keywords,
        maxResults,
        dateFrom,
        dateTo,
        sources,
        findRelatedTo,
      }) => {
        // Related article lookup mode
        if (findRelatedTo) {
          const related = await findRelatedArticles(
            {
              id: findRelatedTo.id,
              title: findRelatedTo.title,
              authors: [],
              abstract: "",
              url: "",
              publishedDate: "",
              source: findRelatedTo.source,
            },
            3
          );
          return {
            relatedTo: findRelatedTo.title,
            articles: related.map(formatArticle),
            totalCount: related.length,
          };
        }

        // Standard search mode
        const result = await doSearchArticles({
          keywords,
          maxResults,
          dateFrom,
          dateTo,
          sources,
        });

        return {
          articles: result.articles.map(formatArticle),
          totalCount: result.totalCount,
          errors: result.errors,
        };
      },
    }),
  };

  // Filter tools if allowedTools is specified
  if (allowedTools === undefined || allowedTools === null) {
    return allTools;
  }

  if (allowedTools.length === 0) {
    return {};
  }

  // Validate that all requested tools exist
  const allToolNames = new Set(Object.keys(allTools));
  const unknownTools = allowedTools.filter((name) => !allToolNames.has(name));

  if (unknownTools.length > 0) {
    console.warn(
      `[agent-tools] Unknown tools in allowedTools: ${unknownTools.join(", ")}. Known tools: ${Array.from(allToolNames).join(", ")}`
    );
  }

  const filtered: Record<string, (typeof allTools)[keyof typeof allTools]> =
    {};
  for (const name of allowedTools) {
    if (name in allTools) {
      filtered[name] = allTools[name as keyof typeof allTools];
    }
  }
  return filtered;
}
