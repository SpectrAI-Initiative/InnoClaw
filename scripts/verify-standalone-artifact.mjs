#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".next/standalone");

const forbiddenTopLevelDirectories = new Map([
  [".claude", "local agent configuration"],
  [".git", "version-control metadata"],
  [".superpowers", "local planning scratch"],
  [".worktrees", "nested worktrees"],
  ["backups", "deployment backups"],
  ["batch-test-logs", "test output"],
  ["data", "runtime data"],
  ["docs", "documentation source"],
  ["logs", "runtime logs"],
  ["opensource", "repository release metadata"],
  ["outputs", "runtime output"],
  ["plugins", "repository plugin source"],
  ["reference", "local references"],
  ["scripts", "repository scripts"],
  ["site", "documentation site source"],
  ["src", "application source"],
  ["test-results", "test output"],
  ["tmp-playwright-review", "browser review scratch"],
  ["workspaces", "runtime workspaces"],
]);

const forbiddenRootFiles = new Set([
  "AGENTS.md",
  "CHANGELOG.md",
  "CLAUDE.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "Dockerfile",
  "README.md",
  "README_en.md",
  "SECURITY.md",
  "SESSION_SUMMARY.md",
  "docker-compose.yml",
  "eslint.config.mjs",
  "vitest.config.ts",
]);

const allowedEnvironmentTemplates = new Set([
  ".env.example",
  ".env.production.example",
]);

const violations = new Map();

function normalize(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function addViolation(relativePath, reason) {
  violations.set(normalize(relativePath), reason);
}

function inspectPath(relativePath, isDirectory) {
  const normalized = normalize(relativePath);
  const segments = normalized.split("/");
  const topLevel = segments[0];

  if (topLevel === "node_modules") {
    return false;
  }

  if (forbiddenTopLevelDirectories.has(topLevel)) {
    addViolation(normalized, forbiddenTopLevelDirectories.get(topLevel));
    return false;
  }

  const baseName = segments.at(-1) ?? "";
  if (
    (baseName === ".env" || baseName.startsWith(".env.")) &&
    !allowedEnvironmentTemplates.has(baseName)
  ) {
    addViolation(normalized, "active environment file");
  }

  if (
    !isDirectory &&
    /\.(?:db|sqlite|sqlite3)(?:-(?:journal|shm|wal))?$/i.test(baseName)
  ) {
    addViolation(normalized, "SQLite runtime data");
  }

  if (
    !isDirectory &&
    /(?:^|\.)(?:spec|test)\.[cm]?[jt]sx?$/i.test(baseName)
  ) {
    addViolation(normalized, "test source");
  }

  if (!isDirectory && segments.length === 1) {
    if (forbiddenRootFiles.has(baseName)) {
      addViolation(normalized, "repository-only root file");
    }
    if (
      /\.(?:md|tsx?|mts|cts)$/i.test(baseName) &&
      !allowedEnvironmentTemplates.has(baseName)
    ) {
      addViolation(normalized, "repository source or documentation");
    }
  }

  return true;
}

function walk(directory, relativeDirectory = "") {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = relativeDirectory
      ? path.join(relativeDirectory, entry.name)
      : entry.name;
    const shouldDescend = inspectPath(relativePath, entry.isDirectory());
    if (entry.isDirectory() && shouldDescend) {
      walk(path.join(directory, entry.name), relativePath);
    }
  }
}

function inspectAuthProxy() {
  const serverDirectory = path.join(root, ".next", "server");
  if (!fs.existsSync(serverDirectory)) {
    return;
  }

  const proxyBundle = path.join(serverDirectory, "middleware.js");
  if (!fs.existsSync(proxyBundle)) {
    addViolation(
      path.relative(root, proxyBundle),
      "compiled authentication proxy is missing",
    );
  }

  const functionsManifest = path.join(
    serverDirectory,
    "functions-config-manifest.json",
  );
  if (!fs.existsSync(functionsManifest)) {
    addViolation(
      path.relative(root, functionsManifest),
      "authentication proxy registration is missing",
    );
    return;
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(functionsManifest, "utf-8"));
    if (!manifest.functions?.["/_middleware"]) {
      addViolation(
        path.relative(root, functionsManifest),
        "authentication proxy registration is missing",
      );
    }
  } catch {
    addViolation(
      path.relative(root, functionsManifest),
      "authentication proxy manifest is invalid",
    );
  }
}

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  console.error("Standalone artifact directory not found: " + root);
  process.exit(1);
}

walk(root);
inspectAuthProxy();

if (violations.size > 0) {
  console.error("Forbidden standalone artifact paths:");
  for (const [relativePath, reason] of [...violations].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    console.error("- " + relativePath + " (" + reason + ")");
  }
  process.exit(1);
}

console.log("Standalone artifact verified: " + root);
