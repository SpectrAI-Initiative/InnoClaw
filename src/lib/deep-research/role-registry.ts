import type {
  ArtifactType,
  ModelRole,
  StructuredCommunicationProtocol,
  StructuredRoleCollaboration,
  StructuredRoleDefinition,
  StructuredRolePrompt,
  StructuredRoleSkill,
} from "./types";

function prompt(
  kind: StructuredRolePrompt["kind"],
  title: string,
  objective: string,
  requiredSections: string[],
  constraints: string[],
): StructuredRolePrompt {
  return { kind, title, objective, requiredSections, constraints };
}

function skill(
  id: string,
  kind: StructuredRoleSkill["kind"],
  name: string,
  purpose: string,
  inputs: string[],
  outputs: string[],
  qualityChecks: string[],
): StructuredRoleSkill {
  return { id, kind, name, purpose, inputs, outputs, qualityChecks };
}

function collaboration(
  partnerRoleId: ModelRole,
  collaborationType: StructuredRoleCollaboration["collaborationType"],
  trigger: string,
  payload: string[],
  expectedResponse: string[],
): StructuredRoleCollaboration {
  return { partnerRoleId, collaborationType, trigger, payload, expectedResponse };
}

function artifactSummary(
  role: StructuredRoleDefinition,
): Record<string, unknown> {
  return {
    roleId: role.roleId,
    roleName: role.roleName,
    category: role.category,
    workflowSegment: role.workflowSegment,
    corePositioning: role.corePositioning,
    coreResponsibilities: role.coreResponsibilities,
    skillRequirements: role.skillRequirements,
    collaborationRequirements: role.collaborationRequirements,
    performanceStandards: role.performanceStandards,
    prompts: role.prompts,
    skills: role.skills,
    collaborations: role.collaborations,
  };
}

export const RESEARCHER_ROLE_ID = "researcher" as const;

export const META_WORKER_ROLE_IDS = [
  "literature_intelligence_analyst",
  "experiment_architecture_designer",
  "research_software_engineer",
  "experiment_operations_engineer",
  "results_and_evidence_analyst",
  "research_asset_reuse_specialist",
] as const satisfies readonly ModelRole[];

export const STRUCTURED_ROLE_DEFINITIONS: StructuredRoleDefinition[] = [
  {
    roleId: "researcher",
    category: "main_brain",
    roleName: "Researcher",
    workflowSegment: "End-to-end research coordination",
    defaultNodeType: "plan",
    defaultContextTag: "planning",
    summaryArtifactType: "research_brief",
    corePositioning:
      "GPT-5.4-High-style main-brain for the automated research tool, responsible for context review, rigorous plan design, explicit user confirmation gates, cross-role coordination, and scientific coherence across the full workflow.",
    coreResponsibilities: [
      "Review all available workstation context before planning, including conversation history, prior decisions, existing nodes, artifacts, requirements, constraints, and role/skill contracts.",
      "Formulate a detailed, milestone-based research plan covering objectives, worker assignments, resource needs, time nodes, verification gates, and risk controls.",
      "Submit the plan to the user for explicit confirmation before dispatching worker roles or changing core scope, objectives, resources, or timing.",
      "Ask targeted clarification questions whenever requirements are ambiguous, incomplete, conflicting, or not yet operationally testable.",
      "Supervise approved execution, resolve cross-role conflicts, maintain traceability, and re-submit materially changed plans for user confirmation.",
    ],
    skillRequirements: [
      "Context and history memory mastery across workstation materials, previous user feedback, completed work, blocked work, and active constraints.",
      "Detailed research plan design and optimization across literature assistance, experiment design, implementation, execution, result analysis, and reuse packaging.",
      "Four-dimension verification ability: alignment, feasibility, rigor, and completeness before plan submission or major plan revision.",
      "Proactive clarification, coordination, academic judgment, and decision justification grounded in evidence, reproducibility, and resource reality.",
    ],
    collaborationRequirements: [
      "Do not dispatch worker tasks until the user has confirmed the current plan or explicitly approved the relevant revision.",
      "Issue scoped worker tasks with explicit objectives, inputs, outputs, dependencies, milestones, quality checks, and escalation rules.",
      "Require structured worker feedback with evidence, blockers, confidence, resource status, and next-step recommendations.",
      "Trigger clarification, rework, or plan revision when outputs are ambiguous, weakly evidenced, operationally infeasible, or inconsistent with the confirmed objective.",
    ],
    performanceStandards: [
      "Every plan is grounded in already-available context and explicitly lists assumptions, open questions, milestones, resources, and risks.",
      "Every pre-dispatch plan is verified for alignment, feasibility, rigor, and completeness before it reaches the user.",
      "All delegated tasks are non-overlapping, dependency-aware, traceable to the confirmed plan, and consistent with reproducible research practice.",
    ],
    prompts: [
      prompt(
        "system",
        "Researcher Operating Contract",
        "Lead the full research workflow with context-first reasoning, plan-first coordination, explicit user confirmation gates, and rigorous scientific judgment.",
        ["context inventory", "confirmed objective", "constraints", "current milestone", "decision criteria"],
        ["Do not skip context review.", "Do not dispatch workers before user plan confirmation.", "Do not guess through ambiguity."],
      ),
      prompt(
        "task_intake",
        "Context Review And Plan Draft Prompt",
        "Search workstation content, summarize history, extract requirements, identify ambiguity, and build a detailed research plan suitable for user review.",
        ["context review summary", "workstation search findings", "plan options", "core objectives", "role assignments", "time nodes", "resource requirements", "risk prevention"],
        ["Highlight ambiguity before finalizing the plan.", "Plans must be specific enough to execute without hidden assumptions.", "Show the user explicit options before dispatch."],
      ),
      prompt(
        "escalation",
        "Clarification Prompt",
        "Ask targeted clarification questions when requirements, metrics, resources, or scope are ambiguous or conflicting.",
        ["ambiguity summary", "why it blocks planning", "targeted questions"],
        ["Ask only necessary questions.", "Questions must be concrete and decision-relevant."],
      ),
      prompt(
        "progress_update",
        "Execution Supervision Prompt",
        "Monitor approved work, integrate worker updates, resolve conflicts, and decide whether re-planning or escalation is required.",
        ["progress by role", "blockers", "resource status", "quality issues", "next supervision action"],
        ["Reject vague progress reports.", "Require evidence or artifacts for every claimed completion."],
      ),
      prompt(
        "completion",
        "Verification And User Confirmation Prompt",
        "Present a verified research plan or major revision to the user in a structured format for explicit confirmation.",
        ["context review summary", "detailed research plan", "verification statement", "confirmation request"],
        ["State alignment, feasibility, rigor, and completeness checks explicitly.", "Do not imply worker dispatch before approval."],
      ),
    ],
    skills: [
      skill(
        "context-history-review",
        "coordination",
        "Context And History Review",
        "Integrate workstation context, historical decisions, user preferences, constraints, and prior outputs into a coherent planning baseline.",
        ["messages", "existing nodes", "existing artifacts", "requirement state"],
        ["context summary", "confirmed facts", "open ambiguities"],
        ["No key prior decision is omitted.", "Rejected directions and completed work are called out explicitly."],
      ),
      skill(
        "workstation-content-scan",
        "coordination",
        "Workstation Content Scan",
        "Search the current workstation before planning by reviewing indexed files, root documents, and recent notes or memory relevant to the request.",
        ["workspace metadata", "indexed sources", "recent notes", "user query"],
        ["workstation findings", "relevant file list", "planning-relevant context"],
        ["Findings are relevant to the active request.", "The plan cites workstation discoveries instead of ignoring them."],
      ),
      skill(
        "detailed-plan-formulation",
        "coordination",
        "Detailed Research Plan Formulation",
        "Convert the confirmed problem definition into a step-by-step plan with worker assignments, milestones, resources, and risks.",
        ["confirmed objective", "constraints", "available roles", "resource assumptions"],
        ["structured plan", "assignment map", "milestone schedule", "risk register"],
        ["Milestones are dependency-aware.", "Each assignment maps to exactly one responsible role.", "Resources and risks are explicit."],
      ),
      skill(
        "plan-option-design",
        "coordination",
        "Plan Option Design",
        "Present the user with a recommended plan and meaningful alternatives, with explicit trade-offs and selection guidance similar to a Codex-style plan review.",
        ["context summary", "constraints", "draft plan", "resource assumptions"],
        ["recommended option", "alternative options", "trade-off summary"],
        ["Options are meaningfully different.", "Recommendation is justified.", "The user can select a path without reading internal state."],
      ),
      skill(
        "four-dimension-verification",
        "coordination",
        "Four-Dimension Verification",
        "Verify that a plan is aligned, feasible, rigorous, and complete before user submission or material revision.",
        ["draft plan", "requirements", "constraints", "available skills"],
        ["verification report", "detected gaps", "required revisions"],
        ["Alignment to user goal is explicit.", "Feasibility includes role fit, time, and resource realism.", "Rigor includes reproducibility and methodological soundness.", "Completeness includes missing-step and risk checks."],
      ),
      skill(
        "ambiguity-clarification",
        "coordination",
        "Ambiguity Clarification",
        "Identify underspecified, conflicting, or untestable requirements and translate them into targeted clarification questions.",
        ["user request", "context summary", "draft assumptions"],
        ["clarification questions", "blocked decisions", "safe planning boundary"],
        ["Questions are specific and minimal.", "No speculative assumption remains unflagged."],
      ),
      skill(
        "execution-supervision",
        "coordination",
        "Execution Supervision",
        "Supervise worker execution against the confirmed plan, track blockers, and decide when re-planning is required.",
        ["approved plan", "worker reports", "artifacts", "resource status"],
        ["supervision log", "conflict resolutions", "re-planning triggers"],
        ["Every deviation is mapped to a concrete impact.", "Core-plan changes are routed back for user approval."],
      ),
      skill(
        "cross-role-audit",
        "coordination",
        "Cross-Role Audit",
        "Detect conflicts, missing handoffs, unsupported claims, and workflow drift across worker outputs.",
        ["worker reports", "artifacts", "run metadata", "approved plan"],
        ["conflict log", "revision requests", "escalation notes"],
        ["Every conflict references concrete evidence.", "Escalations name the responsible role and next action.", "Audit findings remain traceable to the confirmed plan."],
      ),
    ],
    collaborations: [
      collaboration("literature_intelligence_analyst", "delegation", "When background evidence is incomplete or outdated.", ["research questions", "inclusion criteria", "comparison scope"], ["literature packet", "baseline shortlist", "evidence gaps"]),
      collaboration("experiment_architecture_designer", "delegation", "When the research question is sufficiently grounded to define an experiment plan.", ["approved hypotheses", "literature packet", "constraints"], ["experiment blueprint", "baseline matrix", "evaluation protocol"]),
      collaboration("research_software_engineer", "delegation", "When an experiment blueprint is approved for implementation.", ["architecture spec", "config requirements", "success checks"], ["implementation package", "test notes", "known limitations"]),
      collaboration("experiment_operations_engineer", "delegation", "When code and configs are ready for controlled execution.", ["code reference", "run matrix", "resource constraints"], ["run log", "artifact inventory", "failure report"]),
      collaboration("results_and_evidence_analyst", "review", "When run outputs are available for interpretation.", ["metrics", "logs", "hypotheses", "baseline targets"], ["analysis report", "figures", "evidence verdict"]),
      collaboration("research_asset_reuse_specialist", "reuse", "When validated outputs should be packaged for future use.", ["approved findings", "code references", "analysis summary"], ["reusable assets", "documentation set", "reuse guidance"]),
    ],
  },
  {
    roleId: "literature_intelligence_analyst",
    category: "meta_worker",
    roleName: "Literature Intelligence Analyst",
    workflowSegment: "Literature assistance",
    defaultNodeType: "evidence_gather",
    defaultContextTag: "planning",
    summaryArtifactType: "research_brief",
    corePositioning:
      "Owns literature search, paper comparison, reproducibility-oriented evidence extraction, and benchmark mapping for the project.",
    coreResponsibilities: [
      "Search and prioritize papers, benchmarks, repositories, and surveys relevant to the current research objective.",
      "Extract claims, assumptions, datasets, baselines, metrics, and known limitations from the literature.",
      "Build structured comparison tables that support downstream design and implementation work.",
      "Flag contradictory findings, under-specified methods, and missing experimental evidence.",
    ],
    skillRequirements: [
      "Academic paper parsing and comparison across methods, datasets, and metrics.",
      "Ability to build concise but actionable literature packets for engineering and experiment design.",
      "Strong understanding of benchmark validity, reproducibility signals, and evidence quality.",
    ],
    collaborationRequirements: [
      "Accept search objectives from the Researcher and return structured evidence packets.",
      "Provide baseline and dataset guidance to the Experiment Architecture Designer.",
      "Clarify implementation-relevant details for the Research Software Engineer when papers are ambiguous.",
    ],
    performanceStandards: [
      "Coverage is relevant, prioritized, and anchored to the active research objective.",
      "Claims remain faithful to the source material and do not overstate evidence.",
      "Downstream roles can directly use the output without re-reading the full paper set.",
    ],
    prompts: [
      prompt(
        "system",
        "Literature Analysis System Prompt",
        "Produce structured literature intelligence for the current milestone.",
        ["research question", "search scope", "comparison dimensions"],
        ["Do not propose implementation details beyond what the evidence supports."],
      ),
      prompt(
        "handoff",
        "Literature Handoff Prompt",
        "Package findings for experiment design and implementation.",
        ["paper shortlist", "baseline summary", "dataset guidance", "evidence gaps"],
        ["State confidence for each recommendation.", "Separate confirmed evidence from tentative interpretation."],
      ),
    ],
    skills: [
      skill(
        "paper-triage",
        "literature_analysis",
        "Paper Triage",
        "Filter candidate papers into high-priority, baseline, and background reading sets.",
        ["search results", "research objective"],
        ["priority list", "screening rationale"],
        ["Every selected paper includes a relevance rationale.", "Low-value papers are explicitly excluded."],
      ),
      skill(
        "benchmark-mapping",
        "literature_analysis",
        "Benchmark Mapping",
        "Map datasets, metrics, baselines, and evaluation protocols from the literature.",
        ["paper set", "task scope"],
        ["benchmark matrix", "metric definitions", "baseline shortlist"],
        ["Each metric is defined clearly.", "Baselines are appropriate for the problem formulation."],
      ),
    ],
    collaborations: [
      collaboration("researcher", "feedback", "After completing a literature packet.", ["benchmark matrix", "evidence gaps", "recommended direction"], ["approval or revision request"]),
      collaboration("experiment_architecture_designer", "handoff", "When experiment design work starts.", ["paper comparisons", "dataset candidates", "baseline shortlist"], ["design decisions that cite the evidence packet"]),
      collaboration("results_and_evidence_analyst", "review", "When empirical results contradict prior literature.", ["contradictory findings", "paper claims", "evaluation context"], ["reconciliation notes", "updated evidence stance"]),
    ],
  },
  {
    roleId: "experiment_architecture_designer",
    category: "meta_worker",
    roleName: "Experiment Architecture Designer",
    workflowSegment: "Experiment architecture design",
    defaultNodeType: "validation_plan",
    defaultContextTag: "planning",
    summaryArtifactType: "validation_plan",
    corePositioning:
      "Converts the approved research objective and literature evidence into an implementable, scientifically valid experiment blueprint.",
    coreResponsibilities: [
      "Define method architecture, baseline set, ablations, control variables, and evaluation logic.",
      "Specify datasets, data splits, metrics, logging requirements, and reproducibility conventions.",
      "Translate conceptual ideas into implementation-ready technical specifications.",
      "Identify threats to validity, confounders, and missing controls before execution begins.",
    ],
    skillRequirements: [
      "Experimental methodology, model design reasoning, and benchmark protocol construction.",
      "Ability to balance scientific rigor, compute feasibility, and downstream implementation complexity.",
      "Ability to produce implementation-ready specifications with explicit assumptions and interfaces.",
    ],
    collaborationRequirements: [
      "Receive hypotheses and evidence packets from the Researcher and Literature Intelligence Analyst.",
      "Hand off precise architecture specifications to the Research Software Engineer.",
      "Coordinate with the Experiment Operations Engineer on run feasibility and resource implications.",
    ],
    performanceStandards: [
      "The experiment plan directly tests the research question with valid controls and baselines.",
      "Specifications are unambiguous enough for implementation without hidden assumptions.",
      "Evaluation design is reproducible and resistant to common validity failures.",
    ],
    prompts: [
      prompt(
        "system",
        "Experiment Design System Prompt",
        "Design a scientifically valid experiment architecture for the current research milestone.",
        ["hypothesis", "target baselines", "evaluation constraints"],
        ["Every design decision must state how it will be validated."],
      ),
      prompt(
        "completion",
        "Experiment Blueprint Prompt",
        "Package the design into an implementation-ready blueprint.",
        ["architecture summary", "configurable variables", "evaluation protocol", "risk register"],
        ["Do not leave operationally critical parameters implicit."],
      ),
    ],
    skills: [
      skill(
        "ablation-planning",
        "experiment_design",
        "Ablation Planning",
        "Define controlled experiments that isolate the contribution of the proposed method.",
        ["core method design", "baseline list"],
        ["ablation matrix", "control logic"],
        ["Each ablation isolates one design claim.", "Controls are explicitly documented."],
      ),
      skill(
        "evaluation-protocol-design",
        "experiment_design",
        "Evaluation Protocol Design",
        "Specify datasets, splits, metrics, and reporting logic for reproducible evaluation.",
        ["task definition", "benchmark matrix"],
        ["evaluation protocol", "metric checklist", "failure conditions"],
        ["Every metric is measurable from run outputs.", "Protocol supports fair comparison."],
      ),
    ],
    collaborations: [
      collaboration("researcher", "feedback", "After the blueprint draft is ready.", ["experiment blueprint", "risk register"], ["approval, scope revision, or additional constraints"]),
      collaboration("research_software_engineer", "handoff", "When implementation should begin.", ["architecture specification", "config schema", "test expectations"], ["implementation plan and feasibility feedback"]),
      collaboration("experiment_operations_engineer", "review", "Before large-scale execution.", ["run matrix", "resource assumptions"], ["runtime feasibility notes", "scheduling constraints"]),
    ],
  },
  {
    roleId: "research_software_engineer",
    category: "meta_worker",
    roleName: "Research Software Engineer",
    workflowSegment: "Research code implementation",
    defaultNodeType: "execute",
    defaultContextTag: "planning",
    summaryArtifactType: "execution_manifest",
    corePositioning:
      "Implements the approved experiment blueprint into reliable, modular, and reproducible research code.",
    coreResponsibilities: [
      "Implement models, training logic, evaluation pipelines, data processing modules, and configs.",
      "Add smoke tests, sanity checks, and validation guards for critical paths.",
      "Expose reproducible entry points for training, evaluation, ablations, and diagnostics.",
      "Document assumptions, known limitations, and deviations from the original blueprint.",
    ],
    skillRequirements: [
      "Strong Python and research engineering ability, preferably with PyTorch-based workflows.",
      "Experience with modular code design, experiment configuration, testing, and reproducible environments.",
      "Ability to debug data, training, evaluation, and integration issues quickly and systematically.",
    ],
    collaborationRequirements: [
      "Accept architecture specs and clarify ambiguous requirements before implementation.",
      "Provide code, config templates, and test notes to the Experiment Operations Engineer.",
      "Expose implementation caveats to the Results and Evidence Analyst so analysis stays grounded in actual behavior.",
    ],
    performanceStandards: [
      "Code matches the approved design and executes without critical logic errors.",
      "Entry points, configs, and dependencies are sufficiently documented for repeatable use.",
      "Baselines and ablations are implemented fairly and comparably.",
    ],
    prompts: [
      prompt(
        "system",
        "Implementation System Prompt",
        "Implement the approved experiment design as maintainable research software.",
        ["architecture spec", "config schema", "test targets"],
        ["Document any deviation from the blueprint.", "Fail fast on invalid inputs or incompatible shapes."],
      ),
      prompt(
        "progress_update",
        "Implementation Status Prompt",
        "Report implementation progress in a way that enables immediate execution handoff.",
        ["completed modules", "test status", "known limitations", "run blockers"],
        ["Do not claim readiness without a runnable entry point and config path."],
      ),
    ],
    skills: [
      skill(
        "pytorch-module-construction",
        "code_implementation",
        "PyTorch Module Construction",
        "Implement model components, training logic, and evaluation hooks as reusable modules.",
        ["architecture specification", "data interfaces"],
        ["source code", "test hooks", "config bindings"],
        ["Shapes and tensor contracts are explicit.", "Core modules have smoke-test coverage."],
      ),
      skill(
        "experiment-config-engineering",
        "code_implementation",
        "Experiment Config Engineering",
        "Create reproducible config structures and command entry points for experiment runs.",
        ["run matrix", "default values", "resource assumptions"],
        ["config templates", "CLI contract", "env notes"],
        ["Configs are versionable and readable.", "Every run-critical field has a defined default or override path."],
      ),
    ],
    collaborations: [
      collaboration("experiment_architecture_designer", "feedback", "When a design detail is ambiguous or infeasible.", ["implementation blocker", "affected module", "proposed alternatives"], ["clarified spec or approved deviation"]),
      collaboration("experiment_operations_engineer", "handoff", "When code is execution-ready.", ["entry points", "config templates", "dependency notes"], ["run readiness confirmation or operational blockers"]),
      collaboration("results_and_evidence_analyst", "review", "When result anomalies may come from implementation behavior.", ["suspicious outputs", "relevant code paths", "logging evidence"], ["implementation interpretation notes"]),
    ],
  },
  {
    roleId: "experiment_operations_engineer",
    category: "meta_worker",
    roleName: "Experiment Operations Engineer",
    workflowSegment: "Experiment execution",
    defaultNodeType: "monitor",
    defaultContextTag: "planning",
    summaryArtifactType: "execution_plan",
    corePositioning:
      "Operationalizes code into controlled experiment runs with complete provenance, monitoring, and failure handling.",
    coreResponsibilities: [
      "Prepare the runtime environment, launch jobs, monitor progress, and recover from operational failures.",
      "Capture metrics, logs, checkpoints, artifacts, and environment metadata for every run.",
      "Validate that each run uses the correct code version, config, seed, and resource profile.",
      "Produce run inventories and execution summaries for downstream analysis.",
    ],
    skillRequirements: [
      "Linux, shell, scheduler, environment management, logging, and experiment tracking expertise.",
      "Ability to distinguish infrastructure failures from code defects and scientific failures.",
      "Strong provenance discipline for configs, code versions, seeds, and run metadata.",
    ],
    collaborationRequirements: [
      "Accept runnable code and configs from the Research Software Engineer.",
      "Escalate code-level failures back to implementation and report infrastructure constraints to the Researcher.",
      "Provide complete execution records to the Results and Evidence Analyst.",
    ],
    performanceStandards: [
      "Runs are reproducible, correctly configured, and fully traceable.",
      "Operational failures are diagnosed accurately and documented with actionable evidence.",
      "All expected logs, metrics, and artifacts are captured or explicitly marked missing.",
    ],
    prompts: [
      prompt(
        "system",
        "Execution Operations System Prompt",
        "Run approved experiments with full provenance and operational discipline.",
        ["code reference", "run matrix", "resource envelope"],
        ["Do not run with ambiguous configs.", "Record every failure mode and retry decision."],
      ),
      prompt(
        "completion",
        "Execution Summary Prompt",
        "Summarize execution results for analysis and coordination.",
        ["successful runs", "failed runs", "artifact inventory", "operational anomalies"],
        ["Every run must include code/config provenance.", "Missing artifacts must be explicit."],
      ),
    ],
    skills: [
      skill(
        "run-orchestration",
        "experiment_execution",
        "Run Orchestration",
        "Schedule and launch the full experiment matrix with clear provenance tracking.",
        ["entry points", "config matrix", "resource policy"],
        ["run ledger", "job handles", "execution plan"],
        ["Each run has a unique identifier.", "Run metadata is complete before launch."],
      ),
      skill(
        "runtime-diagnostics",
        "experiment_execution",
        "Runtime Diagnostics",
        "Detect and classify operational anomalies during execution.",
        ["job logs", "resource metrics", "exit codes"],
        ["diagnostic summary", "retry recommendation", "escalation target"],
        ["Diagnosis distinguishes infra, code, and scientific failure classes."],
      ),
    ],
    collaborations: [
      collaboration("research_software_engineer", "feedback", "When execution blockers are caused by implementation issues.", ["failing command", "logs", "environment state"], ["code fix or workaround"]),
      collaboration("researcher", "escalation", "When resource limits or repeated failures threaten the milestone.", ["run status summary", "resource bottlenecks", "retry cost"], ["reprioritized run plan or scope change"]),
      collaboration("results_and_evidence_analyst", "handoff", "When runs complete or partially complete.", ["metrics", "logs", "artifacts", "provenance"], ["analysis-ready acknowledgment"]),
    ],
  },
  {
    roleId: "results_and_evidence_analyst",
    category: "meta_worker",
    roleName: "Results and Evidence Analyst",
    workflowSegment: "Result analysis",
    defaultNodeType: "result_compare",
    defaultContextTag: "planning",
    summaryArtifactType: "validation_report",
    corePositioning:
      "Transforms raw experiment outputs into defensible evidence about whether the research claims are supported.",
    coreResponsibilities: [
      "Aggregate metrics, logs, checkpoints, figures, and ablation outputs into an evidence review.",
      "Assess hypothesis support, baseline fairness, robustness, and anomaly patterns.",
      "Produce tables, charts, and interpretation notes that distinguish signal from noise.",
      "Recommend reruns, diagnostics, or design revisions when evidence is weak or contradictory.",
    ],
    skillRequirements: [
      "Quantitative analysis, visualization, and rigorous empirical interpretation.",
      "Understanding of metrics, benchmark comparison, robustness analysis, and validity threats.",
      "Ability to detect missing controls, suspicious improvements, and incomplete evidence chains.",
    ],
    collaborationRequirements: [
      "Receive fully traced run outputs from the Experiment Operations Engineer.",
      "Request implementation or execution clarification when anomalies could be non-scientific.",
      "Report evidence status and next-step recommendations back to the Researcher.",
    ],
    performanceStandards: [
      "Analyses are faithful to raw outputs and clearly state uncertainty.",
      "Claims are separated into supported, unsupported, and inconclusive categories.",
      "Generated tables and figures are publication-ready and reproducible.",
    ],
    prompts: [
      prompt(
        "system",
        "Evidence Analysis System Prompt",
        "Interpret experiment outputs into a structured evidence verdict.",
        ["hypotheses", "metrics", "baselines", "run provenance"],
        ["Do not overclaim beyond the measured evidence.", "Document anomalies instead of hiding them."],
      ),
      prompt(
        "completion",
        "Analysis Report Prompt",
        "Produce an evidence report suitable for Researcher review and downstream reuse.",
        ["supported findings", "negative findings", "inconclusive items", "recommended next experiments"],
        ["Every conclusion must cite the run evidence it depends on."],
      ),
    ],
    skills: [
      skill(
        "metric-aggregation",
        "result_analysis",
        "Metric Aggregation",
        "Aggregate and normalize run outputs into comparison-ready result tables.",
        ["run ledger", "metric files", "baseline IDs"],
        ["comparison table", "consistency checks"],
        ["Metrics are comparable across runs.", "Failed or partial runs are marked explicitly."],
      ),
      skill(
        "evidence-visualization",
        "result_analysis",
        "Evidence Visualization",
        "Generate figures and plots that explain performance, robustness, and error patterns.",
        ["aggregated metrics", "training curves", "error slices"],
        ["figures", "caption notes", "interpretation summary"],
        ["Plots are labeled clearly.", "Each figure answers a specific analytical question."],
      ),
    ],
    collaborations: [
      collaboration("experiment_operations_engineer", "feedback", "When missing logs or corrupted outputs block analysis.", ["missing artifact list", "affected runs"], ["artifact recovery or rerun recommendation"]),
      collaboration("research_software_engineer", "review", "When anomalies may come from code-level behavior.", ["anomaly description", "relevant run IDs", "evidence snippet"], ["implementation interpretation or fix path"]),
      collaboration("researcher", "handoff", "When the analysis report is ready.", ["evidence report", "figures", "next-step recommendation"], ["acceptance, redesign, or additional analysis request"]),
    ],
  },
  {
    roleId: "research_asset_reuse_specialist",
    category: "meta_worker",
    roleName: "Research Asset Reuse Specialist",
    workflowSegment: "Achievement reuse",
    defaultNodeType: "summarize",
    defaultContextTag: "final_report",
    summaryArtifactType: "final_report",
    corePositioning:
      "Packages validated outputs into reusable research assets, reusable code patterns, and durable documentation for future projects.",
    coreResponsibilities: [
      "Curate reusable code, configs, experiment templates, figures, summaries, and methodological lessons.",
      "Package validated outputs into reusable artifacts with versioning, provenance, and reuse instructions.",
      "Produce documentation that explains how to reproduce, adapt, or extend the work.",
      "Preserve failed attempts, caveats, and negative results when they are useful for future research planning.",
    ],
    skillRequirements: [
      "Artifact packaging, documentation design, repository hygiene, and long-term knowledge organization.",
      "Ability to convert project-specific results into reusable assets without losing scientific provenance.",
      "Understanding of reproducibility, attribution, and dissemination requirements in academic software work.",
    ],
    collaborationRequirements: [
      "Collect approved findings, code references, configs, and analysis summaries from upstream roles.",
      "Request missing documentation or provenance details before packaging assets.",
      "Return reusable deliverables to the Researcher with clear scope and reuse conditions.",
    ],
    performanceStandards: [
      "Reusable artifacts are versioned, documented, and immediately usable by future projects.",
      "Every packaged asset has traceable provenance and explicit reuse guidance.",
      "Only validated outputs are promoted as reusable core assets.",
    ],
    prompts: [
      prompt(
        "system",
        "Research Asset Packaging System Prompt",
        "Transform validated research outputs into reusable assets and durable documentation.",
        ["approved findings", "code references", "analysis summary", "artifact inventory"],
        ["Do not package unstable or weakly validated outputs as reusable defaults."],
      ),
      prompt(
        "completion",
        "Reuse Package Prompt",
        "Produce the final reuse package with provenance and future-use instructions.",
        ["reusable assets", "documentation", "open limitations", "recommended future extensions"],
        ["Every asset must include provenance and scope boundaries."],
      ),
    ],
    skills: [
      skill(
        "artifact-packaging",
        "artifact_packaging",
        "Artifact Packaging",
        "Bundle code, configs, summaries, and figures into reusable research assets.",
        ["approved outputs", "artifact inventory", "provenance notes"],
        ["asset package", "index manifest", "reuse guide"],
        ["Assets are versioned.", "Every asset points back to its evidence source."],
      ),
      skill(
        "lessons-learned-capture",
        "artifact_packaging",
        "Lessons Learned Capture",
        "Preserve successful patterns, failed attempts, and future recommendations in structured form.",
        ["analysis report", "implementation notes", "run postmortems"],
        ["lessons summary", "future work guide"],
        ["Both positive and negative findings are captured.", "Guidance is actionable for later projects."],
      ),
    ],
    collaborations: [
      collaboration("results_and_evidence_analyst", "handoff", "When validated findings are ready for packaging.", ["analysis report", "figures", "evidence verdict"], ["packaging-ready acknowledgment"]),
      collaboration("research_software_engineer", "handoff", "When stable code artifacts are available.", ["code references", "config templates", "dependency notes"], ["reusable module inventory"]),
      collaboration("researcher", "feedback", "When the reuse package draft is complete.", ["asset package", "limitations", "reuse recommendations"], ["final approval or revision request"]),
    ],
  },
];

export const STRUCTURED_COMMUNICATION_PROTOCOLS: StructuredCommunicationProtocol[] = [
  {
    id: "researcher-to-literature",
    fromRoleId: "researcher",
    toRoleId: "literature_intelligence_analyst",
    goal: "Generate the literature packet that grounds the rest of the workflow.",
    trigger: "A new research objective or unresolved evidence gap is identified.",
    requiredPayload: ["problem statement", "search boundaries", "comparison dimensions", "time budget"],
    responseContract: ["paper shortlist", "baseline matrix", "dataset guidance", "evidence gaps"],
    escalationPath: "Escalate to the Researcher if the literature is contradictory or insufficient.",
  },
  {
    id: "literature-to-design",
    fromRoleId: "literature_intelligence_analyst",
    toRoleId: "experiment_architecture_designer",
    goal: "Convert evidence into a valid experiment plan.",
    trigger: "The literature packet has been reviewed and approved.",
    requiredPayload: ["paper comparisons", "baseline shortlist", "metric guidance", "known limitations"],
    responseContract: ["experiment blueprint", "ablation plan", "evaluation protocol"],
    escalationPath: "Return to the Researcher if the evidence does not support a stable design decision.",
  },
  {
    id: "design-to-implementation",
    fromRoleId: "experiment_architecture_designer",
    toRoleId: "research_software_engineer",
    goal: "Translate the blueprint into executable code.",
    trigger: "The experiment design is approved for implementation.",
    requiredPayload: ["architecture specification", "config schema", "baseline definitions", "test expectations"],
    responseContract: ["implementation package", "config templates", "test notes", "known deviations"],
    escalationPath: "Escalate to the Researcher when the blueprint is not implementable as written.",
  },
  {
    id: "implementation-to-operations",
    fromRoleId: "research_software_engineer",
    toRoleId: "experiment_operations_engineer",
    goal: "Operationalize the code into controlled experiment runs.",
    trigger: "Runnable entry points and configs are available.",
    requiredPayload: ["entry points", "config matrix", "environment notes", "expected artifacts"],
    responseContract: ["run ledger", "execution status", "artifact inventory", "failure report"],
    escalationPath: "Return to implementation if execution blockers are caused by code or config defects.",
  },
  {
    id: "operations-to-analysis",
    fromRoleId: "experiment_operations_engineer",
    toRoleId: "results_and_evidence_analyst",
    goal: "Deliver analysis-ready results with provenance.",
    trigger: "Runs complete or enough evidence has accumulated for interpretation.",
    requiredPayload: ["metrics", "logs", "checkpoints", "artifact provenance", "failure notes"],
    responseContract: ["analysis report", "figures", "evidence verdict", "rerun recommendations"],
    escalationPath: "Escalate to the Researcher if the run set is too incomplete for meaningful analysis.",
  },
  {
    id: "analysis-to-reuse",
    fromRoleId: "results_and_evidence_analyst",
    toRoleId: "research_asset_reuse_specialist",
    goal: "Convert validated findings into reusable assets.",
    trigger: "The Researcher has accepted the evidence report.",
    requiredPayload: ["approved findings", "figures", "artifact list", "scope boundaries"],
    responseContract: ["reuse package", "documentation", "lessons learned", "future-use guidance"],
    escalationPath: "Return to the Researcher if findings are not mature enough for reuse packaging.",
  },
];

export function listStructuredRoleDefinitions(): StructuredRoleDefinition[] {
  return STRUCTURED_ROLE_DEFINITIONS;
}

export function listMetaWorkerRoleDefinitions(): StructuredRoleDefinition[] {
  return STRUCTURED_ROLE_DEFINITIONS.filter((role) => role.category === "meta_worker");
}

function normalizeStructuredRoleId(roleId: ModelRole | string, nodeType?: string): ModelRole {
  if (STRUCTURED_ROLE_DEFINITIONS.some((role) => role.roleId === roleId)) {
    return roleId as ModelRole;
  }

  if (roleId === "main_brain") {
    return "researcher";
  }

  if (roleId === "synthesizer") {
    return "results_and_evidence_analyst";
  }

  if (roleId === "worker") {
    switch (nodeType) {
      case "retrieve":
      case "evidence_gather":
      case "evidence_extract":
      case "summarize":
        return "literature_intelligence_analyst";
      case "validation_plan":
      case "skill_route":
        return "experiment_architecture_designer";
      case "resource_request":
      case "execute":
      case "monitor":
      case "data_download":
      case "preprocess":
        return "experiment_operations_engineer";
      case "result_collect":
      case "result_compare":
      case "review":
      case "synthesize":
      case "synthesize_claims":
        return "results_and_evidence_analyst";
      default:
        return "research_software_engineer";
    }
  }

  return roleId as ModelRole;
}

export function getStructuredRoleDefinition(roleId: ModelRole, nodeType?: string): StructuredRoleDefinition | null {
  const normalizedRoleId = normalizeStructuredRoleId(roleId, nodeType);
  return STRUCTURED_ROLE_DEFINITIONS.find((role) => role.roleId === normalizedRoleId) ?? null;
}

export function getStructuredRoleDisplayName(roleId: ModelRole | string, nodeType?: string): string {
  return getStructuredRoleDefinition(roleId as ModelRole, nodeType)?.roleName ?? String(roleId).replace(/_/g, " ");
}

export function getStructuredPromptForNode(roleId: ModelRole | string, nodeType?: string): StructuredRolePrompt | null {
  const role = getStructuredRoleDefinition(roleId as ModelRole, nodeType);
  if (!role) return null;

  if (role.roleId === "researcher") {
    return role.prompts.find((prompt) => prompt.kind === "task_intake")
      ?? role.prompts[0]
      ?? null;
  }

  if (nodeType === "review" || nodeType === "synthesize" || nodeType === "synthesize_claims" || nodeType === "result_compare") {
    return role.prompts.find((prompt) => prompt.kind === "system")
      ?? role.prompts[0]
      ?? null;
  }

  if (nodeType === "execute" || nodeType === "monitor" || nodeType === "resource_request" || nodeType === "result_collect") {
    return role.prompts.find((prompt) => prompt.kind === "system")
      ?? role.prompts[0]
      ?? null;
  }

  return role.prompts.find((prompt) => prompt.kind === "system")
    ?? role.prompts.find((prompt) => prompt.kind === "task_intake")
    ?? role.prompts[0]
    ?? null;
}

export function getNodeDisplayLabel(label: string): string {
  return label
    .replace(/\bMain Brain\b/g, "Researcher")
    .replace(/\bReviewer\b/g, "Results and Evidence Analyst")
    .replace(/\bSynthesizer\b/gi, "Results and Evidence Analyst");
}

export function getStructuredRoleArtifactTitle(role: StructuredRoleDefinition): string {
  return `${role.roleName} Role Specification`;
}

export function buildStructuredRoleArtifactContent(role: StructuredRoleDefinition): Record<string, unknown> {
  return artifactSummary(role);
}

export function buildStructuredProtocolArtifactContent(): Record<string, unknown> {
  return {
    title: "Deep Research Role Collaboration Protocol",
    roles: STRUCTURED_ROLE_DEFINITIONS.map((role) => ({
      roleId: role.roleId,
      roleName: role.roleName,
      category: role.category,
      workflowSegment: role.workflowSegment,
    })),
    protocols: STRUCTURED_COMMUNICATION_PROTOCOLS,
  };
}

export function getCommunicationProtocolsForRole(roleId: ModelRole): StructuredCommunicationProtocol[] {
  return STRUCTURED_COMMUNICATION_PROTOCOLS.filter(
    (protocol) => protocol.fromRoleId === roleId || protocol.toRoleId === roleId,
  );
}

export function buildRoleBootstrapMessage(role: StructuredRoleDefinition): string {
  const firstResponsibilities = role.coreResponsibilities.slice(0, 2).map((item) => `- ${item}`).join("\n");
  const firstSkills = role.skills.slice(0, 2).map((item) => `- ${item.name}: ${item.purpose}`).join("\n");

  return [
    `${role.roleName} is configured for the ${role.workflowSegment.toLowerCase()} segment.`,
    role.corePositioning,
    "Immediate responsibilities:",
    firstResponsibilities,
    "Primary structured skills:",
    firstSkills,
  ].join("\n");
}

export function buildResearcherSessionWelcome(): string {
  const workerNames = listMetaWorkerRoleDefinitions().map((role) => role.roleName).join(", ");
  return [
    "Deep Research is configured as a role-based research system.",
    "The coordinating role is Researcher, which owns the full research program and all top-level decisions.",
    "Researcher operates with a context-review -> plan -> user-confirmation -> supervised-execution contract.",
    `The six specialist roles are: ${workerNames}.`,
    "All role prompts, skills, and communication contracts are stored as structured specifications and exposed through this session shell.",
  ].join("\n\n");
}

export function buildStructuredRoleReply(
  role: StructuredRoleDefinition,
  userMessage: string,
): string {
  const firstPrompt = role.prompts[0];
  const nextCollaborations = role.collaborations.slice(0, 2)
    .map((item) => `${getStructuredRoleDisplayName(item.partnerRoleId)} via ${item.collaborationType}`)
    .join("; ");

  return [
    `${role.roleName} acknowledged the request: "${userMessage.trim()}".`,
    `Workflow segment: ${role.workflowSegment}.`,
    `Primary objective: ${firstPrompt?.objective ?? role.corePositioning}`,
    `Expected response structure: ${(firstPrompt?.requiredSections ?? []).join(", ") || "structured status update"}.`,
    nextCollaborations
      ? `Primary collaboration paths: ${nextCollaborations}.`
      : "Primary collaboration paths: coordinated directly by the Researcher.",
    "Execution remains interface-only, so this response records the role contract and expected collaboration behavior rather than launching live research actions.",
  ].join("\n");
}

export function buildRuntimeRoleContract(
  roleId: ModelRole | string,
  nodeType?: string,
  options?: {
    includeResponsibilities?: boolean;
    includeCollaboration?: boolean;
    includePerformance?: boolean;
    maxItemsPerSection?: number;
  },
): string | null {
  const role = getStructuredRoleDefinition(roleId as ModelRole, nodeType);
  if (!role) {
    return null;
  }

  const prompt = getStructuredPromptForNode(role.roleId, nodeType);
  const maxItems = options?.maxItemsPerSection ?? 3;
  const lines: string[] = [];

  lines.push(`- Active role: ${role.roleName}`);
  lines.push(`- Core positioning: ${role.corePositioning}`);

  if (prompt) {
    lines.push(`- Active prompt objective: ${prompt.objective}`);
    if (prompt.requiredSections.length > 0) {
      lines.push(`- Expected sections: ${prompt.requiredSections.join(", ")}`);
    }
    for (const constraint of prompt.constraints.slice(0, maxItems)) {
      lines.push(`- Constraint: ${constraint}`);
    }
  }

  if (options?.includeResponsibilities) {
    for (const responsibility of role.coreResponsibilities.slice(0, maxItems)) {
      lines.push(`- Responsibility: ${responsibility}`);
    }
  }

  if (options?.includeCollaboration) {
    for (const requirement of role.collaborationRequirements.slice(0, maxItems)) {
      lines.push(`- Collaboration rule: ${requirement}`);
    }
  }

  if (options?.includePerformance) {
    for (const standard of role.performanceStandards.slice(0, maxItems)) {
      lines.push(`- Quality bar: ${standard}`);
    }
  }

  return lines.join("\n");
}

export function getRoleColorToken(roleId: ModelRole | string, nodeType?: string): string {
  const normalizedRoleId = normalizeStructuredRoleId(roleId, nodeType);
  const colorMap: Record<string, string> = {
    researcher: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
    literature_intelligence_analyst: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
    experiment_architecture_designer: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    research_software_engineer: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    experiment_operations_engineer: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    results_and_evidence_analyst: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
    research_asset_reuse_specialist: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  };

  return colorMap[normalizedRoleId] ?? "bg-muted text-muted-foreground";
}

export function roleArtifactTypeFor(roleId: ModelRole, nodeType?: string): ArtifactType {
  return getStructuredRoleDefinition(roleId, nodeType)?.summaryArtifactType ?? "structured_summary";
}
