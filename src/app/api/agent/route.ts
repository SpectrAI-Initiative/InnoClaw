import { NextRequest } from "next/server";
import { streamText, convertToModelMessages, UIMessage, stepCountIs } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { createAgentTools } from "@/lib/ai/agent-tools";
import { buildAgentSystemPrompt, buildPlanSystemPrompt, buildAskSystemPrompt } from "@/lib/ai/prompts";
import { buildSkillSystemPrompt } from "@/lib/ai/skill-prompt";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { and, eq, or, isNull } from "drizzle-orm";
import { parseSkillRow } from "@/lib/db/skills-utils";

export async function POST(req: NextRequest) {
  try {
    const { messages: uiMessages, workspaceId, cwd, skillId, paramValues, mode } =
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

      // Validate workspace ownership: workspace-specific skills can only be
      // accessed from their own workspace
      if (skill.workspaceId && skill.workspaceId !== workspaceId) {
        return new Response("Skill not found", { status: 404 });
      }

      systemPrompt = buildSkillSystemPrompt(skill, cwd, paramValues || {});
      tools = createAgentTools(cwd, skill.allowedTools, workspaceId);
    } else if (mode === "plan") {
      // Plan mode: read-only tools, focus on analysis and planning
      systemPrompt = buildPlanSystemPrompt(cwd);
      tools = createAgentTools(cwd, ["readFile", "listDirectory", "grep"], workspaceId);
    } else if (mode === "ask") {
      // Ask mode: read-only tools, can read files but never write or execute
      systemPrompt = buildAskSystemPrompt(cwd);
      tools = createAgentTools(cwd, ["readFile", "listDirectory", "grep"], workspaceId);
    } else {
      // Default agent mode: load skill catalog for auto-matching
      let skillCatalog: { slug: string; name: string; description: string | null }[] | undefined;
      try {
        const skillRows = await db
          .select({
            slug: skills.slug,
            name: skills.name,
            description: skills.description,
          })
          .from(skills)
          .where(
            and(
              eq(skills.isEnabled, true),
              workspaceId
                ? or(
                    isNull(skills.workspaceId),
                    eq(skills.workspaceId, workspaceId)
                  )
                : isNull(skills.workspaceId)
            )
          );
        if (skillRows.length > 0) {
          skillCatalog = skillRows;
        }
      } catch {
        // Skills table might not exist yet; proceed without catalog
      }

      systemPrompt = buildAgentSystemPrompt(cwd, skillCatalog);
      tools = createAgentTools(cwd, undefined, workspaceId);
    }

    const modelMessages = await convertToModelMessages(
      uiMessages as UIMessage[]
    );

    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      tools,
      abortSignal: req.signal,
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
