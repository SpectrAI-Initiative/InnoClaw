// =============================================================
// Deep Research — Requirement & Constraint Tracker
// =============================================================

import { nanoid } from "nanoid";
import type {
  RequirementState,
  Requirement,
  Constraint,
  RequirementDiff,
  Phase,
} from "./types";

/**
 * Create initial RequirementState from the intake artifact content.
 * Extracts requirements and constraints from the research brief.
 */
export function createInitialRequirements(
  intakeArtifact: Record<string, unknown>,
  phase: Phase = "intake"
): RequirementState {
  const requirements: Requirement[] = [];
  const constraints: Constraint[] = [];

  // Extract from research brief
  const objective = (intakeArtifact.objective as string) ?? (intakeArtifact.text as string) ?? "";
  if (objective) {
    requirements.push({
      id: nanoid(),
      text: objective,
      source: "user_query",
      priority: "critical",
      status: "active",
      satisfiedByNodeIds: [],
      addedAtPhase: phase,
    });
  }

  // Extract sub-questions as requirements
  const subQuestions = (intakeArtifact.subQuestions as string[]) ?? (intakeArtifact.sub_questions as string[]) ?? [];
  for (const q of subQuestions) {
    requirements.push({
      id: nanoid(),
      text: q,
      source: "intake_decomposition",
      priority: "high",
      status: "active",
      satisfiedByNodeIds: [],
      addedAtPhase: phase,
    });
  }

  // Extract constraints
  const scopeConstraints = (intakeArtifact.constraints as string[]) ?? [];
  for (const c of scopeConstraints) {
    constraints.push({
      id: nanoid(),
      text: c,
      type: "scope",
      value: c,
      status: "active",
      addedAtPhase: phase,
    });
  }

  // Budget constraints (always present)
  constraints.push({
    id: nanoid(),
    text: "Token budget limit",
    type: "budget",
    value: "system_default",
    status: "active",
    addedAtPhase: phase,
  });

  return {
    requirements,
    constraints,
    version: 1,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: "system",
    originalUserGoal: objective,
    currentApprovedGoal: objective,
    latestUserInstruction: null,
    approvedResearchScope: null,
    approvedExperimentScope: null,
    executionAllowed: false,
    latestMainBrainAcceptedInterpretation: null,
    supersedesVersion: null,
  };
}

/**
 * Update requirements — bumps version, records actor.
 */
export function updateRequirements(
  state: RequirementState,
  changes: {
    addRequirements?: Omit<Requirement, "id">[];
    removeRequirementIds?: string[];
    updateRequirements?: Array<{ id: string; updates: Partial<Requirement> }>;
    addConstraints?: Omit<Constraint, "id">[];
    updateConstraints?: Array<{ id: string; updates: Partial<Constraint> }>;
  },
  actor: string
): RequirementState {
  let requirements = [...state.requirements];
  let constraints = [...state.constraints];

  // Add new requirements
  if (changes.addRequirements) {
    for (const req of changes.addRequirements) {
      requirements.push({ ...req, id: nanoid() });
    }
  }

  // Remove requirements
  if (changes.removeRequirementIds) {
    const removeSet = new Set(changes.removeRequirementIds);
    requirements = requirements.map((r) =>
      removeSet.has(r.id) ? { ...r, status: "dropped" as const } : r
    );
  }

  // Update requirements
  if (changes.updateRequirements) {
    for (const { id, updates } of changes.updateRequirements) {
      requirements = requirements.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      );
    }
  }

  // Add constraints
  if (changes.addConstraints) {
    for (const con of changes.addConstraints) {
      constraints.push({ ...con, id: nanoid() });
    }
  }

  // Update constraints
  if (changes.updateConstraints) {
    for (const { id, updates } of changes.updateConstraints) {
      constraints = constraints.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      );
    }
  }

  return {
    ...state,
    requirements,
    constraints,
    version: state.version + 1,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: actor,
  };
}

/**
 * Compute the diff between two RequirementState versions.
 * Used for stale-plan detection.
 */
export function diffRequirements(
  oldState: RequirementState,
  newState: RequirementState
): RequirementDiff {
  const oldReqIds = new Set(oldState.requirements.map((r) => r.id));
  const newReqIds = new Set(newState.requirements.map((r) => r.id));
  const oldReqMap = new Map(oldState.requirements.map((r) => [r.id, r]));
  const newReqMap = new Map(newState.requirements.map((r) => [r.id, r]));

  const added = newState.requirements.filter((r) => !oldReqIds.has(r.id));
  const removed = oldState.requirements.filter((r) => !newReqIds.has(r.id));

  const modified: RequirementDiff["modified"] = [];
  for (const [id, newReq] of newReqMap) {
    const oldReq = oldReqMap.get(id);
    if (!oldReq) continue;
    if (oldReq.status !== newReq.status) {
      modified.push({ id, field: "status", oldValue: oldReq.status, newValue: newReq.status });
    }
    if (oldReq.text !== newReq.text) {
      modified.push({ id, field: "text", oldValue: oldReq.text, newValue: newReq.text });
    }
    if (oldReq.priority !== newReq.priority) {
      modified.push({ id, field: "priority", oldValue: oldReq.priority, newValue: newReq.priority });
    }
  }

  const constraintsChanged =
    oldState.constraints.length !== newState.constraints.length ||
    JSON.stringify(oldState.constraints) !== JSON.stringify(newState.constraints);

  return { added, removed, modified, constraintsChanged };
}

/**
 * Check if a diff represents meaningful changes that could affect planned nodes.
 */
export function isSignificantDiff(diff: RequirementDiff): boolean {
  return (
    diff.added.length > 0 ||
    diff.removed.length > 0 ||
    diff.modified.some((m) => m.field === "text" || m.field === "status") ||
    diff.constraintsChanged
  );
}
