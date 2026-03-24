import { NextRequest, NextResponse } from "next/server";
import { isGitHubUrl } from "@/lib/skills/github-import";
import { parseSkillMd } from "@/lib/db/skills-insert";
import {
  resolveGitHubRepo,
  fetchRaw,
  batchProcess,
  type PreviewSkillItem,
} from "@/lib/skills/github-fetch";

// POST /api/skills/import/preview
// Body: { url: string }
// Returns: { skills: PreviewSkillItem[], branch: string, owner: string, repo: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing 'url' in request body" },
        { status: 400 }
      );
    }

    if (!isGitHubUrl(url)) {
      return NextResponse.json(
        { error: "Only GitHub URLs are supported for preview" },
        { status: 400 }
      );
    }

    const resolved = await resolveGitHubRepo(url);
    if (!resolved) {
      return NextResponse.json(
        {
          error:
            "No skills found in this GitHub repository. Expected SKILL.md, commands/*.md, or agents/*.md files.",
        },
        { status: 400 }
      );
    }

    // Single file - return immediately
    if (resolved.singleFile) {
      const parsed = parseSkillMd(
        resolved.singleFile.content,
        resolved.singleFile.fallbackSlug
      );
      if (!parsed) {
        return NextResponse.json(
          { error: "Failed to parse skill file" },
          { status: 400 }
        );
      }
      return NextResponse.json({
        singleFile: true,
        skills: [
          {
            path: resolved.singleFile.path,
            fallbackSlug: resolved.singleFile.fallbackSlug,
            name: parsed.name,
            slug: parsed.slug,
            description: parsed.description || null,
          },
        ],
        branch: resolved.branch,
        owner: resolved.owner,
        repo: resolved.repo,
      });
    }

    // Multiple files - fetch and parse each for preview info
    const previewItems: PreviewSkillItem[] = [];

    await batchProcess(resolved.contentFiles, 5, async (file) => {
      try {
        const content = await fetchRaw(
          resolved.owner,
          resolved.repo,
          resolved.branch,
          file.path
        );
        if (!content) return;

        const parsed = parseSkillMd(content, file.fallbackSlug);
        if (!parsed) return;

        previewItems.push({
          path: file.path,
          fallbackSlug: file.fallbackSlug,
          name: parsed.name,
          slug: parsed.slug,
          description: parsed.description || null,
        });
      } catch {
        // Skip files that can't be fetched/parsed
      }
    });

    // Sort by name
    previewItems.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      singleFile: false,
      skills: previewItems,
      branch: resolved.branch,
      owner: resolved.owner,
      repo: resolved.repo,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to preview skills";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
