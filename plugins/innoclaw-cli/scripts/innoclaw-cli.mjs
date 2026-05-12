#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const DEFAULT_BASE_URL = process.env.INNOCLAW_BASE_URL || "http://localhost:3000";
const REPO_ROOT = process.cwd();

function printHelp() {
  console.log(`InnoClaw CLI

Usage:
  innoclaw doctor
  innoclaw app <dev|build|lint|test|start> [-- <extra npm args...>]
  innoclaw workspace list [--base-url <url>]
  innoclaw workspace add --name <name> --path <folder> [--git] [--git-remote-url <url>] [--base-url <url>]
  innoclaw research list --workspace-id <id> [--base-url <url>]
  innoclaw research create --workspace-id <id> --title <title> [--content <text>] [--interface-only] [--base-url <url>]
  innoclaw research show --session-id <id> [--base-url <url>]
  innoclaw research run --session-id <id> [--base-url <url>]
  innoclaw research export --session-id <id> [--filename <name>] [--base-url <url>]
`);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  const passthrough = [];
  let collectingPassthrough = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (collectingPassthrough) {
      passthrough.push(arg);
      continue;
    }
    if (arg === "--") {
      collectingPassthrough = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    i += 1;
  }

  return { positional, flags, passthrough };
}

function requireFlag(flags, name) {
  const value = flags[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required --${name}`);
  }
  return value.trim();
}

function getBaseUrl(flags) {
  return typeof flags["base-url"] === "string" && flags["base-url"].trim().length > 0
    ? flags["base-url"].trim().replace(/\/$/, "")
    : DEFAULT_BASE_URL.replace(/\/$/, "");
}

async function requestJson(path, { method = "GET", body, baseUrl }) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload.error === "string" ? payload.error : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return payload;
}

function runNpmScript(script, extraArgs) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("npm", ["run", script, ...(extraArgs.length > 0 ? ["--", ...extraArgs] : [])], {
      cwd: REPO_ROOT,
      stdio: "inherit",
      shell: false,
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`npm run ${script} exited with code ${code}`));
    });
    child.on("error", rejectPromise);
  });
}

function formatJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function handleDoctor() {
  const checks = {
    node: process.version,
    repoRoot: REPO_ROOT,
    hasEnvLocal: existsSync(resolve(REPO_ROOT, ".env.local")),
    hasDataDir: existsSync(resolve(REPO_ROOT, "data")),
    hasNodeModules: existsSync(resolve(REPO_ROOT, "node_modules")),
  };
  formatJson(checks);
}

async function handleWorkspace(command, flags) {
  const baseUrl = getBaseUrl(flags);
  if (command === "list") {
    const data = await requestJson("/api/workspaces", { baseUrl });
    formatJson(data);
    return;
  }

  if (command === "add") {
    const folderPath = resolve(requireFlag(flags, "path"));
    if (!existsSync(folderPath) || !statSync(folderPath).isDirectory()) {
      throw new Error(`Workspace path does not exist or is not a directory: ${folderPath}`);
    }
    const payload = {
      name: requireFlag(flags, "name"),
      folderPath,
      isGitRepo: flags.git === true,
      gitRemoteUrl: typeof flags["git-remote-url"] === "string" ? flags["git-remote-url"] : undefined,
    };
    const data = await requestJson("/api/workspaces", {
      method: "POST",
      body: payload,
      baseUrl,
    });
    formatJson(data);
    return;
  }

  throw new Error(`Unsupported workspace command: ${command}`);
}

async function handleResearch(command, flags) {
  const baseUrl = getBaseUrl(flags);

  if (command === "list") {
    const workspaceId = requireFlag(flags, "workspace-id");
    const data = await requestJson(`/api/deep-research/sessions?workspaceId=${encodeURIComponent(workspaceId)}`, {
      baseUrl,
    });
    formatJson(data);
    return;
  }

  if (command === "create") {
    const payload = {
      workspaceId: requireFlag(flags, "workspace-id"),
      title: requireFlag(flags, "title"),
      content: typeof flags.content === "string" ? flags.content : undefined,
      config: flags["interface-only"] === true ? { interfaceOnly: true } : undefined,
    };
    const data = await requestJson("/api/deep-research/sessions", {
      method: "POST",
      body: payload,
      baseUrl,
    });
    formatJson(data);
    return;
  }

  if (command === "show") {
    const sessionId = requireFlag(flags, "session-id");
    const data = await requestJson(`/api/deep-research/sessions/${encodeURIComponent(sessionId)}`, {
      baseUrl,
    });
    formatJson(data);
    return;
  }

  if (command === "run") {
    const sessionId = requireFlag(flags, "session-id");
    const data = await requestJson(`/api/deep-research/sessions/${encodeURIComponent(sessionId)}/run`, {
      method: "POST",
      body: {},
      baseUrl,
    });
    formatJson(data);
    return;
  }

  if (command === "export") {
    const sessionId = requireFlag(flags, "session-id");
    const payload = typeof flags.filename === "string" ? { filename: flags.filename } : {};
    const data = await requestJson(`/api/deep-research/sessions/${encodeURIComponent(sessionId)}/export`, {
      method: "POST",
      body: payload,
      baseUrl,
    });
    formatJson(data);
    return;
  }

  throw new Error(`Unsupported research command: ${command}`);
}

async function main() {
  const { positional, flags, passthrough } = parseArgs(process.argv.slice(2));
  if (positional.length === 0 || flags.help === true) {
    printHelp();
    return;
  }

  const [group, command] = positional;

  if (group === "doctor") {
    await handleDoctor();
    return;
  }

  if (group === "app") {
    if (!command || !["dev", "build", "lint", "test", "start"].includes(command)) {
      throw new Error("Usage: innoclaw app <dev|build|lint|test|start> [-- <extra npm args...>]");
    }
    await runNpmScript(command, passthrough);
    return;
  }

  if (group === "workspace") {
    if (!command) {
      throw new Error("Usage: innoclaw workspace <list|add> ...");
    }
    await handleWorkspace(command, flags);
    return;
  }

  if (group === "research") {
    if (!command) {
      throw new Error("Usage: innoclaw research <list|create|show|run|export> ...");
    }
    await handleResearch(command, flags);
    return;
  }

  throw new Error(`Unknown command group: ${group}`);
}

main().catch((error) => {
  console.error(`[innoclaw] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
