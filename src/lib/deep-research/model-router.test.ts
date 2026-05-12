import { describe, expect, it } from "vitest";
import { getRouteCandidatesForRole } from "./model-router";
import type { DeepResearchConfig } from "./types";

function createConfig(overrides?: Partial<DeepResearchConfig>): DeepResearchConfig {
  return {
    interfaceOnly: false,
    budget: {
      maxTotalTokens: 100000,
      maxOpusTokens: 50000,
    },
    maxWorkerFanOut: 1,
    maxReviewerRounds: 2,
    maxExecutionLoops: 2,
    maxWorkerConcurrency: 1,
    literature: {
      maxLiteratureRounds: 3,
      maxPapersPerRound: 10,
      maxTotalPapers: 30,
      maxReviewerRequestedExpansionRounds: 1,
      maxSearchRetries: 2,
    },
    execution: {
      defaultLauncherType: "local_shell",
      defaultResources: { gpu: 0, memoryMb: 0, cpu: 1, privateMachine: "no" },
      defaultMounts: [],
      defaultChargedGroup: "",
    },
    resolvedModel: {
      provider: "openai",
      modelId: "gpt-4o-mini",
    },
    ...overrides,
  };
}

describe("model router", () => {
  it("prioritizes role overrides ahead of the resolved session model", () => {
    const routes = getRouteCandidatesForRole(
      "research_asset_reuse_specialist",
      createConfig({
        modelOverrides: {
          research_asset_reuse_specialist: {
            provider: "anthropic",
            modelId: "claude-opus-4-6",
          },
        },
      }),
    );

    expect(routes[0]).toEqual({
      provider: "anthropic",
      modelId: "claude-opus-4-6",
    });
    expect(routes).toContainEqual({
      provider: "openai",
      modelId: "gpt-4o-mini",
    });
  });

  it("deduplicates identical override and resolved routes", () => {
    const routes = getRouteCandidatesForRole(
      "research_asset_reuse_specialist",
      createConfig({
        modelOverrides: {
          research_asset_reuse_specialist: {
            provider: "openai",
            modelId: "gpt-4o-mini",
          },
        },
      }),
    );

    expect(routes.filter((route) => route.provider === "openai" && route.modelId === "gpt-4o-mini")).toHaveLength(1);
  });
});
