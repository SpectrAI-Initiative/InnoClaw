/** Display adapter: reads file paths the agent already put on tool inputs. */
export interface ConclusionFile {
  path: string;
  name: string;
}

const CONCLUSION_EXT = /\.(md|html)$/i;

function filePathFromInput(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const value = (input as { filePath?: unknown }).filePath;
  return typeof value === "string" && value.trim() ? value : null;
}

export function conclusionFilesFromToolInputs(inputs: unknown[]): ConclusionFile[] {
  const seen = new Set<string>();
  const files: ConclusionFile[] = [];

  for (const input of inputs) {
    const path = filePathFromInput(input);
    if (!path || seen.has(path) || !CONCLUSION_EXT.test(path)) continue;
    seen.add(path);
    const name = path.split(/[/\\]/).pop() || path;
    files.push({ path, name });
  }

  return files;
}
