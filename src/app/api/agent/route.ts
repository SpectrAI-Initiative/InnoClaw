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

    // Sanitize UI messages: remove tool invocation parts with missing input
    // to prevent 400 errors from the API (tool_use.input: Field required)
    const sanitizedMessages = (uiMessages as UIMessage[]).map((msg) => ({
      ...msg,
      parts: msg.parts?.filter((part) => {
        const p = part as Record<string, unknown>;
        const type = p.type as string | undefined;
        if (type && (type.startsWith("tool-") || type === "dynamic-tool")) {
          return p.input !== undefined;
        }
        return true;
      }),
    })) as UIMessage[];

    const modelMessages = await convertToModelMessages(sanitizedMessages);

    const DEFAULT_MAX_STEPS = 10;
    const MAX_STEPS_UPPER_BOUND = 100;
    const parsedSteps = parseInt(process.env.AGENT_MAX_STEPS || "", 10);
    const maxSteps = Number.isFinite(parsedSteps) && parsedSteps > 0
      ? Math.min(parsedSteps, MAX_STEPS_UPPER_BOUND)
      : DEFAULT_MAX_STEPS;

    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      tools,
      abortSignal: req.signal,
      stopWhen: stepCountIs(maxSteps),
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
