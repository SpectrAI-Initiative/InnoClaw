/**
 * Cluster operation tracking — records agent kubectl / submitK8sJob /
 * collectJobResults invocations so the UI can display an operation history
 * and provide dynamic cluster status visualization.
 */
import crypto from "crypto";
import { db } from "@/lib/db";
import { clusterOperations } from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";

export interface ClusterOpInput {
  workspaceId?: string | null;
  toolName: string;
  subcommand?: string;
  jobName?: string;
  namespace?: string;
  status: "success" | "error" | "blocked";
  exitCode?: number;
  summary?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
}

/**
 * Record a cluster operation in the database.
 * Truncates JSON blobs so they stay small enough for display.
 */
export async function recordClusterOp(op: ClusterOpInput) {
  const id = crypto.randomUUID();
  const MAX_JSON = 8000;
  const truncate = (obj: unknown) => {
    const s = JSON.stringify(obj);
    return s.length > MAX_JSON ? s.slice(0, MAX_JSON) : s;
  };

  await db.insert(clusterOperations).values({
    id,
    workspaceId: op.workspaceId ?? null,
    toolName: op.toolName,
    subcommand: op.subcommand ?? null,
    jobName: op.jobName ?? null,
    namespace: op.namespace ?? null,
    status: op.status,
    exitCode: op.exitCode ?? null,
    summary: op.summary ?? null,
    inputJson: op.input ? truncate(op.input) : null,
    outputJson: op.output ? truncate(op.output) : null,
  });

  return id;
}

/**
 * List cluster operations, optionally filtered by workspace.
 */
export async function listClusterOps(opts?: {
  workspaceId?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = Math.min(opts?.limit ?? 50, 200);
  const offset = opts?.offset ?? 0;

  const conditions = opts?.workspaceId
    ? and(eq(clusterOperations.workspaceId, opts.workspaceId))
    : undefined;

  const rows = await db
    .select()
    .from(clusterOperations)
    .where(conditions)
    .orderBy(desc(clusterOperations.createdAt))
    .limit(limit)
    .offset(offset);

  return rows;
}
