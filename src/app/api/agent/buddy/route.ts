import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { getConfiguredModelWithProvider, getModelFromOverride } from "@/lib/ai/provider";
import { isAIAvailable } from "@/lib/ai/provider";

export async function POST(req: NextRequest) {
  try {
    if (!isAIAvailable()) {
      return NextResponse.json({ error: "AI not configured" }, { status: 503 });
    }

    const body = await req.json();
    const { action } = body;

    // Use a fast/cheap model for buddy interactions
    let model;
    try {
      const override = getModelFromOverride("anthropic", "claude-3-5-haiku-20241022");
      model = override.model;
    } catch {
      const configured = await getConfiguredModelWithProvider();
      model = configured.model;
    }

    if (action === "hatch") {
      const { species, rarity, stats } = body;

      const statsDesc = Object.entries(stats as Record<string, number>)
        .map(([name, val]) => {
          const level = val < 20 ? "very low" : val < 40 ? "low" : val < 60 ? "moderate" : val < 80 ? "high" : "very high";
          return `${name}=${val}/100 (${level})`;
        })
        .join(", ");

      const result = await generateText({
        model,
        prompt: `You are naming a small ${species} companion (${rarity} rarity) for a coding assistant.
Their stats: ${statsDesc}

Generate:
1. A creative two-word name (like "Glitch Honker" or "Binary Puff") that fits their species and personality
2. A brief personality description (1-2 sentences) based on their stats

Reply in exactly this format:
NAME: <name>
PERSONALITY: <personality>`,
        maxOutputTokens: 100,
      });

      const text = result.text;
      const nameMatch = text.match(/NAME:\s*(.+)/i);
      const personalityMatch = text.match(/PERSONALITY:\s*(.+)/i);

      return NextResponse.json({
        name: nameMatch?.[1]?.trim() ?? `${rarity} ${species}`,
        personality: personalityMatch?.[1]?.trim() ?? `A ${rarity} ${species} companion.`,
      });
    }

    if (action === "react") {
      const { lastMsg, companion } = body;
      const preview = (lastMsg as string).slice(0, 500);

      const statsDesc = Object.entries(companion.stats as Record<string, number>)
        .map(([name, val]) => {
          const level = val < 20 ? "very low" : val < 40 ? "low" : val < 60 ? "moderate" : val < 80 ? "high" : "very high";
          return `${name}=${val}/100 (${level})`;
        })
        .join(", ");

      const result = await generateText({
        model,
        prompt: `You are ${companion.name}, a small ${companion.species} (${companion.rarity} rarity) who sits beside a coding terminal.
Your personality: ${companion.personality}
Your stats: ${statsDesc}

How stats affect your behavior:
- DEBUGGING: High = give technical insights, Low = clueless about code
- PATIENCE: High = calm and supportive, Low = easily frustrated
- CHAOS: High = random and unpredictable, Low = orderly and steady
- WISDOM: High = thoughtful and deep, Low = naive and simple
- SNARK: High = sarcastic and witty, Low = earnest and sweet

IMPORTANT: Reply in the same language as the assistant's message below.

The AI assistant just said:
"${preview}"

React with a single short witty comment (under 60 chars). Stay in character. No quotes, no emojis, no explanation.`,
        maxOutputTokens: 60,
      });

      return NextResponse.json({ reaction: result.text.trim() });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Buddy operation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
