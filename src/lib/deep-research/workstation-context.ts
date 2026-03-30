import path from "path";
import { count, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notes, sources, workspaces } from "@/lib/db/schema";
import { addWorkspaceRoot, listDirectory, readFile } from "@/lib/files/filesystem";
import { retrieveByKeywordSearch } from "@/lib/rag/retriever";
import type { DeepResearchMessage, DeepResearchSession } from "./types";

interface ContextHighlight {
  label: string;
  detail: string;
}

export interface WorkstationPlanningContext {
  searchQuery: string;
  promptBlock: string;
  topLevelEntries: string[];
  indexedFileHighlights: ContextHighlight[];
  rootFileHighlights: ContextHighlight[];
  noteHighlights: ContextHighlight[];
}

export async function buildWorkstationPlanningContext(
  session: DeepResearchSession,
  messages: DeepResearchMessage[],
): Promise<WorkstationPlanningContext> {
  const [workspace] = await db
    .select({
      name: workspaces.name,
      folderPath: workspaces.folderPath,
    })
    .from(workspaces)
    .where(eq(workspaces.id, session.workspaceId))
    .limit(1);

  if (!workspace) {
    return {
      searchQuery: session.title,
      promptBlock: "## Workstation Search\n- Workspace metadata is unavailable for this session.\n- You must rely on messages, nodes, artifacts, and requirement state.",
      topLevelEntries: [],
      indexedFileHighlights: [],
      rootFileHighlights: [],
      noteHighlights: [],
    };
  }

  const searchQuery = buildSearchQuery(session, messages);

  addWorkspaceRoot(workspace.folderPath);

  const [topLevelEntries, indexedFileHighlights, rootFileHighlights, noteHighlights, indexedSourceCount] = await Promise.all([
    loadTopLevelEntries(workspace.folderPath),
    loadIndexedFileHighlights(searchQuery, session.workspaceId),
    loadRootFileHighlights(workspace.folderPath),
    loadNoteHighlights(session.workspaceId),
    loadIndexedSourceCount(session.workspaceId),
  ]);

  const promptBlock = [
    "## Workstation Search",
    `- Workspace: ${workspace.name}`,
    `- Folder: ${workspace.folderPath}`,
    `- Search query: ${searchQuery}`,
    `- Indexed source count: ${indexedSourceCount}`,
    `- Top-level entries: ${topLevelEntries.length > 0 ? topLevelEntries.join(", ") : "(none found)"}`,
    "### Indexed File Highlights",
    formatHighlights(indexedFileHighlights),
    "### Root File Previews",
    formatHighlights(rootFileHighlights),
    "### Recent Notes And Memory",
    formatHighlights(noteHighlights),
    "IMPORTANT: Review this workstation search before drafting the plan. Reflect the useful findings in the context review summary and planning rationale.",
  ].join("\n");

  return {
    searchQuery,
    promptBlock,
    topLevelEntries,
    indexedFileHighlights,
    rootFileHighlights,
    noteHighlights,
  };
}

function buildSearchQuery(session: DeepResearchSession, messages: DeepResearchMessage[]): string {
  const userMessages = messages
    .filter((message) => message.role === "user")
    .slice(-3)
    .map((message) => message.content.trim())
    .filter(Boolean);

  return [session.title, ...userMessages].join(" | ").slice(0, 800);
}

async function loadTopLevelEntries(folderPath: string): Promise<string[]> {
  try {
    const entries = await listDirectory(folderPath);
    return entries
      .slice(0, 16)
      .map((entry) => `${entry.type === "directory" ? "[dir]" : "[file]"} ${entry.name}`);
  } catch {
    return [];
  }
}

async function loadIndexedFileHighlights(
  searchQuery: string,
  workspaceId: string,
): Promise<ContextHighlight[]> {
  try {
    const chunks = await retrieveByKeywordSearch(searchQuery, workspaceId, 6);
    return chunks.slice(0, 6).map((chunk) => ({
      label: chunk.relativePath || chunk.fileName,
      detail: truncateText(chunk.content, 260),
    }));
  } catch {
    return [];
  }
}

async function loadRootFileHighlights(folderPath: string): Promise<ContextHighlight[]> {
  try {
    const entries = await listDirectory(folderPath);
    const candidateFiles = entries
      .filter((entry) => entry.type === "file")
      .sort((a, b) => scoreRootFile(b.name) - scoreRootFile(a.name))
      .filter((entry) => scoreRootFile(entry.name) > 0)
      .slice(0, 4);

    const highlights: ContextHighlight[] = [];
    for (const entry of candidateFiles) {
      try {
        const content = await readFile(entry.path);
        highlights.push({
          label: path.basename(entry.path),
          detail: truncateText(content, 220),
        });
      } catch {
        // Ignore unreadable files.
      }
    }

    return highlights;
  } catch {
    return [];
  }
}

async function loadNoteHighlights(workspaceId: string): Promise<ContextHighlight[]> {
  const rows = await db
    .select({
      title: notes.title,
      content: notes.content,
      type: notes.type,
    })
    .from(notes)
    .where(eq(notes.workspaceId, workspaceId))
    .orderBy(desc(notes.updatedAt))
    .limit(5);

  return rows.map((row) => ({
    label: `[${row.type}] ${row.title}`,
    detail: truncateText(row.content, 220),
  }));
}

async function loadIndexedSourceCount(workspaceId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(sources)
    .where(eq(sources.workspaceId, workspaceId));

  return row?.count ?? 0;
}

function scoreRootFile(fileName: string): number {
  const lower = fileName.toLowerCase();
  if (lower === "readme.md" || lower === "readme") return 100;
  if (lower.includes("plan") || lower.includes("roadmap")) return 90;
  if (lower.includes("note") || lower.includes("summary") || lower.includes("report")) return 80;
  if (/\.(md|txt|rst)$/i.test(fileName)) return 60;
  if (/\.(json|ya?ml)$/i.test(fileName)) return 30;
  return 0;
}

function formatHighlights(highlights: ContextHighlight[]): string {
  if (highlights.length === 0) {
    return "- (none found)";
  }

  return highlights
    .map((highlight) => `- ${highlight.label}: ${highlight.detail}`)
    .join("\n");
}

function truncateText(text: string, maxChars: number): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxChars) {
    return compact;
  }
  return `${compact.slice(0, maxChars - 3)}...`;
}
