import { tool } from "ai";
import { z } from "zod";
import { recordClusterOp as defaultRecordClusterOp } from "@/lib/cluster/operations";
import { createKubectlExecutor } from "@/lib/cluster/kubectl-executor";
import { buildK8sJobManifest, summarizeK8sJobManifest } from "@/lib/cluster/job-manifest";
import {
  computeK8sJobSpecHash,
  ensureOwnedK8sJob,
  normalizeK8sJobInput,
  validateK8sJobInput,
  type K8sJobToolInput,
} from "@/lib/cluster/job-policy";
import {
  collectK8sJobLogs as collectLogsForJob,
  waitForK8sJob as waitForJob,
} from "@/lib/cluster/job-wait";
import { resolveK8sJobProfile } from "@/lib/cluster/job-profiles";
import { logAndIgnore } from "@/lib/utils/log";
import type { ToolContext } from "./types";

const envVarSchema = z
  .object({
    name: z.string().min(1),
    value: z.string(),
  })
  .strict();

const resourceSchema = z
  .object({
    requests: z.record(z.string().min(1), z.string().min(1)).optional(),
    limits: z.record(z.string().min(1), z.string().min(1)).optional(),
  })
  .strict();

const baseJobInputSchema = z.object({
  profileId: z.string().min(1),
  jobName: z.string().min(1).optional(),
  generateName: z.string().min(1).optional(),
  namespace: z.string().min(1).optional(),
  image: z.string().min(1).optional(),
  command: z.array(z.string().min(1)).optional(),
  args: z.array(z.string().min(1)).optional(),
  env: z.array(envVarSchema).optional(),
  resources: resourceSchema.optional(),
  ttlSecondsAfterFinished: z.number().int().nonnegative().optional(),
  backoffLimit: z.number().int().nonnegative().optional(),
});

type BaseJobInput = z.infer<typeof baseJobInputSchema>;
type Executor = ReturnType<typeof createKubectlExecutor>;
type RecordClusterOp = typeof defaultRecordClusterOp;

export function createK8sJobTools(
  ctx: ToolContext,
  deps?: {
    executor?: Executor;
    recordClusterOp?: RecordClusterOp;
  },
) {
  const executor = deps?.executor ?? createKubectlExecutor();
  const recordClusterOp = deps?.recordClusterOp ?? defaultRecordClusterOp;

  function buildPrepared(input: BaseJobInput) {
    validateK8sJobInput(input as K8sJobToolInput);
    const resolved = resolveK8sJobProfile(
      ctx.k8sJobConfig,
      input.profileId,
      input.namespace,
    );
    const normalizedInput = normalizeK8sJobInput(input as K8sJobToolInput);
    const jobSpecHash = computeK8sJobSpecHash({
      scope: {
        context: resolved.cluster.context,
        namespace: resolved.namespace,
      },
      profile: resolved.profile,
      input: normalizedInput,
    });
    const manifest = buildK8sJobManifest({
      workspaceId: ctx.workspaceId,
      jobSpecHash,
      namespace: resolved.namespace,
      profile: resolved.profile,
      input: normalizedInput,
    });
    return { resolved, manifest, jobSpecHash };
  }

  function scopeFor(resolved: ReturnType<typeof resolveK8sJobProfile>) {
    return {
      kubeconfigPath: resolved.cluster.kubeconfigPath,
      context: resolved.cluster.context,
      namespace: resolved.namespace,
      env: {
        ...ctx.baseExecEnv,
        KUBECONFIG: resolved.cluster.kubeconfigPath,
      } as NodeJS.ProcessEnv,
    };
  }

  function recordSafe(op: Parameters<RecordClusterOp>[0]) {
    recordClusterOp(op).catch(logAndIgnore("recordClusterOp"));
  }

  function validateFollowUpJobInput(input: {
    profileId: string;
    namespace?: string;
    jobName: string;
  }) {
    validateK8sJobInput({
      profileId: input.profileId,
      namespace: input.namespace,
      jobName: input.jobName,
    });
  }

  function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }

  return {
    prepareK8sJob: tool({
      description:
        "Prepare and dry-run a generic Kubernetes batch/v1 Job from structured inputs. Returns a review summary and jobSpecHash for confirmation-bound submission.",
      inputSchema: baseJobInputSchema,
      execute: async (input) => {
        try {
          const prepared = buildPrepared(input);
          await executor.runText({
            ...scopeFor(prepared.resolved),
            args: ["apply", "--dry-run=client", "-f", "-"],
            stdin: JSON.stringify(prepared.manifest, null, 2),
          });
          const review = summarizeK8sJobManifest(prepared.manifest);
          const result = {
            success: true,
            profileId: input.profileId,
            jobName: review.name,
            generateName: review.generateName,
            namespace: review.namespace,
            jobSpecHash: prepared.jobSpecHash,
            review,
          };
          recordSafe({
            workspaceId: ctx.workspaceId,
            toolName: "prepareK8sJob",
            jobName: review.name ?? undefined,
            namespace: review.namespace,
            status: "success",
            summary: `Prepared generic K8s Job ${review.name ?? review.generateName ?? "generated"}`,
            input: { profileId: input.profileId, namespace: review.namespace },
            output: { jobSpecHash: prepared.jobSpecHash },
          });
          return result;
        } catch (error) {
          recordSafe({
            workspaceId: ctx.workspaceId,
            toolName: "prepareK8sJob",
            status: "error",
            summary: "Failed to prepare generic K8s Job",
            input: { profileId: input.profileId, namespace: input.namespace },
            output: {
              error: error instanceof Error ? error.message : String(error),
            },
          });
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to prepare K8s job",
          };
        }
      },
    }),

    runK8sJob: tool({
      description:
        "Submit a previously prepared generic Kubernetes batch/v1 Job. Requires confirmSubmit=true and the matching jobSpecHash returned by prepareK8sJob.",
      inputSchema: baseJobInputSchema.extend({
        jobSpecHash: z.string().min(1),
        confirmSubmit: z.boolean().optional(),
      }),
      execute: async (input) => {
        const {
          jobSpecHash: suppliedHash,
          confirmSubmit: _confirmSubmit,
          ...baseInput
        } = input;
        try {
          if (!input.confirmSubmit) {
            recordSafe({
              workspaceId: ctx.workspaceId,
              toolName: "runK8sJob",
              jobName: input.jobName,
              namespace: input.namespace,
              status: "blocked",
              summary: "Blocked generic K8s Job submission without confirmation",
              input: { profileId: input.profileId, namespace: input.namespace },
            });
            return { success: false, error: "confirmSubmit=true is required" };
          }
          const prepared = buildPrepared(baseInput);
          if (prepared.jobSpecHash !== suppliedHash) {
            recordSafe({
              workspaceId: ctx.workspaceId,
              toolName: "runK8sJob",
              jobName: baseInput.jobName,
              namespace: prepared.resolved.namespace,
              status: "blocked",
              summary: "Blocked generic K8s Job submission with mismatched hash",
              input: { profileId: baseInput.profileId, namespace: prepared.resolved.namespace },
              output: { expectedHash: prepared.jobSpecHash, suppliedHash },
            });
            return {
              success: false,
              error: "hash does not match the rebuilt manifest",
            };
          }
          const created = await executor.runJson<{ metadata?: { name?: string } }>({
            ...scopeFor(prepared.resolved),
            args: ["create", "-f", "-", "-o", "json"],
            stdin: JSON.stringify(prepared.manifest, null, 2),
          });
          const jobName = created.data.metadata?.name ?? baseInput.jobName ?? null;
          recordSafe({
            workspaceId: ctx.workspaceId,
            toolName: "runK8sJob",
            jobName: jobName ?? undefined,
            namespace: prepared.resolved.namespace,
            status: "success",
            exitCode: 0,
            summary: `Submitted generic K8s Job ${jobName ?? "generated"}`,
            input: { profileId: baseInput.profileId, namespace: prepared.resolved.namespace },
            output: { jobName, jobSpecHash: suppliedHash },
          });
          return { success: true, jobName, namespace: prepared.resolved.namespace };
        } catch (error) {
          recordSafe({
            workspaceId: ctx.workspaceId,
            toolName: "runK8sJob",
            jobName: baseInput.jobName,
            namespace: baseInput.namespace,
            status: "error",
            summary: "Failed to submit generic K8s Job",
            input: { profileId: baseInput.profileId, namespace: baseInput.namespace },
            output: {
              error: error instanceof Error ? error.message : String(error),
            },
          });
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Failed to submit K8s job",
          };
        }
      },
    }),

    waitForK8sJob: tool({
      description:
        "Poll a generic Kubernetes Job until it completes, fails, or times out.",
      inputSchema: z.object({
        profileId: z.string().min(1),
        namespace: z.string().min(1).optional(),
        jobName: z.string().min(1),
        timeoutSeconds: z.number().int().positive().optional(),
        pollIntervalSeconds: z.number().int().positive().optional(),
      }),
      execute: async (input) => {
        try {
          validateFollowUpJobInput(input);
          const resolved = resolveK8sJobProfile(
            ctx.k8sJobConfig,
            input.profileId,
            input.namespace,
          );
          const result = await waitForJob({
            executor,
            scope: scopeFor(resolved),
            jobName: input.jobName,
            timeoutSeconds: input.timeoutSeconds ?? 600,
            pollIntervalSeconds: input.pollIntervalSeconds ?? 5,
          });
          recordSafe({
            workspaceId: ctx.workspaceId,
            toolName: "waitForK8sJob",
            jobName: input.jobName,
            namespace: resolved.namespace,
            status: result.status === "complete" ? "success" : "error",
            summary: `Waited for generic K8s Job ${input.jobName}: ${result.status}`,
            input: { profileId: input.profileId, namespace: resolved.namespace },
            output: { status: result.status, polls: result.polls },
          });
          return result;
        } catch (error) {
          recordSafe({
            workspaceId: ctx.workspaceId,
            toolName: "waitForK8sJob",
            jobName: input.jobName,
            namespace: input.namespace,
            status: "error",
            summary: "Failed to wait for generic K8s Job",
            input: { profileId: input.profileId, namespace: input.namespace },
            output: { error: errorMessage(error, "Failed to wait for K8s job") },
          });
          return {
            success: false,
            error: errorMessage(error, "Failed to wait for K8s job"),
          };
        }
      },
    }),

    collectK8sJobLogs: tool({
      description:
        "Collect bounded logs from the newest Pod associated with a generic Kubernetes Job.",
      inputSchema: z.object({
        profileId: z.string().min(1),
        namespace: z.string().min(1).optional(),
        jobName: z.string().min(1),
        tailLines: z.number().int().positive().optional(),
      }),
      execute: async (input) => {
        try {
          validateFollowUpJobInput(input);
          const resolved = resolveK8sJobProfile(
            ctx.k8sJobConfig,
            input.profileId,
            input.namespace,
          );
          const result = await collectLogsForJob({
            executor,
            scope: scopeFor(resolved),
            jobName: input.jobName,
            tailLines: Math.min(input.tailLines ?? 200, 2000),
          });
          recordSafe({
            workspaceId: ctx.workspaceId,
            toolName: "collectK8sJobLogs",
            jobName: input.jobName,
            namespace: resolved.namespace,
            status: result.logsError ? "error" : "success",
            summary: `Collected logs for generic K8s Job ${input.jobName}`,
            input: { profileId: input.profileId, namespace: resolved.namespace },
            output: {
              podName: result.podName,
              logsLength: result.logs.length,
              logsError: result.logsError,
            },
          });
          return result;
        } catch (error) {
          recordSafe({
            workspaceId: ctx.workspaceId,
            toolName: "collectK8sJobLogs",
            jobName: input.jobName,
            namespace: input.namespace,
            status: "error",
            summary: "Failed to collect logs for generic K8s Job",
            input: { profileId: input.profileId, namespace: input.namespace },
            output: { error: errorMessage(error, "Failed to collect K8s job logs") },
          });
          return {
            success: false,
            error: errorMessage(error, "Failed to collect K8s job logs"),
          };
        }
      },
    }),

    cleanupK8sJob: tool({
      description:
        "Delete a generic Kubernetes Job only after verifying it is managed by InnoClaw and matches the expected jobSpecHash.",
      inputSchema: z.object({
        profileId: z.string().min(1),
        namespace: z.string().min(1).optional(),
        jobName: z.string().min(1),
        jobSpecHash: z.string().min(1).optional(),
        confirmDelete: z.boolean().optional(),
      }),
      execute: async (input) => {
        if (!input.confirmDelete) {
          recordSafe({
            workspaceId: ctx.workspaceId,
            toolName: "cleanupK8sJob",
            jobName: input.jobName,
            namespace: input.namespace,
            status: "blocked",
            summary: "Blocked generic K8s Job cleanup without confirmation",
            input: { profileId: input.profileId, namespace: input.namespace },
          });
          return { success: false, error: "confirmDelete=true is required" };
        }
        try {
          validateFollowUpJobInput(input);
          const resolved = resolveK8sJobProfile(
            ctx.k8sJobConfig,
            input.profileId,
            input.namespace,
          );
          const job = await executor.runJson<unknown>({
            ...scopeFor(resolved),
            args: ["get", "job", input.jobName, "-o", "json"],
          });
          ensureOwnedK8sJob(job.data, input.jobSpecHash);
          const deleted = await executor.runText({
            ...scopeFor(resolved),
            args: ["delete", "job", input.jobName],
          });
          recordSafe({
            workspaceId: ctx.workspaceId,
            toolName: "cleanupK8sJob",
            jobName: input.jobName,
            namespace: resolved.namespace,
            status: "success",
            summary: `Cleaned up generic K8s Job ${input.jobName}`,
            input: { profileId: input.profileId, namespace: resolved.namespace },
            output: { outputLength: deleted.data.length },
          });
          return { success: true, jobName: input.jobName, output: deleted.data };
        } catch (error) {
          recordSafe({
            workspaceId: ctx.workspaceId,
            toolName: "cleanupK8sJob",
            jobName: input.jobName,
            namespace: input.namespace,
            status: "error",
            summary: "Failed to clean up generic K8s Job",
            input: { profileId: input.profileId, namespace: input.namespace },
            output: { error: errorMessage(error, "Failed to clean up K8s job") },
          });
          return {
            success: false,
            error: errorMessage(error, "Failed to clean up K8s job"),
          };
        }
      },
    }),
  };
}
