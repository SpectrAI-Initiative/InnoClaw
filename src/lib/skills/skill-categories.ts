/**
 * Rule-based categories and search for the skills page.
 *
 * Skills have no category column, so categories are derived from the slug,
 * name and description. Each category's pattern is matched against those
 * fields with weights (slug 3, name 2, description 1) and the best-scoring
 * category wins, so an incidental word in a long description ("…via PubMed")
 * does not outweigh what the skill is named after. Earlier categories win
 * ties. Anything unmatched falls into "other".
 */

export const SKILL_CATEGORY_IDS = [
  "workflow",
  "literature",
  "drug",
  "chemistry",
  "protein",
  "genomics",
  "clinical",
  "earth",
  "data",
  "other",
] as const;

export type SkillCategoryId = (typeof SKILL_CATEGORY_IDS)[number];

const CATEGORY_PATTERNS: Array<[Exclude<SkillCategoryId, "other">, RegExp]> = [
  ["workflow", /researcher|openspec|ideation|protocol|skill-creator|paper-discussion|workflow-|planning|rigor/],
  ["literature", /paper|literature|pubmed|arxiv|citation|manuscript|scholar|patent|meta-analysis/],
  ["drug", /drug|admet|docking|pharmaco|toxic|ligand|screening|chembl|medicin|druggab|bioactiv|polypharm/],
  ["chemistry", /molecul|smiles|chemi|compound|pubchem|reaction|retrosynth|polymer|material|crystal|functional-group|natural-product/],
  ["protein", /protein|uniprot|enzyme|antibod|interpro|\bpdb\b|peptide|alphafold|proteom|ppi/],
  ["genomics", /\bgenes?\b|gene-|genom|variant|\bdna\b|\brna\b|sequenc|virus|viral|ncbi|gwas|crispr|transcript|omics|blast|phylogen|snp/],
  ["clinical", /disease|clinical|patient|medical|trial|cancer|tumou?r|oncolog|diagnos|phenotype|hpo/],
  ["earth", /wind|seawater|ocean|climate|atmospher|weather|seismic|geolog|solar|nuclear|thermal|energy/],
  ["data", /data|statistic|signal|unit-|conversion|calculat|measure|geometr|physic|optic|electr|circuit|cad/],
];

export interface CategorizableSkill {
  slug: string;
  name: string;
  description: string | null;
}

export function categorizeSkill(skill: CategorizableSkill): SkillCategoryId {
  const fields: Array<[string, number]> = [
    [skill.slug.toLowerCase(), 3],
    [skill.name.toLowerCase().replace(/_/g, "-"), 2],
    [(skill.description ?? "").toLowerCase(), 1],
  ];
  let best: SkillCategoryId = "other";
  let bestScore = 0;
  for (const [id, pattern] of CATEGORY_PATTERNS) {
    const score = fields.reduce((sum, [text, weight]) => sum + (pattern.test(text) ? weight : 0), 0);
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}

export interface SkillFilter {
  query?: string;
  category?: SkillCategoryId | "all";
  /** Extra searchable text per skill id, e.g. a translated description. */
  extraText?: Record<string, string>;
}

/** Case-insensitive search over name, slug, description and extra text; all words must match. */
export function filterSkills<T extends CategorizableSkill & { id: string }>(
  skills: T[],
  { query = "", category = "all", extraText = {} }: SkillFilter
): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return skills.filter((skill) => {
    if (category !== "all" && categorizeSkill(skill) !== category) return false;
    if (words.length === 0) return true;
    const haystack = [skill.name, skill.slug, skill.description ?? "", extraText[skill.id] ?? ""]
      .join(" ")
      .toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}
