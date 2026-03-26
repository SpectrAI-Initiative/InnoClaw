import { promises as fs } from "fs";
import path from "path";
import { buildNodeSpecTemplatePromptBlock } from "./node-spec-templates";
import type { ContextTag } from "./types";

interface ResearcherDoctrineSkill {
  slug: string;
  name: string;
  description: string;
  body: string;
  keywords: string[];
}

interface ResearcherDoctrine {
  soul: string | null;
  thinkingModes: string | null;
  handoffTemplates: string | null;
  skills: ResearcherDoctrineSkill[];
}

interface DoctrinePromptOptions {
  contextTag: ContextTag;
  query: string;
  topK?: number;
}

interface DoctrineContextPolicy {
  prioritySkills: string[];
  soulSectionOrder: string[];
  thinkingModeSections: string[];
  handoffSectionLimit: number;
  planningLike: boolean;
  finalReportLike: boolean;
}

const RESEARCHER_DIR = path.join(process.cwd(), ".claude", "researcher");
const RESEARCHER_SKILLS_DIR = path.join(process.cwd(), ".claude", "skills");
const SOUL_PATH = path.join(RESEARCHER_DIR, "SOUL.md");
const THINKING_MODES_PATH = path.join(RESEARCHER_DIR, "THINKING_MODES.md");
const HANDOFF_TEMPLATES_PATH = path.join(RESEARCHER_DIR, "HANDOFF_TEMPLATES.md");

function getDoctrineContextPolicy(contextTag: ContextTag): DoctrineContextPolicy {
  switch (contextTag) {
    case "intake":
    case "planning":
      return {
        prioritySkills: [
          "researcher-context-audit",
          "researcher-ambiguity-gate",
          "researcher-plan-architect",
          "researcher-rigor-gate",
        ],
        soulSectionOrder: [
          "Identity",
          "Canonical Workflow",
          "Non-Negotiable Rules",
          "Scientific Quality Standard",
        ],
        thinkingModeSections: [
          "1. Context Audit Mode",
          "2. Ambiguity Gate Mode",
          "3. Plan Architecture Mode",
          "4. Verification Gate Mode",
        ],
        handoffSectionLimit: 6,
        planningLike: true,
        finalReportLike: false,
      };
    case "final_report":
      return {
        prioritySkills: [
          "researcher-rigor-gate",
          "researcher-replan-recovery",
          "researcher-dispatch-supervisor",
        ],
        soulSectionOrder: [
          "Identity",
          "Non-Negotiable Rules",
          "Scientific Quality Standard",
        ],
        thinkingModeSections: [
          "4. Verification Gate Mode",
          "6. Recovery And Replan Mode",
          "7. Finalization Mode",
        ],
        handoffSectionLimit: 3,
        planningLike: false,
        finalReportLike: true,
      };
    default:
      return {
        prioritySkills: [
          "researcher-dispatch-supervisor",
          "researcher-rigor-gate",
          "researcher-replan-recovery",
        ],
        soulSectionOrder: [
          "Identity",
          "Canonical Workflow",
          "Non-Negotiable Rules",
          "Scientific Quality Standard",
        ],
        thinkingModeSections: [
          "4. Verification Gate Mode",
          "5. Dispatch Supervision Mode",
          "6. Recovery And Replan Mode",
        ],
        handoffSectionLimit: 3,
        planningLike: false,
        finalReportLike: false,
      };
  }
}

export async function buildResearcherDoctrinePromptBlock({
  contextTag,
  query,
  topK = 4,
}: DoctrinePromptOptions): Promise<string | null> {
  const doctrine = await loadResearcherDoctrine();
  if (!doctrine.soul && !doctrine.thinkingModes && !doctrine.handoffTemplates && doctrine.skills.length === 0) {
    return null;
  }

  const selectedSkills = selectDoctrineSkills(doctrine.skills, contextTag, query, topK);
  const compressedSoul = compressSoul(doctrine.soul, contextTag);
  const compressedThinkingModes = compressThinkingModes(doctrine.thinkingModes, contextTag);
  const compressedHandoffs = compressHandoffTemplates(doctrine.handoffTemplates, contextTag, query);
  const nodeSpecTemplates = buildNodeSpecTemplatePromptBlock(contextTag, query);
  const lines: string[] = [];
  lines.push("## Researcher Doctrine");
  lines.push("- Treat the following soul, thinking modes, and skills as the standing operating doctrine for the Researcher main-brain.");
  lines.push("- Apply them as workflow rules, not as optional style suggestions.");

  if (compressedSoul) {
    lines.push("");
    lines.push("### Soul");
    lines.push(compressedSoul);
  }

  if (compressedThinkingModes) {
    lines.push("");
    lines.push("### Thinking Modes");
    lines.push(compressedThinkingModes);
  }

  if (compressedHandoffs) {
    lines.push("");
    lines.push("### Worker Handoffs");
    lines.push(compressedHandoffs);
  }

  if (nodeSpecTemplates) {
    lines.push("");
    lines.push(nodeSpecTemplates);
  }

  if (selectedSkills.length > 0) {
    lines.push("");
    lines.push(`### Active Skills For "${query}"`);
    for (const skill of selectedSkills) {
      lines.push(`#### ${skill.name}`);
      if (skill.description) {
        lines.push(`- Purpose: ${skill.description}`);
      }
      lines.push(compressSkillBody(skill));
      lines.push("");
    }
  }

  return lines.join("\n").trim();
}

async function loadResearcherDoctrine(): Promise<ResearcherDoctrine> {
  const [soul, thinkingModes, handoffTemplates, skills] = await Promise.all([
    safeReadText(SOUL_PATH),
    safeReadText(THINKING_MODES_PATH),
    safeReadText(HANDOFF_TEMPLATES_PATH),
    loadResearcherSkills(),
  ]);

  return { soul, thinkingModes, handoffTemplates, skills };
}

async function loadResearcherSkills(): Promise<ResearcherDoctrineSkill[]> {
  let entries: Array<{ isDirectory: () => boolean; name: string }>;
  try {
    entries = await fs.readdir(RESEARCHER_SKILLS_DIR, {
      withFileTypes: true,
      encoding: "utf8",
    }) as unknown as Array<{ isDirectory: () => boolean; name: string }>;
  } catch {
    return [];
  }

  const skills: ResearcherDoctrineSkill[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("researcher-")) {
      continue;
    }

    const skillPath = path.join(RESEARCHER_SKILLS_DIR, entry.name, "SKILL.md");
    const raw = await safeReadText(skillPath);
    if (!raw) {
      continue;
    }

    const parsed = parseSkillMarkdown(raw, entry.name);
    if (parsed) {
      skills.push(parsed);
    }
  }

  return skills.sort((a, b) => a.slug.localeCompare(b.slug));
}

function parseSkillMarkdown(content: string, fallbackSlug: string): ResearcherDoctrineSkill | null {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!frontmatterMatch) {
    return {
      slug: fallbackSlug,
      name: fallbackSlug,
      description: "",
      body: content.trim(),
      keywords: extractKeywords(`${fallbackSlug}\n${content}`),
    };
  }

  const frontmatter = frontmatterMatch[1];
  const body = frontmatterMatch[2].trim();
  const name = readFrontmatterValue(frontmatter, "name") ?? fallbackSlug;
  const slug = readFrontmatterValue(frontmatter, "slug") ?? fallbackSlug;
  const description = readFrontmatterValue(frontmatter, "description") ?? "";

  return {
    slug,
    name: stripWrappingQuotes(name),
    description: stripWrappingQuotes(description),
    body,
    keywords: extractKeywords(`${name}\n${description}\n${body}`),
  };
}

function selectDoctrineSkills(
  skills: ResearcherDoctrineSkill[],
  contextTag: ContextTag,
  query: string,
  topK: number,
): ResearcherDoctrineSkill[] {
  const policy = getDoctrineContextPolicy(contextTag);
  const queryKeywords = new Set(extractKeywords(query));

  const ranked = skills.map((skill) => {
    let score = policy.prioritySkills.includes(skill.slug) ? 100 : 0;
    for (const keyword of skill.keywords) {
      if (queryKeywords.has(keyword)) {
        score += 3;
      }
    }
    if (skill.slug.includes("rigor")) score += 2;
    if (skill.slug.includes("plan") && policy.planningLike) score += 5;
    if (skill.slug.includes("dispatch") && !policy.planningLike) score += 4;
    if (skill.slug.includes("replan")) score += 1;
    return { skill, score };
  });

  return ranked
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.skill.slug.localeCompare(b.skill.slug))
    .slice(0, topK)
    .map((item) => item.skill);
}

function compressSoul(content: string | null, contextTag: ContextTag): string | null {
  if (!content) {
    return null;
  }
  const sectionMap = splitMarkdownSections(content);
  return joinSelectedSections(sectionMap, getDoctrineContextPolicy(contextTag).soulSectionOrder);
}

function compressThinkingModes(content: string | null, contextTag: ContextTag): string | null {
  if (!content) {
    return null;
  }
  const sectionMap = splitMarkdownSections(content);
  return joinSelectedSections(sectionMap, getDoctrineContextPolicy(contextTag).thinkingModeSections);
}

function compressHandoffTemplates(
  content: string | null,
  contextTag: ContextTag,
  query: string,
): string | null {
  if (!content) {
    return null;
  }

  const sectionMap = splitMarkdownSections(content);
  const selectedSections = selectHandoffSections(sectionMap, contextTag, query);
  if (selectedSections.length === 0) {
    return null;
  }

  const lines: string[] = [];
  for (const sectionTitle of selectedSections) {
    const sectionBody = sectionMap.get(sectionTitle);
    if (!sectionBody) continue;
    const bullets = sectionBody
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .slice(0, 4);
    lines.push(`#### ${sectionTitle}`);
    lines.push(...bullets);
  }
  return lines.join("\n");
}

function compressSkillBody(skill: ResearcherDoctrineSkill): string {
  const sectionMap = splitMarkdownSections(skill.body);
  const sectionOrder = getSkillSectionOrder(skill.slug);
  const joined = joinSelectedSections(sectionMap, sectionOrder);
  return joined || skill.body.trim();
}

function getSkillSectionOrder(slug: string): string[] {
  if (slug === "researcher-context-audit") {
    return ["What To Review", "Output Contract", "Quality Rules"];
  }
  if (slug === "researcher-ambiguity-gate") {
    return ["Trigger Conditions", "Required Behavior", "Quality Rules"];
  }
  if (slug === "researcher-plan-architect") {
    return ["Plan Requirements", "Planning Principles", "Output Style"];
  }
  if (slug === "researcher-rigor-gate") {
    return ["Four Required Checks", "Anti-Regression Rule"];
  }
  if (slug === "researcher-dispatch-supervisor") {
    return ["Dispatch Rules", "Supervision Rules", "Quality Rules"];
  }
  if (slug === "researcher-replan-recovery") {
    return ["Diagnose First", "Recovery Policy", "User Escalation Rule", "Anti-Pattern"];
  }
  return [];
}

function selectHandoffSections(
  sectionMap: Map<string, string>,
  contextTag: ContextTag,
  query: string,
): string[] {
  const policy = getDoctrineContextPolicy(contextTag);
  const queryText = query.toLowerCase();
  const sections = [...sectionMap.keys()];
  const scored = sections.map((sectionTitle) => {
    let score = 0;
    const lower = sectionTitle.toLowerCase();
    if (policy.planningLike) {
      score += 20;
    }
    if (policy.finalReportLike && (lower.includes("results") || lower.includes("asset"))) {
      score += 40;
    }
    if (queryText.includes("evidence") || queryText.includes("literature")) {
      if (lower.includes("literature")) score += 30;
      if (lower.includes("results")) score += 10;
    }
    if (queryText.includes("design") || queryText.includes("validation")) {
      if (lower.includes("architecture")) score += 30;
    }
    if (queryText.includes("implement") || queryText.includes("code") || queryText.includes("engineer")) {
      if (lower.includes("software")) score += 30;
    }
    if (queryText.includes("execute") || queryText.includes("run") || queryText.includes("monitor")) {
      if (lower.includes("operations")) score += 30;
    }
    if (queryText.includes("analy") || queryText.includes("compare") || queryText.includes("result")) {
      if (lower.includes("results")) score += 30;
    }
    if (queryText.includes("report") || queryText.includes("reuse") || queryText.includes("deliverable")) {
      if (lower.includes("asset")) score += 30;
    }
    return { sectionTitle, score };
  });

  const ranked = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.sectionTitle.localeCompare(b.sectionTitle));

  return ranked.slice(0, policy.handoffSectionLimit).map((item) => item.sectionTitle);
}

function splitMarkdownSections(content: string): Map<string, string> {
  const lines = content.split("\n");
  const sections = new Map<string, string>();
  let currentTitle: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      if (currentTitle) {
        sections.set(currentTitle, currentLines.join("\n").trim());
      }
      currentTitle = headingMatch[1].trim();
      currentLines = [];
      continue;
    }

    if (currentTitle) {
      currentLines.push(line);
    }
  }

  if (currentTitle) {
    sections.set(currentTitle, currentLines.join("\n").trim());
  }

  return sections;
}

function joinSelectedSections(sectionMap: Map<string, string>, sectionOrder: string[]): string | null {
  const blocks: string[] = [];
  for (const sectionTitle of sectionOrder) {
    const sectionBody = sectionMap.get(sectionTitle);
    if (!sectionBody) continue;
    blocks.push(`#### ${sectionTitle}\n${sectionBody}`);
  }
  return blocks.length > 0 ? blocks.join("\n\n") : null;
}

function readFrontmatterValue(frontmatter: string, key: string): string | null {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim() ?? null;
}

function stripWrappingQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

function extractKeywords(value: string): string[] {
  return [...new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4 && !DOCTRINE_STOP_WORDS.has(token)),
  )];
}

async function safeReadText(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

const DOCTRINE_STOP_WORDS = new Set([
  "that",
  "this",
  "with",
  "from",
  "your",
  "when",
  "must",
  "should",
  "will",
  "into",
  "then",
  "than",
  "them",
  "they",
  "their",
  "through",
  "there",
  "research",
  "researcher",
  "skill",
  "workflow",
  "user",
]);
