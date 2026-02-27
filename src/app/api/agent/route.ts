import { NextRequest } from "next/server";
import { streamText, convertToModelMessages, UIMessage, stepCountIs } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { createAgentTools } from "@/lib/ai/agent-tools";
import { buildAgentSystemPrompt } from "@/lib/ai/prompts";
import { buildSkillSystemPrompt } from "@/lib/ai/skill-prompt";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Skill } from "@/types";

function parseSkillRow(row: Record<string, unknown>): Skill {
  return {
    ...row,
    steps: typeof row.steps === "string" ? JSON.parse(row.steps) : null,
    allowedTools:
      typeof row.allowedTools === "string"
        ? JSON.parse(row.allowedTools)
        : null,
    parameters:
      typeof row.parameters === "string"
        ? JSON.parse(row.parameters)
        : null,
  } as Skill;
}

export async function POST(req: NextRequest) {
  try {
    const { messages: uiMessages, workspaceId, cwd, skillId, paramValues } =
      await req.json();

    if (!workspaceId || !cwd || typeof cwd !== "string") {
      return new Response("Missing workspaceId or cwd", { status: 400 });
    }

    if (!isAIAvailable()) {
      return new Response(
        "AI is not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local.",
        { status: 503 }
      );
    }

    const model = await getConfiguredModel();
    let systemPrompt: string;
    let tools;

    if (skillId) {
      // Skill mode: load skill from DB and use skill-specific prompt + tools
      const skillRows = await db
        .select()
        .from(skills)
        .where(eq(skills.id, skillId))
        .limit(1);

      if (skillRows.length === 0) {
        return new Response("Skill not found", { status: 404 });
      }

      const skill = parseSkillRow(skillRows[0]);

      if (!skill.isEnabled) {
        return new Response("Skill is disabled", { status: 403 });
      }

      // Enforce workspace scope: a workspace-specific skill can only be used within its workspace
      if (skill.workspaceId && skill.workspaceId !== workspaceId) {
        return new Response("Skill not found", { status: 404 });
      }
      systemPrompt = buildSkillSystemPrompt(skill, cwd, paramValues || {});
      tools = createAgentTools(cwd, skill.allowedTools);
    } else {
      // Default agent mode
      systemPrompt = buildAgentSystemPrompt(cwd);
      tools = createAgentTools(cwd);
    }

    const modelMessages = await convertToModelMessages(
      uiMessages as UIMessage[]
    );

    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(10),
      onError({ error }) {
        console.error("Agent stream error:", error);
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Agent error:", error);
    return new Response(
      error instanceof Error ? error.message : "Agent failed",
      { status: 500 }
    );
  }
}
