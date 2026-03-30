// =============================================================
// Deep Research — Dynamic Skill / Task Registry
// =============================================================
// Provides a catalog of available skills the MainBrain can select
// when planning research workflows. Config-gated via skillRouting.

import type { SkillDefinition, SkillCategory, NodeType, ModelRole } from "./types";

// -------------------------------------------------------------------
// Skill Registry
// -------------------------------------------------------------------

export class SkillRegistry {
  private skills = new Map<string, SkillDefinition>();

  register(skill: SkillDefinition): void {
    this.skills.set(skill.id, skill);
  }

  get(id: string): SkillDefinition | undefined {
    return this.skills.get(id);
  }

  getByCategory(category: SkillCategory): SkillDefinition[] {
    return Array.from(this.skills.values()).filter(s => s.category === category);
  }

  getAll(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * Return a formatted catalog string for the MainBrain prompt,
   * so it can select skills when planning.
   */
  describeForLLM(): string {
    const categories: SkillCategory[] = ["retrieval", "synthesis", "review", "execution", "report"];
    const sections: string[] = [];

    for (const category of categories) {
      const skills = this.getByCategory(category);
      if (skills.length === 0) continue;

      const header = `### ${category.charAt(0).toUpperCase() + category.slice(1)} Skills`;
      const entries = skills.map(s =>
        `- **${s.id}** (${s.name}): ${s.description} [nodeType=${s.nodeType}, role=${s.defaultRole}, ~${s.estimatedTokens} tokens]`
      ).join("\n");

      sections.push(`${header}\n${entries}`);
    }

    return `## Available Skills Catalog\n\n${sections.join("\n\n")}`;
  }
}

// -------------------------------------------------------------------
// Default skill registry with pre-registered skills
// -------------------------------------------------------------------

function skill(
  id: string,
  name: string,
  description: string,
  category: SkillCategory,
  nodeType: NodeType,
  defaultRole: ModelRole,
  estimatedTokens: number,
): SkillDefinition {
  return { id, name, description, category, nodeType, defaultRole, estimatedTokens };
}

export const defaultSkillRegistry = new SkillRegistry();

// --- Retrieval Skills ---
defaultSkillRegistry.register(skill(
  "arxiv_search", "arXiv Search",
  "Search arXiv for academic papers matching a specific query or topic",
  "retrieval", "retrieve", "worker", 2000,
));
defaultSkillRegistry.register(skill(
  "hf_papers_search", "HuggingFace Papers Search",
  "Search HuggingFace daily papers for recent ML research and model releases",
  "retrieval", "retrieve", "worker", 2000,
));
defaultSkillRegistry.register(skill(
  "semantic_scholar_search", "Semantic Scholar Search",
  "Search Semantic Scholar for papers with citation graph traversal",
  "retrieval", "retrieve", "worker", 2000,
));
defaultSkillRegistry.register(skill(
  "citation_backtrack", "Citation Backtracking",
  "Follow citation chains backward from a known paper to find foundational work",
  "retrieval", "retrieve", "worker", 3000,
));
defaultSkillRegistry.register(skill(
  "benchmark_retrieval", "Benchmark Retrieval",
  "Find benchmark datasets and leaderboard results for a specific task or method",
  "retrieval", "retrieve", "worker", 2000,
));
defaultSkillRegistry.register(skill(
  "repo_dataset_discovery", "Repository & Dataset Discovery",
  "Find code repositories, datasets, and pre-trained models on GitHub/HuggingFace",
  "retrieval", "retrieve", "worker", 2000,
));

// --- Synthesis Skills ---
defaultSkillRegistry.register(skill(
  "literature_synthesis", "Literature Synthesis",
  "Synthesize evidence cards into a coherent literature review with claim mapping",
  "synthesis", "synthesize_claims", "synthesizer", 5000,
));
defaultSkillRegistry.register(skill(
  "claim_map_build", "Claim Map Builder",
  "Build a structured claim map from evidence: claims, support matrix, contradictions, gaps",
  "synthesis", "synthesize_claims", "synthesizer", 4000,
));
defaultSkillRegistry.register(skill(
  "mechanism_synthesis", "Mechanism Synthesis",
  "Synthesize evidence into a mechanistic explanation of how/why something works",
  "synthesis", "synthesize_claims", "synthesizer", 4000,
));
defaultSkillRegistry.register(skill(
  "contradiction_resolution", "Contradiction Resolution",
  "Identify and attempt to resolve contradictions between evidence sources",
  "synthesis", "synthesize_claims", "synthesizer", 3000,
));
defaultSkillRegistry.register(skill(
  "gap_analysis", "Gap Analysis",
  "Identify evidence gaps and generate targeted queries to fill them",
  "synthesis", "synthesize_claims", "synthesizer", 3000,
));

// --- Review Skills ---
defaultSkillRegistry.register(skill(
  "research_review", "Research Review",
  "Research audit covering evidence quality, methodological soundness, and decision readiness.",
  "review", "review", "results_and_evidence_analyst", 5000,
));
defaultSkillRegistry.register(skill(
  "experimental_design_review", "Experimental Design Review",
  "Review experimental design for methodological soundness, controls, and statistical power",
  "review", "review", "results_and_evidence_analyst", 4000,
));
defaultSkillRegistry.register(skill(
  "execution_readiness_review", "Execution Readiness Review",
  "Assess whether an experiment plan is ready for actual execution (data, code, resources)",
  "review", "review", "results_and_evidence_analyst", 3000,
));

// --- Execution Skills ---
defaultSkillRegistry.register(skill(
  "cluster_planning", "Cluster Planning",
  "Plan GPU/compute resource allocation for an experiment across available clusters",
  "execution", "execute", "worker", 2000,
));
defaultSkillRegistry.register(skill(
  "data_pipeline_planning", "Data Pipeline Planning",
  "Plan data download, preprocessing, and caching pipeline for an experiment",
  "execution", "data_download", "worker", 2000,
));
defaultSkillRegistry.register(skill(
  "launcher_preparation", "Launcher Preparation",
  "Prepare rjob/rlaunch/slurm submission manifests for experiment execution",
  "execution", "resource_request", "worker", 1500,
));
defaultSkillRegistry.register(skill(
  "run_monitoring", "Run Monitoring",
  "Monitor a running experiment job: status, metrics, logs, and failures",
  "execution", "monitor", "worker", 1000,
));
defaultSkillRegistry.register(skill(
  "artifact_collection", "Artifact Collection",
  "Collect outputs, metrics, checkpoints, and logs from a completed experiment run",
  "execution", "result_collect", "worker", 1500,
));

// --- Report Skills ---
defaultSkillRegistry.register(skill(
  "final_report", "Final Report",
  "Generate comprehensive final research report combining literature, review, and experiment results",
  "report", "final_report", "main_brain", 8000,
));
defaultSkillRegistry.register(skill(
  "experiment_spec_writing", "Experiment Spec Writing",
  "Write a detailed experiment specification document from a validation plan",
  "report", "final_report", "main_brain", 5000,
));
defaultSkillRegistry.register(skill(
  "executive_summary", "Executive Summary",
  "Generate a concise executive summary of research findings for stakeholders",
  "report", "final_report", "main_brain", 3000,
));

// --- Execution Loop Skills (new) ---
defaultSkillRegistry.register(skill(
  "execution_planning", "Execution Planning",
  "Convert an approved validation plan into executable experiment specs with resource estimates",
  "execution", "execute", "main_brain", 3000,
));
defaultSkillRegistry.register(skill(
  "gpu_resource_planning", "GPU Resource Planning",
  "Reason about GPU count, type, memory, walltime, and billing for experiment execution",
  "execution", "resource_request", "worker", 2000,
));
defaultSkillRegistry.register(skill(
  "remote_execution_preparation", "Remote Execution Preparation",
  "Prepare SSH-based remote execution: stage files, setup environment, verify launcher availability",
  "execution", "execute", "worker", 2000,
));
defaultSkillRegistry.register(skill(
  "worker_fanout_design", "Worker Fanout Design",
  "Decompose a parent experiment into staged workers for seed sweeps, ablations, hyperparameter search",
  "execution", "execute", "main_brain", 3000,
));
defaultSkillRegistry.register(skill(
  "result_validation", "Result Validation",
  "Validate experiment outputs against acceptance criteria: metrics, artifacts, worker success rates, variance",
  "execution", "result_collect", "worker", 2000,
));
defaultSkillRegistry.register(skill(
  "experiment_failure_analysis", "Experiment Failure Analysis",
  "Diagnose failed/inconclusive experiment runs: root cause analysis, resource issues, data problems, hypothesis testing",
  "execution", "result_collect", "main_brain", 4000,
));
defaultSkillRegistry.register(skill(
  "replanning_after_execution", "Replanning After Execution",
  "Revise experiment plan after execution feedback: adjust resources, change design, narrow scope, or pivot hypothesis",
  "execution", "execute", "main_brain", 4000,
));
defaultSkillRegistry.register(skill(
  "result_aggregation", "Result Aggregation",
  "Aggregate metrics and artifacts from multiple worker runs into unified experiment results",
  "execution", "result_collect", "worker", 1500,
));
defaultSkillRegistry.register(skill(
  "execution_readiness_assessment", "Execution Readiness Assessment",
  "Comprehensive readiness check before execution: data availability, resource allocation, environment setup, launcher config",
  "execution", "resource_request", "worker", 2000,
));
