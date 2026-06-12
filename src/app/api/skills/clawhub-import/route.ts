import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { parseSkillRow } from "@/lib/db/skills-utils";
import { insertSkill, parseSkillMd } from "@/lib/db/skills-insert";
import { parseClawHubUrl } from "@/lib/utils/clawhub";
import { requireAuth } from "@/lib/auth/server";
import { getOwnerUserIdForWrite, requireWorkspaceAccess } from "@/lib/auth/ownership";

const CLAWHUB_BASE = process.env.CLAWHUB_API_BASE || "https://clawhub.ai";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const body = await req.json();
    const { url, slug: slugOverride, workspaceId } = body as {
      url: string;
      slug?: string;
      workspaceId?: string | null;
    };

    if (workspaceId) {
      const access = await requireWorkspaceAccess(req, workspaceId);
      if (access instanceof NextResponse) {
        return access;
      }
    }

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing required field: url" },
        { status: 400 }
      );
    }

    const parsed = parseClawHubUrl(url.trim());
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid ClawHub URL. Expected format: https://clawhub.ai/owner/skill-name or owner/skill-name" },
        { status: 400 }
      );
    }

    const { owner, skillName } = parsed;
    const fallbackSlug = slugOverride?.trim() || skillName;

    // Try fetching SKILL.md from ClawHub — attempt multiple URL patterns in parallel
    const fetchUrls = [
      `${CLAWHUB_BASE}/api/skills/${owner}/${skillName}/raw`,
      `${CLAWHUB_BASE}/${owner}/${skillName}/raw/SKILL.md`,
      `${CLAWHUB_BASE}/${owner}/${skillName}/SKILL.md`,
    ];

    const results = await Promise.allSettled(
      fetchUrls.map((fetchUrl) =>
        fetch(fetchUrl, {
          signal: AbortSignal.timeout(15_000),
          redirect: "manual",
          headers: {
            Accept: "text/plain, text/markdown, application/json",
          },
        }).then(async (res) => {
          if (!res.ok) return null;
          const text = await res.text();
          return text.trim() || null;
        })
      )
    );

    const content =
      results
        .map((r) => (r.status === "fulfilled" ? r.value : null))
        .find((v) => v != null) ?? null;

    if (!content) {
      return NextResponse.json(
        { error: `No skill definition found at ClawHub: ${owner}/${skillName}` },
        { status: 404 }
      );
    }

    // Try parsing as JSON first, then as Markdown
    let skillData = null;

    try {
      const json = JSON.parse(content);
      if (json.name && json.systemPrompt) {
        skillData = {
          name: json.name,
          slug: json.slug || fallbackSlug,
          description: json.description || null,
          systemPrompt: json.systemPrompt,
          steps: json.steps ?? null,
          allowedTools: json.allowedTools ?? null,
          parameters: json.parameters ?? null,
        };
      }
    } catch {
      // Not JSON, try markdown
    }

    if (!skillData) {
      skillData = parseSkillMd(content, fallbackSlug);
    }

    if (!skillData || !skillData.name || !skillData.systemPrompt) {
      return NextResponse.json(
        { error: "Could not parse skill definition from ClawHub response" },
        { status: 400 }
      );
    }

    // Override slug if provided
    if (slugOverride?.trim()) {
      skillData.slug = slugOverride.trim();
    }

    const insertedId = await insertSkill(skillData, workspaceId || null, getOwnerUserIdForWrite(auth));
    if (!insertedId) {
      return NextResponse.json(
        { error: "Failed to save skill to database" },
        { status: 500 }
      );
    }

    // Fetch the inserted row to return it
    const [row] = await db
      .select()
      .from(skills)
      .where(eq(skills.id, insertedId))
      .limit(1);

    if (!row) {
      return NextResponse.json(
        { error: "Skill inserted but could not be retrieved" },
        { status: 500 }
      );
    }

    return NextResponse.json(parseSkillRow(row), { status: 201 });
  } catch (error) {
    console.error("[clawhub-import] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
