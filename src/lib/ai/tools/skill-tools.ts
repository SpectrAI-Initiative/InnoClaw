import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { skills as skillsTable } from "@/lib/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import { parseSkillRow } from "@/lib/db/skills-utils";

export function createSkillTools(workspaceId?: string | null) {
  return {
    getSkillInstructions: tool({
      description:
        "Load detailed workflow instructions for a scientific skill (SCP Skill) by its slug. " +
        "Returns the skill's full system prompt with step-by-step workflow, tool descriptions, " +
        "and Python code examples. Use this when the user's request matches a skill from the catalog.",
      inputSchema: z.object({
        slug: z
          .string()
          .describe(
            "The skill slug (e.g. 'disease-reversal-prediction', 'drug_target_identification')"
          ),
      }),
      execute: async ({ slug }) => {
        const rows = await db
          .select()
          .from(skillsTable)
          .where(
            and(
              eq(skillsTable.slug, slug),
              eq(skillsTable.isEnabled, true),
              workspaceId
                ? or(
                    isNull(skillsTable.workspaceId),
                    eq(skillsTable.workspaceId, workspaceId)
                  )
                : isNull(skillsTable.workspaceId)
            )
          )
          .limit(1);

        if (rows.length === 0) {
          return {
            error: `Skill '${slug}' not found or disabled. Check the slug and try again.`,
          };
        }

        const skill = parseSkillRow(rows[0]);

        // Replace SCP Hub API key placeholder with a Python environment lookup.
        // Many imported skills still have the placeholder in the DB.
        // Handle quoted placeholder forms first so we don't leave invalid nested quotes.
        let instructions = skill.systemPrompt;
        if (instructions.includes("<YOUR_SCP_HUB_API_KEY>")) {
          const scpHubEnvExpr = 'os.environ["SCP_HUB_API_KEY"]';
          instructions = instructions
            .replaceAll('"<YOUR_SCP_HUB_API_KEY>"', scpHubEnvExpr)
            .replaceAll("'<YOUR_SCP_HUB_API_KEY>'", scpHubEnvExpr)
            .replaceAll("<YOUR_SCP_HUB_API_KEY>", scpHubEnvExpr);
        }

        return {
          name: skill.name,
          slug: skill.slug,
          description: skill.description,
          instructions,
          steps: skill.steps,
        };
      },
    }),
  };
}
