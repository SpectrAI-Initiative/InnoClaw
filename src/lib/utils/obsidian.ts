import { yamlEscape } from "./yaml";

/** Metadata for generating Obsidian-compatible YAML frontmatter. */
export interface NoteFrontmatter {
  title: string;
  date: string;
  type: "summary" | "roast" | "discussion" | "structured_note";
  tags?: string[];
  aliases?: string[];
  source?: string[];
  authors?: string[];
  paper_url?: string[];
}

/** Extended frontmatter for structured paper notes (dailypaper-skills style). */
export interface StructuredNoteFrontmatter extends NoteFrontmatter {
  method_name?: string;
  year?: string;
  venue?: string;
  image_source?: "online" | "local" | "mixed";
  arxiv_id?: string;
}

/** Generate a YAML frontmatter block from metadata. */
export function generateFrontmatter(meta: NoteFrontmatter | StructuredNoteFrontmatter): string {
  const lines: string[] = ["---"];

  lines.push(`title: '${yamlEscape(meta.title)}'`);
  lines.push(`date: ${meta.date}`);
  lines.push(`type: ${meta.type}`);

  // Structured note extra fields
  const structured = meta as StructuredNoteFrontmatter;
  if (structured.method_name) {
    lines.push(`method_name: '${yamlEscape(structured.method_name)}'`);
  }
  if (structured.year) {
    lines.push(`year: ${structured.year}`);
  }
  if (structured.venue) {
    lines.push(`venue: '${yamlEscape(structured.venue)}'`);
  }
  if (structured.image_source) {
    lines.push(`image_source: ${structured.image_source}`);
  }
  if (structured.arxiv_id) {
    lines.push(`arxiv_id: '${yamlEscape(structured.arxiv_id)}'`);
  }

  const listField = (key: string, values?: string[]) => {
    if (!values || values.length === 0) return;
    lines.push(`${key}:`);
    for (const v of values) {
      lines.push(`  - '${yamlEscape(v)}'`);
    }
  };

  listField("tags", meta.tags);
  listField("aliases", meta.aliases);
  listField("source", meta.source);
  listField("authors", meta.authors);
  listField("paper_url", meta.paper_url);

  lines.push("---");
  return lines.join("\n");
}

/** Wrap markdown content with YAML frontmatter. */
export function wrapWithFrontmatter(
  content: string,
  meta: NoteFrontmatter
): string {
  return `${generateFrontmatter(meta)}\n\n${content}`;
}

/**
 * Build an `obsidian://open` URI for opening a note in Obsidian.
 * `vaultPath` is the root directory of the Obsidian vault.
 * `filePath` is the absolute path to the note file.
 */
export function buildObsidianUri(vaultPath: string, filePath: string): string {
  // Vault name is the last segment of the vault path
  const vaultName = vaultPath.replace(/\/+$/, "").split("/").pop() || "vault";

  // File path relative to vault, without leading slash and without .md extension
  let relative = filePath.startsWith(vaultPath)
    ? filePath.slice(vaultPath.length)
    : filePath;
  relative = relative.replace(/^\/+/, "").replace(/\.md$/, "");

  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relative)}`;
}

/**
 * Build a "Related Notes" section using Obsidian `[[wikilink]]` syntax.
 * @param notes Array of `{ name, reason }` from the find-related-notes API.
 */
export function buildRelatedNotesSection(
  notes: { name: string; reason?: string }[]
): string {
  if (notes.length === 0) return "";

  const links = notes.map((n) => {
    // Strip .md extension for wikilink
    const linkName = n.name.replace(/\.md$/, "");
    const suffix = n.reason ? ` — ${n.reason}` : "";
    return `- [[${linkName}]]${suffix}`;
  });

  return `\n\n## Related Notes\n\n${links.join("\n")}`;
}

/** Build an Obsidian wikilink: `[[conceptName]]`. */
export function buildWikilink(conceptName: string): string {
  return `[[${conceptName.replace(/\.md$/, "")}]]`;
}

/** Build an Obsidian image embed: `![[filename|width]]`. */
export function buildImageEmbed(localPath: string, width = 600): string {
  const name = localPath.split("/").pop() || localPath;
  return `![[${name}|${width}]]`;
}

/**
 * Generate structured note frontmatter for a paper note (dailypaper-skills style).
 */
export function generateStructuredFrontmatter(meta: StructuredNoteFrontmatter): string {
  return generateFrontmatter(meta);
}

/**
 * Convert Obsidian `![[filename|width]]` embeds to standard markdown image
 * syntax using the `/api/files/raw` endpoint for local file serving.
 * This allows rendering Obsidian-style notes in the browser.
 */
export function resolveObsidianEmbeds(content: string, notesDir: string): string {
  return content.replace(
    /!\[\[([^\]|]+?)(?:\|(\d+))?\]\]/g,
    (_match, filename: string, width?: string) => {
      const assetPath = `${notesDir}/assets/${filename}`;
      const url = `/api/files/raw?path=${encodeURIComponent(assetPath)}`;
      const alt = width ? `${filename}` : filename;
      return `![${alt}](${url})`;
    }
  );
}
