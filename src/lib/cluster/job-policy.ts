import crypto from "crypto";
import { isValidDnsLabel, isValidImageRef } from "@/lib/utils/validators";

export interface K8sJobToolInput {
  profileId: string;
  jobName?: string;
  generateName?: string;
  namespace?: string;
  image?: string;
  command?: string[];
  args?: string[];
  env?: Array<{ name: string; value: string }>;
  resources?: {
    requests?: Record<string, string>;
    limits?: Record<string, string>;
  };
  ttlSecondsAfterFinished?: number;
  backoffLimit?: number;
}

export const INNOCLAW_MANAGED_BY_LABEL = "app.kubernetes.io/managed-by";
export const INNOCLAW_WORKSPACE_LABEL = "innoclaw.ai/workspace-id";
export const INNOCLAW_JOB_HASH_LABEL = "innoclaw.ai/job-hash";
export const INNOCLAW_JOB_HASH_ANNOTATION = "innoclaw.ai/job-spec-hash";
export const K8S_LABEL_VALUE_MAX_LENGTH = 63;

export function validateK8sJobInput(input: K8sJobToolInput): void {
  if (!input.profileId) {
    throw new Error("profileId is required");
  }
  if (input.jobName && input.generateName) {
    throw new Error("Only one of jobName or generateName may be set");
  }
  if (input.jobName && !isValidDnsLabel(input.jobName)) {
    throw new Error("jobName must be a valid DNS label");
  }
  if (input.generateName && input.generateName.length > 63) {
    throw new Error("generateName must be at most 63 characters");
  }
  if (input.namespace && !isValidDnsLabel(input.namespace)) {
    throw new Error("namespace must be a valid DNS label");
  }
  if (input.image && !isValidImageRef(input.image)) {
    throw new Error("image must be a valid OCI image reference");
  }
}

export function normalizeK8sJobInput(input: K8sJobToolInput): K8sJobToolInput {
  return JSON.parse(JSON.stringify(input));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeK8sJobSpecHash(value: unknown): string {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function toK8sLabelValue(value: string): string {
  return value.slice(0, K8S_LABEL_VALUE_MAX_LENGTH);
}

export function ensureOwnedK8sJob(
  resource: unknown,
  expectedHash?: string,
): void {
  const labels =
    resource &&
    typeof resource === "object" &&
    "metadata" in resource &&
    typeof (resource as { metadata?: unknown }).metadata === "object"
      ? ((resource as { metadata?: { labels?: Record<string, string> } })
          .metadata?.labels ?? {})
      : {};
  const annotations =
    resource &&
    typeof resource === "object" &&
    "metadata" in resource &&
    typeof (resource as { metadata?: unknown }).metadata === "object"
      ? ((resource as { metadata?: { annotations?: Record<string, string> } })
          .metadata?.annotations ?? {})
      : {};

  if (labels[INNOCLAW_MANAGED_BY_LABEL] !== "innoclaw") {
    throw new Error("Kubernetes Job is not owned by InnoClaw");
  }

  const actualHash =
    annotations[INNOCLAW_JOB_HASH_ANNOTATION] ?? labels[INNOCLAW_JOB_HASH_LABEL];
  if (expectedHash && actualHash !== expectedHash) {
    throw new Error("Kubernetes Job hash does not match the requested operation");
  }
}
