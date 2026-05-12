/**
 * KAIROS cross-session memory system.
 * Ported from cc-mini's memory.py — daily logs, memory tag extraction,
 * dream consolidation prompts, and system prompt injection.
 */

/**
 * Extract all <memory>...</memory> tag contents from text.
 */
export function extractMemoryTags(text: string): string[] {
  const matches = text.match(/<memory>([\s\S]*?)<\/memory>/g);
  if (!matches) return [];
  return matches.map((m) => m.replace(/<\/?memory>/g, "").trim()).filter(Boolean);
}

/**
 * Build the KAIROS memory instructions for injection into the system prompt.
 * Includes 4-type taxonomy, what to save/not save, and current memory index.
 */
export function buildMemorySystemSection(memoryIndex: string): string {
  let section = `
# Auto Memory

You have a persistent memory system that spans conversations.
Use <memory>...</memory> tags in your responses to save important information.
These tags are automatically extracted and appended to the workspace memory log.

## Types of memory

### user
Information about the user's role, goals, preferences, and knowledge.
**When to save:** When you learn details about the user that shape how you should help.

### feedback
Guidance or correction the user has given you about how to work.
**When to save:** Any time the user corrects your approach or confirms a non-obvious choice.

### project
Information about ongoing work, goals, or decisions not derivable from code.
**When to save:** When you learn who is doing what, why, or by when.

### reference
Pointers to external resources and their purpose.
**When to save:** When you learn about resources in external systems.

## What NOT to save
- Code patterns, architecture, file paths — derivable from reading the project
- Git history or recent changes — use git log / git blame
- Debugging solutions — the fix is in the code
- Ephemeral task details or current conversation context

## Slash commands
- \`/memory\` — show current memory index
- \`/remember <text>\` — manually append a note to the daily log
- \`/dream\` — consolidate daily logs into topic files
`;

  if (memoryIndex) {
    section += `\n## Current Memory Index\n${memoryIndex}\n`;
  } else {
    section += "\nNo memories consolidated yet.\n";
  }

  return section;
}

/**
 * Build the dream consolidation prompt for the dream agent.
 */
export function buildDreamPrompt(workspaceId: string, dailyLogs: string[], existingMemories: string[]): string {
  const logsSection = dailyLogs.length > 0
    ? dailyLogs.join("\n\n---\n\n")
    : "No daily logs found.";

  const memoriesSection = existingMemories.length > 0
    ? existingMemories.join("\n\n---\n\n")
    : "No existing memories.";

  return `You are running a KAIROS dream consolidation for workspace ${workspaceId}.
Your job is to read daily logs and existing memories, then produce a consolidated memory index.

## Daily Logs
${logsSection}

## Existing Memories
${memoriesSection}

## Instructions
1. Group related entries by topic
2. Identify the memory type for each group (user, feedback, project, reference)
3. Merge similar entries, removing duplicates
4. Convert relative dates to absolute dates where possible
5. Produce a consolidated summary as a markdown document with sections for each topic

Output the consolidated memory as a single markdown document.
Each section should have a clear heading and brief, actionable content.
Keep it concise — under 200 lines total.`;
}

/**
 * Format a daily log entry with timestamp.
 */
export function formatDailyLogEntry(entry: string): string {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return `- [${time}] ${entry}`;
}

/**
 * Get today's date key for daily log grouping.
 */
export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
