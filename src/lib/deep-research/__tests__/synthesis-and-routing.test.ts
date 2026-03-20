// =============================================================
// Tests: Synthesis, Evidence Cards, Preprocessing, Skill Routing
// =============================================================

import { describe, it, expect } from "vitest";
import {
  buildEvidenceCardFromToolResults,
  mergeEvidenceCards,
  assessEvidenceHonesty,
  evidenceCardToMarkdown,
} from "../evidence-cards";
import { validateRecipe, createDefaultRecipe, estimatePreprocessingDuration } from "../preprocessing";
import { defaultSkillRegistry } from "../skill-library";
import type { EvidenceCard, ClaimMap } from "../types";

// -------------------------------------------------------------------
// Evidence Card Tests
// -------------------------------------------------------------------

describe("Evidence Cards", () => {
  it("builds a card from tool results", () => {
    const results = [{
      articles: [
        { title: "Paper A", url: "https://arxiv.org/abs/1234", abstract: "This paper shows..." },
        { title: "Paper B", url: "https://arxiv.org/abs/5678", abstract: "We propose..." },
      ],
    }];

    const card = buildEvidenceCardFromToolResults(results, "transformer attention");
    expect(card.query).toBe("transformer attention");
    expect(card.sources).toHaveLength(2);
    expect(card.sources[0].title).toBe("Paper A");
    expect(card.rawExcerpts).toHaveLength(2);
    expect(card.retrievalStatus).toBe("success");
    expect(card.sourcesFound).toBe(2);
  });

  it("handles empty results", () => {
    const card = buildEvidenceCardFromToolResults([], "nothing found");
    expect(card.sourcesFound).toBe(0);
    expect(card.retrievalStatus).toBe("empty");
  });

  it("merges multiple cards into a collection", () => {
    const card1: EvidenceCard = {
      id: "c1", query: "q1",
      sources: [{ title: "P1", url: "u1", retrievalMethod: "search", retrievedAt: "" }],
      rawExcerpts: [{ text: "excerpt", sourceIndex: 0 }],
      retrievalStatus: "success", sourcesFound: 1, sourcesAttempted: 1,
      retrievalNotes: "", createdAt: "",
    };
    const card2: EvidenceCard = {
      id: "c2", query: "q2",
      sources: [], rawExcerpts: [],
      retrievalStatus: "empty", sourcesFound: 0, sourcesAttempted: 1,
      retrievalNotes: "", createdAt: "",
    };

    const collection = mergeEvidenceCards([card1, card2]);
    expect(collection.cards).toHaveLength(2);
    expect(collection.totalSources).toBe(1);
    expect(collection.totalExcerpts).toBe(1);
    expect(collection.retrievalSummary.successful).toBe(1);
    expect(collection.retrievalSummary.empty).toBe(1);
  });

  it("detects honesty issues in cards", () => {
    // Card claims success but has zero sources
    const dishonest: EvidenceCard = {
      id: "c1", query: "q1",
      sources: [], rawExcerpts: [],
      retrievalStatus: "success", sourcesFound: 0, sourcesAttempted: 5,
      retrievalNotes: "", createdAt: "",
    };

    const assessment = assessEvidenceHonesty(dishonest);
    expect(assessment.honest).toBe(false);
    expect(assessment.issues.length).toBeGreaterThan(0);
    expect(assessment.issues[0]).toContain("zero sources");
  });

  it("passes honesty check for legitimate cards", () => {
    const honest: EvidenceCard = {
      id: "c1", query: "q1",
      sources: [{ title: "P1", url: "https://arxiv.org/abs/1234", retrievalMethod: "search", retrievedAt: "" }],
      rawExcerpts: [{ text: "some finding", sourceIndex: 0 }],
      retrievalStatus: "success", sourcesFound: 1, sourcesAttempted: 1,
      retrievalNotes: "", createdAt: "",
    };

    const assessment = assessEvidenceHonesty(honest);
    expect(assessment.honest).toBe(true);
    expect(assessment.issues).toHaveLength(0);
  });

  it("renders card to markdown", () => {
    const card: EvidenceCard = {
      id: "c1", query: "neural scaling laws",
      sources: [{ title: "Scaling Laws for Neural LMs", url: "https://arxiv.org/abs/2001.08361", authors: ["Kaplan et al."], year: 2020, retrievalMethod: "search", retrievedAt: "" }],
      rawExcerpts: [{ text: "We study empirical scaling laws for language model performance.", sourceIndex: 0 }],
      retrievalStatus: "success", sourcesFound: 1, sourcesAttempted: 1,
      retrievalNotes: "Good retrieval", createdAt: "",
    };

    const md = evidenceCardToMarkdown(card);
    expect(md).toContain("neural scaling laws");
    expect(md).toContain("Scaling Laws for Neural LMs");
    expect(md).toContain("2020");
    expect(md).toContain("empirical scaling laws");
  });
});

// -------------------------------------------------------------------
// ClaimMap Schema Tests
// -------------------------------------------------------------------

describe("ClaimMap Schema", () => {
  it("validates a well-formed claim map", () => {
    const claimMap: ClaimMap = {
      claims: [
        {
          id: "c1",
          text: "Transformer attention scales well with data",
          strength: "strong",
          supportingSources: [0, 1],
          contradictingSources: [],
          category: "scaling",
          knowledgeType: "retrieved_evidence",
        },
        {
          id: "c2",
          text: "This might work for protein folding",
          strength: "weak",
          supportingSources: [],
          contradictingSources: [],
          category: "speculation",
          knowledgeType: "speculation",
        },
      ],
      supportMatrix: { c1: [0, 1], c2: [] },
      contradictions: [],
      gaps: [{ topic: "protein folding", description: "No direct evidence", suggestedQueries: ["protein transformer"], priority: "high" }],
      confidenceDistribution: { strong: 1, moderate: 0, weak: 1, unsupported: 0 },
    };

    expect(claimMap.claims).toHaveLength(2);
    expect(claimMap.claims[0].knowledgeType).toBe("retrieved_evidence");
    expect(claimMap.claims[1].knowledgeType).toBe("speculation");
    expect(claimMap.gaps).toHaveLength(1);
  });

  it("distinguishes all four knowledge types", () => {
    const types = ["retrieved_evidence", "background_knowledge", "assumption", "speculation"];
    for (const t of types) {
      expect(types).toContain(t);
    }
  });
});

// -------------------------------------------------------------------
// Preprocessing Tests
// -------------------------------------------------------------------

describe("Preprocessing", () => {
  it("creates a valid default recipe", () => {
    const recipe = createDefaultRecipe("/input", "/output");
    expect(recipe.inputPath).toBe("/input");
    expect(recipe.outputPath).toBe("/output");
    expect(recipe.outputFormat).toBe("jsonl");
    expect(recipe.steps.length).toBeGreaterThan(0);
    expect(recipe.splitConfig).toBeDefined();
  });

  it("validates a correct recipe", () => {
    const recipe = createDefaultRecipe("/input", "/output");
    const result = validateRecipe(recipe);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("catches missing input path", () => {
    const recipe = createDefaultRecipe("", "/output");
    const result = validateRecipe(recipe);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("inputPath"))).toBe(true);
  });

  it("catches invalid split ratios", () => {
    const recipe = createDefaultRecipe("/in", "/out");
    recipe.splitConfig = { trainRatio: 0.5, valRatio: 0.5, testRatio: 0.5, seed: 42 };
    const result = validateRecipe(recipe);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Split ratios"))).toBe(true);
  });

  it("estimates preprocessing duration", () => {
    const recipe = createDefaultRecipe("/in", "/out");
    const estimate = estimatePreprocessingDuration(recipe, 10);
    expect(estimate).toBeTruthy();
    expect(estimate).toContain("min"); // 10GB should be multiple minutes
  });
});

// -------------------------------------------------------------------
// Skill Library / Routing Tests
// -------------------------------------------------------------------

describe("Skill Library", () => {
  it("has retrieval skills", () => {
    const skills = defaultSkillRegistry.getByCategory("retrieval");
    expect(skills.length).toBeGreaterThanOrEqual(4);
    expect(skills.some(s => s.id === "arxiv_search")).toBe(true);
    expect(skills.some(s => s.id === "citation_backtrack")).toBe(true);
  });

  it("has synthesis skills", () => {
    const skills = defaultSkillRegistry.getByCategory("synthesis");
    expect(skills.length).toBeGreaterThanOrEqual(3);
    expect(skills.some(s => s.id === "literature_synthesis")).toBe(true);
  });

  it("has review skills", () => {
    const skills = defaultSkillRegistry.getByCategory("review");
    expect(skills.length).toBeGreaterThanOrEqual(2);
    expect(skills.some(s => s.id === "scientific_review")).toBe(true);
    expect(skills.some(s => s.id === "execution_readiness_review")).toBe(true);
  });

  it("has execution skills", () => {
    const skills = defaultSkillRegistry.getByCategory("execution");
    expect(skills.length).toBeGreaterThanOrEqual(4);
    expect(skills.some(s => s.id === "cluster_planning")).toBe(true);
    expect(skills.some(s => s.id === "launcher_preparation")).toBe(true);
  });

  it("has report skills", () => {
    const skills = defaultSkillRegistry.getByCategory("report");
    expect(skills.length).toBeGreaterThanOrEqual(2);
  });

  it("generates LLM-readable catalog", () => {
    const catalog = defaultSkillRegistry.describeForLLM();
    expect(catalog).toContain("Available Skills Catalog");
    expect(catalog).toContain("Retrieval Skills");
    expect(catalog).toContain("Synthesis Skills");
    expect(catalog).toContain("Review Skills");
    expect(catalog).toContain("Execution Skills");
    expect(catalog).toContain("Report Skills");
  });

  it("retrieves individual skills by ID", () => {
    const skill = defaultSkillRegistry.get("scientific_review");
    expect(skill).toBeDefined();
    expect(skill!.category).toBe("review");
    expect(skill!.nodeType).toBe("scientific_review");
  });

  it("returns undefined for unknown skills", () => {
    const skill = defaultSkillRegistry.get("nonexistent_skill");
    expect(skill).toBeUndefined();
  });

  it("lists all skills", () => {
    const all = defaultSkillRegistry.getAll();
    expect(all.length).toBeGreaterThanOrEqual(15);
    // Every skill should have required fields
    for (const s of all) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.category).toBeTruthy();
      expect(s.nodeType).toBeTruthy();
      expect(s.defaultRole).toBeTruthy();
      expect(s.estimatedTokens).toBeGreaterThan(0);
    }
  });
});
