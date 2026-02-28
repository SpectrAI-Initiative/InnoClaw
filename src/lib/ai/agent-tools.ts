import { tool } from "ai";
import { z } from "zod";
import { exec } from "child_process";
import path from "path";
import os from "os";
import fsp from "fs/promises";
import {
  validatePath,
  readFile as fsReadFile,
  writeFile as fsWriteFile,
  listDirectory as fsListDirectory,
} from "@/lib/files/filesystem";

const DEFAULT_CONTAINER_IMAGE =
  "registry2.d.pjlab.org.cn/ccr-hw/910c:82rc2ipc";

/** Base environment variables for all exec() calls. */
const baseExecEnv = {
  PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
  HOME: process.env.HOME || "/tmp",
  NODE_ENV: process.env.NODE_ENV || "production",
  LANG: process.env.LANG || "en_US.UTF-8",
  TERM: "dumb",
};

/**
 * Execute a shell command in the workspace directory and return truncated output.
 * Shared helper that eliminates boilerplate across bash, kubectl, and submitK8sJob tools.
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

/**
 * Generate a clean Volcano Job YAML from template parameters.
 * Based on config/d_k8s_job.yaml structure, stripped of runtime fields.
 */
function generateVolcanoJobYaml(params: {
  jobName: string;
  command: string;
  image: string;
  gpuCount: number;
  namespace: string;
}): string {
  const { jobName, command, image, gpuCount, namespace } = params;

  // Escape single quotes in command for YAML single-quoted string safety
  const safeCommand = command.replace(/'/g, "''");

  return `apiVersion: batch.volcano.sh/v1alpha1
kind: Job
metadata:
  name: '${jobName}'
  namespace: '${namespace}'
  labels:
    lepton.sensetime.com/framework-type: 'PyTorch'
    lepton.sensetime.com/submitter: 'tangshixiang'
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
            lepton.sensetime.com/submitter: 'tangshixiang'
            ring-controller.atlas: 'ascend-910b'
        spec:
          volumes:
            - name: '019a90c2-2530-7e58-b47a-a86def77ad95-mnt-ai4s'
              persistentVolumeClaim:
                claimName: 'pvc-mdjl8'
            - name: '019a8170-062b-79f6-a79a-de5b671f3a6f-mnt-tangshixiang'
              persistentVolumeClaim:
                claimName: 'pvc-tzsf9'
            - name: '019a8171-651a-7c65-ab01-0fa4414ebc3b-mnt-ai4s-a2'
              persistentVolumeClaim:
                claimName: 'pvc-r4sjn'
            - name: 'shm-data'
              emptyDir:
                medium: 'Memory'
                sizeLimit: '64Gi'
          containers:
            - name: 'worker'
              image: '${image}'
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
                - name: '019a90c2-2530-7e58-b47a-a86def77ad95-mnt-ai4s'
                  mountPath: '/mnt/ai4s'
                - name: '019a8170-062b-79f6-a79a-de5b671f3a6f-mnt-tangshixiang'
                  mountPath: '/mnt/tangshixiang'
                - name: '019a8171-651a-7c65-ab01-0fa4414ebc3b-mnt-ai4s-a2'
                  mountPath: '/mnt/ai4s-a2'
                - name: 'shm-data'
                  mountPath: '/dev/shm'
              imagePullPolicy: 'IfNotPresent'
          restartPolicy: 'Never'
          nodeSelector:
            accelerator-type: 'module-910c-8'
            host-arch: 'huawei-arm'
          imagePullSecrets:
            - name: 'tangshixiang'
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
  allowedTools?: string[] | null
) {
  const validatedCwd = validatePath(workspaceCwd);

  const kubeconfigPath =
    process.env.KUBECONFIG_PATH ||
    path.join(process.cwd(), "config", "d_k8s");

  const k8sEnv = { KUBECONFIG: kubeconfigPath };

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
        "Execute kubectl or vcctl commands against the configured Kubernetes cluster (Volcano scheduler, Ascend910 NPUs). Use for monitoring pods, jobs, deployments, nodes, logs, and cluster status. Set useVcctl=true to use the vcctl CLI for Volcano job management (job get/run/delete/clone/suspend/resume, pod get/logs/exec). Dangerous operations require confirm_dangerous=true.",
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
            "Kubernetes namespace (一般为用户AD账户名字). If omitted, uses the default namespace or the one specified in the subcommand."
          ),
        useVcctl: z
          .boolean()
          .optional()
          .describe(
            "Set to true to use vcctl instead of kubectl. Use vcctl for Volcano job management: job get/run/delete/clone/suspend/resume, pod get/logs/exec, image load."
          ),
        confirm_dangerous: z
          .boolean()
          .optional()
          .describe(
            "Must be set to true to execute dangerous operations (delete, drain, cordon, scale, suspend, etc.). Default is false."
          ),
      }),
      execute: async ({ subcommand, namespace, useVcctl, confirm_dangerous }) => {
        // Safety: detect dangerous subcommands
        const dangerousPatterns = [
          /^delete\b/,
          /^drain\b/,
          /^cordon\b/,
          /^uncordon\b/,
          /^taint\b/,
          /^edit\b/,
          /^replace\b.*--force/,
          /^patch\b/,
          /^scale\b/,
          /^rollout\s+undo\b/,
          /^job\s+delete\b/,
          /^job\s+suspend\b/,
        ];

        const isDangerous = dangerousPatterns.some((p) =>
          p.test(subcommand.trim())
        );

        if (isDangerous && !confirm_dangerous) {
          return {
            stdout: "",
            stderr: `SAFETY BLOCK: "${subcommand}" is a dangerous operation. Set confirm_dangerous=true to proceed.`,
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
          return {
            stdout: "",
            stderr: `FORBIDDEN: "${subcommand}" is permanently blocked for safety.`,
            exitCode: 1,
            blocked: true,
          };
        }

        // Build the command
        const bin = useVcctl ? "vcctl" : "kubectl";
        let cmd = `${bin} ${subcommand}`;
        if (
          !useVcctl &&
          namespace &&
          !subcommand.includes("-n ") &&
          !subcommand.includes("--namespace") &&
          !subcommand.includes("--all-namespaces")
        ) {
          cmd += ` -n ${namespace}`;
        }

        return execInWorkspace(cmd, validatedCwd, { env: k8sEnv });
      },
    }),

    submitK8sJob: tool({
      description:
        `Submit a Volcano K8s job to the D cluster (Ascend 910B NPUs). Generates a job YAML from the standard template and submits it via kubectl. IMPORTANT: Before using this tool, always confirm with the user: (1) the container image to use (default: ${DEFAULT_CONTAINER_IMAGE}), (2) the GPU count (default: 4), and (3) the exact command to run.`,
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
      }),
      execute: async ({ jobName, command, image, gpuCount, namespace }) => {
        const resolvedImage = image || DEFAULT_CONTAINER_IMAGE;
        const resolvedGpuCount = gpuCount ?? 4;
        const resolvedNamespace = namespace || "default";

        // Validate jobName is DNS-compatible
        if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(jobName) || jobName.length > 63) {
          return {
            success: false,
            error:
              "Invalid jobName: must be lowercase alphanumeric with hyphens, start/end with alphanumeric, max 63 chars.",
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

          const result = await execInWorkspace(
            `kubectl create -f "${tmpFile}"`,
            validatedCwd,
            { env: k8sEnv }
          );

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
