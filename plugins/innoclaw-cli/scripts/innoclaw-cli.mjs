#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import {
  APP_ROOT,
  DEFAULT_BASE_URL,
  DEFAULT_WORKSPACE_CWD,
  normalizeBaseUrl,
} from "../src/runtime.mjs";
import { createApiClient } from "../src/http.mjs";
import { runAgentStream, makeUserMessage, getMessageText } from "../src/agent-client.mjs";
import { runBatch } from "../src/batch-client.mjs";
import { createRenderer, startRepl } from "../src/repl.mjs";
import { ensureServerReady } from "../src/server-client.mjs";
import { createSessionManager } from "../src/session-client.mjs";
import { ensureWorkspace } from "../src/workspace-client.mjs";

function printHelp() {
  console.log(`InnoClaw CLI

Usage:
  innoclaw
  innoclaw run --prompt <text>
  innoclaw batch --input <jobs.json>
  innoclaw auth <status|login|logout>
  innoclaw doctor
  innoclaw app <dev|build|lint|test|start> [-- <extra npm args...>]
  innoclaw workspace list [--base-url <url>]
  innoclaw workspace add --name <name> --path <folder> [--git] [--git-remote-url <url>] [--base-url <url>]
  innoclaw research list --workspace-id <id> [--base-url <url>]
  innoclaw research create --workspace-id <id> --title <title> [--content <text>] [--interface-only] [--base-url <url>]
  innoclaw research show --session-id <id> [--base-url <url>]
  innoclaw research run --session-id <id> [--base-url <url>]
  innoclaw research export --session-id <id> [--filename <name>] [--base-url <url>]

Shared flags:
  --base-url <url>         Override the local app URL (default: ${DEFAULT_BASE_URL})
  --cwd <path>             Workspace directory for interactive/run/batch (default: current shell directory)
  --workspace-name <name>  Explicit workspace name when auto-registering --cwd
  --skill <skill-id>       Run a specific skill instead of the default agent
  --provider <provider>    Override model provider for this run
  --model <model>          Override model name for this run
  --mode <agent|ask|plan|long-agent>
                          Agent run mode for interactive/run/batch defaults

Examples:
  innoclaw
  innoclaw run --prompt "Summarize this repository"
  printf 'Plan this workspace' | innoclaw run
  innoclaw batch --input jobs.json --workers 4
  innoclaw auth login
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

function getOptionalFlag(flags, name) {
  const value = flags[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseIntegerFlag(flags, name) {
  const raw = getOptionalFlag(flags, name);
  if (raw === null) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --${name}: ${raw}`);
  }
  return parsed;
}

function getBaseUrl(flags) {
  return normalizeBaseUrl(getOptionalFlag(flags, "base-url") || DEFAULT_BASE_URL);
}

function getWorkspaceCwd(flags) {
  return resolve(getOptionalFlag(flags, "cwd") || DEFAULT_WORKSPACE_CWD);
}

function parseListFlag(flags, name) {
  const raw = getOptionalFlag(flags, name);
  if (!raw) {
    return [];
  }
  return raw.split(",").map((value) => value.trim()).filter(Boolean);
}

function runNpmScript(script, extraArgs) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("npm", ["run", script, ...(extraArgs.length > 0 ? ["--", ...extraArgs] : [])], {
      cwd: APP_ROOT,
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

function createManagedSession(baseUrl) {
  return createSessionManager(baseUrl, ({ getCookieHeader, onResponse }) =>
    createApiClient({ baseUrl, getCookieHeader, onResponse }));
}

async function createApiContext(baseUrl, { authenticate = true, interactiveAuth = true } = {}) {
  await ensureServerReady({ appRoot: APP_ROOT, baseUrl });
  const sessionManager = createManagedSession(baseUrl);
  await sessionManager.load();
  if (authenticate) {
    await sessionManager.ensureAuthenticated({ interactive: interactiveAuth });
  }
  return sessionManager;
}

async function readPromptFromStdin() {
  if (process.stdin.isTTY) {
    return "";
  }
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf-8"));
  }
  return chunks.join("").trim();
}

function getRunMode(flags) {
  const mode = getOptionalFlag(flags, "mode") || "agent";
  if (!["agent", "ask", "plan", "long-agent"].includes(mode)) {
    throw new Error(`Unsupported --mode: ${mode}`);
  }
  return mode;
}

async function handleDoctor(flags) {
  const checks = {
    node: process.version,
    appRoot: APP_ROOT,
    baseUrl: getBaseUrl(flags),
    workspaceCwd: getWorkspaceCwd(flags),
    hasEnvLocal: existsSync(resolve(APP_ROOT, ".env.local")),
    hasDataDir: existsSync(resolve(APP_ROOT, "data")),
    hasNodeModules: existsSync(resolve(APP_ROOT, "node_modules")),
  };
  formatJson(checks);
}

async function handleWorkspace(command, flags) {
  const baseUrl = getBaseUrl(flags);
  const sessionManager = await createApiContext(baseUrl);
  const apiClient = sessionManager.apiClient;
  if (command === "list") {
    const { payload } = await apiClient.requestJson("/api/workspaces");
    formatJson(payload);
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
    const { payload: created } = await apiClient.requestJson("/api/workspaces", {
      method: "POST",
      body: payload,
    });
    formatJson(created);
    return;
  }

  throw new Error(`Unsupported workspace command: ${command}`);
}

async function handleResearch(command, flags) {
  const baseUrl = getBaseUrl(flags);
  const sessionManager = await createApiContext(baseUrl);
  const apiClient = sessionManager.apiClient;

  if (command === "list") {
    const workspaceId = requireFlag(flags, "workspace-id");
    const { payload } = await apiClient.requestJson(`/api/deep-research/sessions?workspaceId=${encodeURIComponent(workspaceId)}`);
    formatJson(payload);
    return;
  }

  if (command === "create") {
    const payload = {
      workspaceId: requireFlag(flags, "workspace-id"),
      title: requireFlag(flags, "title"),
      content: typeof flags.content === "string" ? flags.content : undefined,
      config: flags["interface-only"] === true ? { interfaceOnly: true } : undefined,
    };
    const { payload: created } = await apiClient.requestJson("/api/deep-research/sessions", {
      method: "POST",
      body: payload,
    });
    formatJson(created);
    return;
  }

  if (command === "show") {
    const sessionId = requireFlag(flags, "session-id");
    const { payload } = await apiClient.requestJson(`/api/deep-research/sessions/${encodeURIComponent(sessionId)}`);
    formatJson(payload);
    return;
  }

  if (command === "run") {
    const sessionId = requireFlag(flags, "session-id");
    const { payload } = await apiClient.requestJson(`/api/deep-research/sessions/${encodeURIComponent(sessionId)}/run`, {
      method: "POST",
      body: {},
    });
    formatJson(payload);
    return;
  }

  if (command === "export") {
    const sessionId = requireFlag(flags, "session-id");
    const payload = typeof flags.filename === "string" ? { filename: flags.filename } : {};
    const { payload: exported } = await apiClient.requestJson(`/api/deep-research/sessions/${encodeURIComponent(sessionId)}/export`, {
      method: "POST",
      body: payload,
    });
    formatJson(exported);
    return;
  }

  throw new Error(`Unsupported research command: ${command}`);
}

async function handleAuth(command, flags) {
  const action = command || "status";
  const baseUrl = getBaseUrl(flags);
  const sessionManager = createManagedSession(baseUrl);
  await sessionManager.load();

  if (action === "logout") {
    try {
      await ensureServerReady({ appRoot: APP_ROOT, baseUrl });
    } catch {
      // Clear cached CLI state even if the app is offline.
    }
    await sessionManager.revoke();
    console.log("[innoclaw] Logged out.");
    return;
  }

  await ensureServerReady({ appRoot: APP_ROOT, baseUrl });

  if (action === "login") {
    await sessionManager.ensureAuthenticated({ interactive: true });
  } else if (action !== "status") {
    throw new Error("Usage: innoclaw auth <status|login|logout>");
  }

  const status = await sessionManager.getAuthStatus();
  formatJson({
    baseUrl,
    authenticated: status.authenticated,
    user: status.user,
    session: status.session,
    cachedSession: sessionManager.getSession(),
  });
}

async function resolveWorkspaceContext(flags, { interactiveAuth = true } = {}) {
  const baseUrl = getBaseUrl(flags);
  const sessionManager = await createApiContext(baseUrl, { authenticate: true, interactiveAuth });
  const cwd = getWorkspaceCwd(flags);
  const workspace = await ensureWorkspace(
    sessionManager.apiClient,
    cwd,
    getOptionalFlag(flags, "workspace-name") || undefined,
  );
  const authStatus = await sessionManager.getAuthStatus();

  return {
    baseUrl,
    cwd,
    workspace,
    sessionManager,
    apiClient: sessionManager.apiClient,
    authStatus,
  };
}

async function handleInteractive(flags) {
  const context = await resolveWorkspaceContext(flags, { interactiveAuth: true });
  await startRepl(context.apiClient, {
    baseUrl: context.baseUrl,
    workspace: context.workspace,
    cwd: context.cwd,
    session: context.authStatus.authenticated
      ? { user: context.authStatus.user, expiresAt: context.authStatus.session?.expiresAt }
      : context.sessionManager.getSession(),
    skill: getOptionalFlag(flags, "skill"),
    provider: getOptionalFlag(flags, "provider"),
    model: getOptionalFlag(flags, "model"),
    onLogout: async () => {
      await context.sessionManager.revoke();
    },
  });
}

async function handleRun(flags, promptArgs) {
  const prompt = getOptionalFlag(flags, "prompt")
    || promptArgs.join(" ").trim()
    || await readPromptFromStdin();

  if (!prompt) {
    throw new Error("Usage: innoclaw run --prompt <text>");
  }

  const context = await resolveWorkspaceContext(flags, { interactiveAuth: true });
  const skill = getOptionalFlag(flags, "skill");
  const provider = getOptionalFlag(flags, "provider");
  const model = getOptionalFlag(flags, "model");
  const mode = getRunMode(flags);
  const jsonOutput = flags.json === true;
  const renderer = jsonOutput ? null : createRenderer();

  if (!jsonOutput) {
    console.log(`[innoclaw] workspace=${context.workspace.name} cwd=${context.cwd}`);
  }

  const result = await runAgentStream(context.apiClient, {
    messages: [makeUserMessage(prompt)],
    workspaceId: context.workspace.id,
    cwd: context.cwd,
    mode,
    skillId: skill || undefined,
    paramValues: skill ? { user_input: prompt } : undefined,
    llmProvider: provider || undefined,
    llmModel: model || undefined,
    sessionCreatedAt: new Date().toISOString(),
    onSnapshot(message) {
      renderer?.onSnapshot(message);
    },
  });

  renderer?.finish();

  const assistantMessage = [...result.messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const assistantText = assistantMessage ? getMessageText(assistantMessage) : "";

  if (jsonOutput) {
    formatJson({
      workspace: context.workspace,
      cwd: context.cwd,
      provider: result.provider,
      model: result.model,
      assistantText,
    });
    return;
  }

  if (!assistantText.trim()) {
    console.log("[innoclaw] Agent completed without assistant text.");
  }
  console.log("");
}

async function handleBatch(flags, positional) {
  const inputPath = resolve(getOptionalFlag(flags, "input") || positional[0] || "");
  if (!inputPath || inputPath === resolve("")) {
    throw new Error("Usage: innoclaw batch --input <jobs.json>");
  }

  const context = await createApiContext(getBaseUrl(flags), { authenticate: true, interactiveAuth: true });
  const workers = parseIntegerFlag(flags, "workers") || 2;
  const limit = parseIntegerFlag(flags, "limit");
  const batchResult = await runBatch(context.apiClient, {
    inputPath,
    defaultCwd: getWorkspaceCwd(flags),
    defaultSkill: getOptionalFlag(flags, "skill") || undefined,
    defaultProvider: getOptionalFlag(flags, "provider") || undefined,
    defaultModel: getOptionalFlag(flags, "model") || undefined,
    workers,
    startId: getOptionalFlag(flags, "start-id") || undefined,
    ids: parseListFlag(flags, "ids"),
    limit,
    outputDir: getOptionalFlag(flags, "output-dir") || undefined,
    jsonl: flags.jsonl === true,
    failFast: flags["fail-fast"] === true,
  });

  if (flags.json === true) {
    formatJson(batchResult);
    return;
  }

  console.log("[innoclaw] Batch complete.");
  console.log(`runDir:      ${batchResult.runDir}`);
  console.log(`resultsFile: ${batchResult.resultsFile}`);
  console.log(`summaryFile: ${batchResult.summaryFile}`);
  console.log(`done:        ${batchResult.summary.done}/${batchResult.summary.total}`);
}

async function main() {
  const { positional, flags, passthrough } = parseArgs(process.argv.slice(2));
  if (flags.help === true) {
    printHelp();
    return;
  }

  if (positional.length === 0) {
    await handleInteractive(flags);
    return;
  }

  const [group, command] = positional;

  if (group === "doctor") {
    await handleDoctor(flags);
    return;
  }

  if (group === "run") {
    await handleRun(flags, positional.slice(1));
    return;
  }

  if (group === "batch") {
    await handleBatch(flags, positional.slice(1));
    return;
  }

  if (group === "auth") {
    await handleAuth(command, flags);
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
