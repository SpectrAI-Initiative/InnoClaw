import type { ContextTag, DeepResearchNode, NodeCreationSpec } from "./types";
import { VALID_CONTEXT_TAGS } from "./types";

export function resolveLegacyContextFromNodes(nodes: DeepResearchNode[], fallback: ContextTag): ContextTag {
  const activeNode = [...nodes]
    .filter((node) =>
      node.status !== "superseded" &&
      node.status !== "skipped" &&
      node.status !== "completed" &&
      node.status !== "failed"
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

  return activeNode?.contextTag ?? fallback;
}

export function validateContextTag(contextTag: string | undefined, fallback: ContextTag): ContextTag {
  if (!contextTag) return fallback;

  const normalized = contextTag.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (VALID_CONTEXT_TAGS.includes(normalized as ContextTag)) return normalized as ContextTag;
  if (normalized === "report") return "final_report";
  if (normalized === "plan") return "planning";
  if (normalized === "start") return "intake";
  return "planning";
}

export function resolveContextTagFromSpecs(specs: NodeCreationSpec[], fallback: ContextTag): ContextTag {
  const explicitContextTag = specs.find(
    (spec): spec is NodeCreationSpec & { contextTag: ContextTag } => Boolean(spec.contextTag),
  )?.contextTag;

  return explicitContextTag ? validateContextTag(explicitContextTag, fallback) : fallback;
}
