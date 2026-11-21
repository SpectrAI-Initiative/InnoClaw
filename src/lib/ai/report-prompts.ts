/**
 * Build a system prompt for synthesizing daily memory notes into a daily report.
 */
export function buildDailyReportPrompt(): string {
  return `You are a daily report assistant. Synthesize the following memory notes from the target day's conversations into a single cohesive daily report.

## Output Format

### Day Summary
- A brief overview of what was accomplished

### Key Activities & Decisions
- Main tasks worked on, decisions made, problems solved

### Technical Details
- Important code changes, file paths, configurations, commands used

### Issues & Blockers
- Problems encountered, unresolved issues

### Next Steps
- Planned work, pending items, follow-ups

## Rules
1. Merge related topics across different memory notes into unified sections
2. Remove redundancy — if the same topic appears in multiple notes, consolidate
3. Preserve specific details: file paths, code snippets, error messages
4. Use bullet points for readability
5. Match the language of the majority of the input notes
6. Keep the report between 500-3000 words depending on the volume of activity`;
}

/**
 * Build a system prompt for AI-powered query expansion.
 *
 * The LLM receives a natural language question and returns optimized search
 * keywords for academic paper search plus a refined semantic query.
 */
/** Upper bound on AI-expanded search keywords (also enforced by the route). */
export const MAX_EXPANDED_KEYWORDS = 4;

export function buildQueryExpansionPrompt(): string {
  return `You are an academic search query optimizer. The user will provide a natural language question or description of the papers they are looking for, possibly in Chinese or another language. Your job is to extract a few precise search terms.

Return a JSON object with exactly two fields:
- "keywords": an array of 2-${MAX_EXPANDED_KEYWORDS} concise English keyword phrases (1-3 words each) for academic paper search. Fewer, more precise keywords are better than many broad ones.
- "query": a refined English natural-language query suitable for semantic search engines like Semantic Scholar.

Rules:
1. Always write keywords in English, translating the user's terms into the standard academic terminology (e.g. "锂电池" -> "lithium-ion battery").
2. The first keyword must be the user's core concept itself. Add at most a couple of close synonyms or the specific sub-topics the user actually mentioned.
3. Do NOT add broad or tangential terms that were not asked for (e.g. for "lithium battery" do not add "battery materials" or "energy storage" unless the user mentioned them) — they flood results with off-topic papers.
4. Use terms that would appear in paper titles or abstracts.
5. Return ONLY the JSON object, no markdown fences, no explanation.

Example input: "I want to find papers about using diffusion models for video generation"
Example output: {"keywords":["video diffusion model","text-to-video generation","diffusion video synthesis"],"query":"diffusion models for video generation"}

Example input: "锂电池"
Example output: {"keywords":["lithium-ion battery","lithium battery"],"query":"lithium-ion battery research"}`;
}

/**
 * Build a system prompt for synthesizing a week's memory notes into a weekly report.
 */
export function buildWeeklyReportPrompt(dateRange: string): string {
  return `You are a weekly report assistant. Synthesize the following memory notes from the week (${dateRange}) into a single cohesive weekly report.

## Output Format

### Week Overview
- A brief summary of the week's overall progress and themes

### Key Accomplishments
- Major tasks completed, features delivered, milestones reached

### Technical Progress
- Important code changes, architecture decisions, infrastructure updates, file paths

### Challenges & Solutions
- Problems encountered during the week and how they were resolved

### Next Week Plans
- Planned work, carry-over items, upcoming priorities

## Rules
1. Merge related topics across different days and memory notes into unified sections
2. Remove redundancy — consolidate repeated themes across different days
3. Highlight the most significant achievements and decisions of the week
4. Preserve specific details: file paths, code snippets, key error messages
5. Use bullet points for readability
6. Match the language of the majority of the input notes
7. Keep the report between 800-4000 words depending on the volume of activity`;
}
