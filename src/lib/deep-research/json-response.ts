export function extractJsonFromLLMResponse<T>(text: string): T {
  // Try code-fenced JSON first
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch {
      // Fall through to next strategy
    }
  }

  // Try to find balanced JSON object
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
          try {
            return JSON.parse(text.slice(firstBrace, i + 1)) as T;
          } catch {
            // Try to recover: fix common LLM JSON mistakes
            let fixed = text.slice(firstBrace, i + 1);
            // Fix trailing commas before closing braces/brackets
            fixed = fixed.replace(/,(\s*[}\]])/g, "$1");
            // Fix unescaped newlines in string values
            fixed = fixed.replace(/(?<=[^\\])\\n(?=.*?:)/g, "\\n");
            try {
              return JSON.parse(fixed) as T;
            } catch {
              // Last resort: try removing the last problematic key-value pair
              const lastComma = fixed.lastIndexOf(',"');
              if (lastComma > 0) {
                try {
                  return JSON.parse(fixed.slice(0, lastComma) + "}") as T;
                } catch {
                  // Give up
                }
              }
            }
          }
        }
      }
    }
  }

  // Try parsing the whole text as JSON
  try {
    return JSON.parse(text.trim()) as T;
  } catch {
    // Can't parse — return a fallback object
    return { rawText: text, parseError: "Could not extract valid JSON from response" } as unknown as T;
  }
}

export function safeParseJson(text: string): Record<string, unknown> {
  try {
    return extractJsonFromLLMResponse<Record<string, unknown>>(text);
  } catch {
    return { text };
  }
}
