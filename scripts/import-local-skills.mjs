#!/usr/bin/env node
/**
 * Import SCP skills from .claude/skills/ directory into the SQLite database.
 * Usage: node scripts/import-local-skills.mjs
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SKILLS_DIR = path.join(PROJECT_ROOT, ".claude", "skills");
const DB_PATH = path.join(PROJECT_ROOT, "data", "notebooklm.db");

// Load SCP_HUB_API_KEY from .env.local
function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return env;
}

// Parse SKILL.md frontmatter + body
function parseSkillMd(content, fallbackSlug) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) {
    return {
      name: fallbackSlug,
      slug: fallbackSlug,
      description: null,
      systemPrompt: content.trim(),
      allowedTools: null,
    };
  }

  const frontmatter = fmMatch[1];
  let body = fmMatch[2].trim();
  if (!body) return null;

  const getValue = (key) => {
    const m = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return m?.[1]?.trim();
  };

  const getQuotedValue = (key) => {
    const raw = getValue(key);
    if (!raw) return undefined;
    return raw.replace(/^["']|["']$/g, "");
  };

  const name = getQuotedValue("name") || fallbackSlug;
  const description = getQuotedValue("description") || null;

  // Parse allowed-tools as YAML list
  let allowedTools = null;
  const toolsMatch = frontmatter.match(
    /^allowed-tools:\s*\n((?:\s+-\s+.+\n?)*)/m
  );
  if (toolsMatch) {
    allowedTools = toolsMatch[1]
      .split("\n")
      .map((l) => l.replace(/^\s*-\s*/, "").trim())
      .filter(Boolean);
  }

  return { name, slug: fallbackSlug, description, systemPrompt: body, allowedTools };
}

function main() {
  const env = loadEnv();
  const scpHubApiKey = env.SCP_HUB_API_KEY || "";

  if (!fs.existsSync(DB_PATH)) {
    console.error(`Database not found at ${DB_PATH}. Run the app first to create it.`);
    process.exit(1);
  }

  if (!fs.existsSync(SKILLS_DIR)) {
    console.error(`Skills directory not found at ${SKILLS_DIR}`);
    process.exit(1);
  }

  const db = new Database(DB_PATH);

  // Get existing slugs to avoid duplicates
  const existingSlugs = new Set(
    db.prepare("SELECT slug FROM skills WHERE workspace_id IS NULL").all().map((r) => r.slug)
  );

  const dirs = fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  const insert = db.prepare(`
    INSERT INTO skills (id, workspace_id, name, slug, description, system_prompt, steps, allowed_tools, parameters, is_enabled, created_at, updated_at)
    VALUES (?, NULL, ?, ?, ?, ?, NULL, ?, NULL, 1, datetime('now'), datetime('now'))
  `);

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  const insertMany = db.transaction(() => {
    for (const dir of dirs) {
      const skillMdPath = path.join(SKILLS_DIR, dir.name, "SKILL.md");
      if (!fs.existsSync(skillMdPath)) continue;

      const slug = dir.name.replace(/_/g, "-"); // normalize to kebab-case

      // Skip if already exists (by original or normalized slug)
      if (existingSlugs.has(slug) || existingSlugs.has(dir.name)) {
        skipped++;
        continue;
      }

      try {
        let content = fs.readFileSync(skillMdPath, "utf-8");

        // Replace SCP Hub API key placeholder
        if (scpHubApiKey && content.includes("<YOUR_SCP_HUB_API_KEY>")) {
          content = content.replaceAll("<YOUR_SCP_HUB_API_KEY>", scpHubApiKey);
        }

        const parsed = parseSkillMd(content, slug);
        if (!parsed) {
          failed++;
          continue;
        }

        insert.run(
          randomUUID(),
          parsed.name,
          parsed.slug,
          parsed.description,
          parsed.systemPrompt,
          parsed.allowedTools ? JSON.stringify(parsed.allowedTools) : null
        );
        imported++;
      } catch (err) {
        console.error(`Failed to import ${dir.name}:`, err.message);
        failed++;
      }
    }
  });

  insertMany();
  db.close();

  console.log(`\nSCP Skills Import Complete:`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped (already exists): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total directories scanned: ${dirs.length}`);
}

main();
