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
export function buildQueryExpansionPrompt(): string {
  return `You are an academic search query optimizer. The user will provide a natural language question or description of the papers they are looking for. Your job is to extract optimized search terms.

Return a JSON object with exactly two fields:
- "keywords": an array of 3-6 concise keyword phrases optimized for academic paper search (arXiv-style). Each keyword should be a specific technical term or short phrase (1-3 words). Avoid vague terms.
- "query": a refined natural language query suitable for semantic search engines like Semantic Scholar.

Rules:
1. Keywords should cover the core technical concepts mentioned or implied.
2. Include both specific terms and slightly broader related terms to maximize recall.
3. Keep keywords concise and academic — use terms that would appear in paper titles or abstracts.
4. The query should be a clear, well-formed sentence that captures the user's search intent.
5. Return ONLY the JSON object, no markdown fences, no explanation.

Example input: "I want to find papers about using diffusion models for video generation"
Example output: {"keywords":["diffusion model","video generation","video synthesis","text-to-video","temporal diffusion"],"query":"diffusion models for video generation and synthesis"}`;
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
