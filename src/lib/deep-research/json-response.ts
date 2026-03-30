export function extractJsonFromLLMResponse<T>(text: string): T {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1].trim()) as T;
  }

  const firstBrace = text.indexOf("{");
  if (firstBrace >= 0) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = firstBrace; i < text.length; i++) {
      const ch = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === "\"") {
        inString = !inString;
        continue;
      }
      if (inString) {
        continue;
      }
      if (ch === "{") {
        depth++;
      }
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          return JSON.parse(text.slice(firstBrace, i + 1)) as T;
        }
      }
    }
  }

  return JSON.parse(text.trim()) as T;
}

export function safeParseJson(text: string): Record<string, unknown> {
  try {
    return extractJsonFromLLMResponse<Record<string, unknown>>(text);
  } catch {
    return { text };
  }
}
