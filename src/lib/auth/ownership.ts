import { and, eq, isNull, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deepResearchSessions, experimentRuns, hfDatasets, notes, scheduledTasks, skills, workspaces } from "@/lib/db/schema";
import { canonicalizePath, isPathWithinRoot } from "@/lib/files/canonical-path";
import { forbiddenResponse, requireAuth, type AuthContext } from "./server";
import { isAuthDisabled } from "./mode";
import { resolveProvisioningPath } from "./workspace-roots";

export function getOwnerUserIdForWrite(auth: AuthContext): string | null {
  return isAuthDisabled() ? null : auth.user.id;
}

export function canAccessOwner(auth: AuthContext, ownerUserId: string | null): boolean {
  if (isAuthDisabled() || auth.user.role === "admin") {
    return true;
  }

  return ownerUserId === auth.user.id;
}

export function ownedWorkspaceFilter(auth: AuthContext) {
  if (isAuthDisabled() || auth.user.role === "admin") {
    return undefined;
  }

  return eq(workspaces.ownerUserId, auth.user.id);
}

export function ownedDatasetFilter(auth: AuthContext) {
  if (isAuthDisabled() || auth.user.role === "admin") {
    return undefined;
  }

  return eq(hfDatasets.ownerUserId, auth.user.id);
}

export function ownedScheduledTaskFilter(auth: AuthContext) {
  if (isAuthDisabled() || auth.user.role === "admin") {
    return undefined;
  }

  return eq(scheduledTasks.ownerUserId, auth.user.id);
}

export function ownedSkillFilter(auth: AuthContext) {
  if (isAuthDisabled() || auth.user.role === "admin") {
    return undefined;
  }

  return or(eq(skills.ownerUserId, auth.user.id), isNull(skills.ownerUserId));
}

export async function requireWorkspaceAccess(
  request: NextRequest,
  workspaceId: string,
): Promise<{ auth: AuthContext; workspace: typeof workspaces.$inferSelect } | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), ownedWorkspaceFilter(auth)))
    .limit(1);

  if (!workspace) {
    return forbiddenResponse("Workspace access denied");
  }

  return { auth, workspace };
}

export async function requireDatasetAccess(
  request: NextRequest,
  datasetId: string,
): Promise<{ auth: AuthContext; dataset: typeof hfDatasets.$inferSelect } | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const [dataset] = await db
    .select()
    .from(hfDatasets)
    .where(and(eq(hfDatasets.id, datasetId), ownedDatasetFilter(auth)))
    .limit(1);

  if (!dataset) {
    return forbiddenResponse("Dataset access denied");
  }

  return { auth, dataset };
}

export async function requireNoteAccess(
  request: NextRequest,
  noteId: string,
): Promise<{ auth: AuthContext; note: typeof notes.$inferSelect } | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const [row] = await db
    .select({ note: notes })
    .from(notes)
    .innerJoin(workspaces, eq(notes.workspaceId, workspaces.id))
    .where(and(eq(notes.id, noteId), ownedWorkspaceFilter(auth)))
    .limit(1);

  if (!row) {
    return forbiddenResponse("Note access denied");
  }

  return { auth, note: row.note };
}

export async function requireSkillAccess(
  request: NextRequest,
  skillId: string,
): Promise<{ auth: AuthContext; skill: typeof skills.$inferSelect } | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const [skill] = await db
    .select()
    .from(skills)
    .where(and(eq(skills.id, skillId), ownedSkillFilter(auth)))
    .limit(1);

  if (!skill) {
    return forbiddenResponse("Skill access denied");
  }

  return { auth, skill };
}

export async function requireDeepResearchSessionAccess(
  request: NextRequest,
  sessionId: string,
): Promise<{ auth: AuthContext; session: typeof deepResearchSessions.$inferSelect } | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const [session] = await db
    .select({ session: deepResearchSessions })
    .from(deepResearchSessions)
    .innerJoin(workspaces, eq(deepResearchSessions.workspaceId, workspaces.id))
    .where(and(eq(deepResearchSessions.id, sessionId), ownedWorkspaceFilter(auth)))
    .limit(1);

  if (!session) {
    return forbiddenResponse("Session access denied");
  }

  return { auth, session: session.session };
}

export async function requireExperimentRunAccess(
  request: NextRequest,
  runId: string,
): Promise<{
  auth: AuthContext;
  run: typeof experimentRuns.$inferSelect;
} | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const [row] = await db
    .select({ run: experimentRuns })
    .from(experimentRuns)
    .innerJoin(workspaces, eq(experimentRuns.workspaceId, workspaces.id))
    .where(and(eq(experimentRuns.id, runId), ownedWorkspaceFilter(auth)))
    .limit(1);

  if (!row) {
    return forbiddenResponse("Experiment run access denied");
  }

  return { auth, run: row.run };
}

export async function requirePathAccess(
  request: NextRequest,
  targetPath: string,
): Promise<{ auth: AuthContext; canonicalPaths: string[] } | NextResponse> {
  return requireWorkspacePathsAccess(request, [targetPath]);
}

export async function requireScheduledTaskAccess(
  request: NextRequest,
  taskId: string,
): Promise<{ auth: AuthContext; task: typeof scheduledTasks.$inferSelect } | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const [task] = await db
    .select()
    .from(scheduledTasks)
    .where(and(eq(scheduledTasks.id, taskId), ownedScheduledTaskFilter(auth)))
    .limit(1);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return { auth, task };
}

export async function requireWorkspacePathsAccess(
  request: NextRequest,
  targetPaths: string[],
): Promise<{ auth: AuthContext; canonicalPaths: string[] } | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  let canonicalPaths: string[];
  try {
    canonicalPaths = targetPaths.map(canonicalizePath);
  } catch {
    return forbiddenResponse("Path access denied");
  }

  const rows = await db
    .select({ folderPath: workspaces.folderPath })
    .from(workspaces)
    .where(ownedWorkspaceFilter(auth));

  const allowed = canonicalPaths.every((targetPath) =>
    rows.some((row) => {
      try {
        return isPathWithinRoot(targetPath, canonicalizePath(row.folderPath));
      } catch {
        return false;
      }
    }),
  );

  if (!allowed) {
    return forbiddenResponse("Path access denied");
  }

  return { auth, canonicalPaths };
}

export async function requireWorkspaceProvisioningPathsAccess(
  request: NextRequest,
  targetPaths: string[],
): Promise<{ auth: AuthContext; canonicalPaths: string[] } | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    return {
      auth,
      canonicalPaths: targetPaths.map((target) =>
        resolveProvisioningPath(auth, target),
      ),
    };
  } catch {
    return forbiddenResponse("Path access denied");
  }
}
