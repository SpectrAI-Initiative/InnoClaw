import type { DeepResearchArtifact } from "./types";

const ARTIFACT_REFERENCE_INPUT_KEYS = [
  "targetArtifactIds",
  "sourceArtifactIds",
  "requiredEvidenceArtifactIds",
  "blueprintArtifactIds",
  "artifactIds",
] as const;

function normalizeReferenceToken(value: string): string {
  return value
    .trim()
    .replace(/^[\[\(\{"'`]+/, "")
    .replace(/[\]\)\}"'`，。；、,:;]+$/, "")
    .trim();
}

function normalizeAlias(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function resolveArtifactReferenceId(
  reference: string,
  artifacts: Pick<DeepResearchArtifact, "id" | "title">[],
): string | null {
  const token = normalizeReferenceToken(reference);
  if (!token) {
    return null;
  }

  const exactIdMatch = artifacts.find((artifact) => artifact.id === token);
  if (exactIdMatch) {
    return exactIdMatch.id;
  }

  const exactTitleMatches = artifacts.filter((artifact) => normalizeAlias(artifact.title) === normalizeAlias(token));
  if (exactTitleMatches.length === 1) {
    return exactTitleMatches[0].id;
  }

  const prefixMatches = artifacts.filter((artifact) => artifact.id.startsWith(token));
  if (prefixMatches.length === 1) {
    return prefixMatches[0].id;
  }

  return null;
}

export function extractArtifactReferenceTokens(
  input: Record<string, unknown> | null | undefined,
): string[] {
  if (!input) {
    return [];
  }

  const collected: string[] = [];
  for (const key of ARTIFACT_REFERENCE_INPUT_KEYS) {
    const value = input[key];
    if (!Array.isArray(value)) {
      continue;
    }

    for (const item of value) {
      if (typeof item !== "string") {
        continue;
      }
      const token = normalizeReferenceToken(item);
      if (token) {
        collected.push(token);
      }
    }
  }

  return [...new Set(collected)];
}

export function resolveArtifactReferenceIds(
  input: Record<string, unknown> | null | undefined,
  artifacts: Pick<DeepResearchArtifact, "id" | "title">[],
): string[] {
  const resolvedIds: string[] = [];
  const seen = new Set<string>();

  for (const token of extractArtifactReferenceTokens(input)) {
    const resolved = resolveArtifactReferenceId(token, artifacts);
    if (!resolved || seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);
    resolvedIds.push(resolved);
  }

  return resolvedIds;
}

export function canonicalizeArtifactReferenceFields(
  input: Record<string, unknown> | null | undefined,
  artifacts: Pick<DeepResearchArtifact, "id" | "title">[],
): Record<string, unknown> | undefined {
  if (!input) {
    return undefined;
  }

  const nextInput: Record<string, unknown> = { ...input };

  for (const key of ARTIFACT_REFERENCE_INPUT_KEYS) {
    const value = input[key];
    if (!Array.isArray(value)) {
      continue;
    }

    const normalizedValues: string[] = [];
    const seen = new Set<string>();

    for (const item of value) {
      if (typeof item !== "string") {
        continue;
      }
      const token = normalizeReferenceToken(item);
      if (!token) {
        continue;
      }
      const resolved = resolveArtifactReferenceId(token, artifacts) ?? token;
      if (seen.has(resolved)) {
        continue;
      }
      seen.add(resolved);
      normalizedValues.push(resolved);
    }

    nextInput[key] = normalizedValues;
  }

  return nextInput;
}
