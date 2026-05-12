import { describe, expect, it } from "vitest";
import {
  canonicalizeArtifactReferenceFields,
  extractArtifactReferenceTokens,
  resolveArtifactReferenceIds,
} from "./artifact-references";
import type { DeepResearchArtifact } from "./types";

function createArtifact(overrides: Partial<DeepResearchArtifact>): DeepResearchArtifact {
  return {
    id: overrides.id ?? "artifact-1",
    sessionId: overrides.sessionId ?? "session-1",
    nodeId: overrides.nodeId ?? "node-1",
    artifactType: overrides.artifactType ?? "evidence_card",
    title: overrides.title ?? "Artifact",
    content: overrides.content ?? {},
    provenance: overrides.provenance ?? null,
    version: overrides.version ?? 1,
    createdAt: overrides.createdAt ?? "2026-04-16T00:00:00.000Z",
  };
}

describe("artifact references", () => {
  const artifacts = [
    createArtifact({
      id: "CabdyeKdSgc6Uxna5SXZx",
      title: "Evidence: 稀疏注意力与反向嵌入",
    }),
    createArtifact({
      id: "hYn9hjPGojOJdWG3S1Y4V",
      artifactType: "structured_summary",
      title: "Summary: 时间序列Transformer综述证据综合与结构化学术内容构建",
    }),
  ];

  it("extracts deduplicated artifact reference tokens from common input fields", () => {
    const tokens = extractArtifactReferenceTokens({
      targetArtifactIds: ["CabdyeKd", "CabdyeKdSgc6Uxna5SXZx"],
      sourceArtifactIds: ["hYn9hjPG"],
    });

    expect(tokens).toEqual(["CabdyeKd", "CabdyeKdSgc6Uxna5SXZx", "hYn9hjPG"]);
  });

  it("resolves short artifact ids to canonical ids", () => {
    const resolved = resolveArtifactReferenceIds(
      {
        targetArtifactIds: ["CabdyeKd", "hYn9hjPG"],
      },
      artifacts,
    );

    expect(resolved).toEqual([
      "CabdyeKdSgc6Uxna5SXZx",
      "hYn9hjPGojOJdWG3S1Y4V",
    ]);
  });

  it("canonicalizes artifact reference fields in node input", () => {
    const normalized = canonicalizeArtifactReferenceFields(
      {
        targetArtifactIds: ["CabdyeKd", "CabdyeKdSgc6Uxna5SXZx"],
        sourceArtifactIds: ["hYn9hjPG"],
      },
      artifacts,
    );

    expect(normalized).toMatchObject({
      targetArtifactIds: ["CabdyeKdSgc6Uxna5SXZx"],
      sourceArtifactIds: ["hYn9hjPGojOJdWG3S1Y4V"],
    });
  });
});
