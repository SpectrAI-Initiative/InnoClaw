import path from "node:path";
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { ensureWorkspace } from "./workspace-client.mjs";
import { getMessageText, makeUserMessage, runAgentStream } from "./agent-client.mjs";

const VALID_RUN_MODES = new Set(["agent", "ask", "plan", "long-agent"]);

function timestampForPath() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function normalizeBatchEntries(entries) {
  if (!Array.isArray(entries)) {
    throw new Error("Batch input must be a JSON array");
  }
  return entries.map((entry, index) => {
    const prompt = entry?.prompt ?? entry?.requirement ?? entry?.text;
    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      throw new Error(`Batch item ${index + 1} is missing a non-empty prompt`);
    }
    const mode = entry?.mode;
    if (mode !== undefined && (!VALID_RUN_MODES.has(mode))) {
      throw new Error(`Batch item ${index + 1} has unsupported mode: ${mode}`);
    }
    return {
      id: typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : `item-${index + 1}`,
      prompt: prompt.trim(),
      mode: typeof mode === "string" ? mode : null,
      skill: typeof entry.skill === "string" ? entry.skill : null,
      cwd: entry.cwd || entry.workspace || null,
      provider: typeof entry.provider === "string" ? entry.provider : null,
      model: typeof entry.model === "string" ? entry.model : null,
      params: entry.params && typeof entry.params === "object" ? entry.params : null,
    };
  });
}

async function readBatchInput(inputPath) {
  const raw = await readFile(inputPath, "utf-8");
  return normalizeBatchEntries(JSON.parse(raw));
}

async function appendEvent(logFile, line) {
  await appendFile(logFile, `${line}\n`, "utf-8");
}

export async function runBatch(apiClient, {
  inputPath,
  defaultCwd,
  defaultSkill = null,
  defaultProvider = null,
  defaultModel = null,
  defaultMode = "agent",
  workers = 2,
  startId = null,
  ids = [],
  limit = null,
  outputDir = null,
  jsonl = false,
  failFast = false,
} = {}) {
  if (!VALID_RUN_MODES.has(defaultMode)) {
    throw new Error(`Unsupported default mode: ${defaultMode}`);
  }

  const allEntries = await readBatchInput(inputPath);
  let entries = allEntries;

  if (Array.isArray(ids) && ids.length > 0) {
    const idSet = new Set(ids);
    entries = entries.filter((entry) => idSet.has(entry.id));
  } else if (startId) {
    const startIndex = entries.findIndex((entry) => entry.id === startId);
    if (startIndex === -1) {
      throw new Error(`start-id not found: ${startId}`);
    }
    entries = entries.slice(startIndex);
  }

  if (typeof limit === "number" && Number.isFinite(limit)) {
    entries = entries.slice(0, limit);
  }

  const runDir = outputDir
    ? path.resolve(outputDir)
    : path.join(path.resolve(defaultCwd), ".innoclaw", "runs", timestampForPath());
  await mkdir(runDir, { recursive: true });

  const resultsFile = path.join(runDir, "results.json");
  const summaryFile = path.join(runDir, "summary.json");
  const eventsFile = path.join(runDir, "events.log");
  const jsonlFile = path.join(runDir, "results.jsonl");

  const results = [];
  const workspaceCache = new Map();
  let nextIndex = 0;
  let stopDispatch = false;

  async function resolveWorkspace(folderPath) {
    const resolved = path.resolve(folderPath);
    if (workspaceCache.has(resolved)) {
      return workspaceCache.get(resolved);
    }
    const workspace = await ensureWorkspace(apiClient, resolved);
    workspaceCache.set(resolved, workspace);
    return workspace;
  }

  async function runEntry(entry) {
    const cwd = path.resolve(entry.cwd || defaultCwd);
    const skill = entry.skill || defaultSkill;
    const provider = entry.provider || defaultProvider;
    const model = entry.model || defaultModel;
    const mode = entry.mode || defaultMode;
    const workspace = await resolveWorkspace(cwd);

    const startedAt = new Date().toISOString();
    const timer = performance.now();
    await appendEvent(eventsFile, `[START] ${entry.id} ${startedAt}`);
    console.log(`[START] ${entry.id}`);

    try {
      const agentResult = await runAgentStream(apiClient, {
        messages: [makeUserMessage(entry.prompt)],
        workspaceId: workspace.id,
        cwd,
        mode,
        skillId: skill,
        paramValues: skill
          ? { user_input: entry.prompt, ...(entry.params || {}) }
          : entry.params || undefined,
        llmProvider: provider,
        llmModel: model,
      });
      const assistantMessage = [...agentResult.messages]
        .reverse()
        .find((message) => message.role === "assistant");
      const assistantText = assistantMessage ? getMessageText(assistantMessage) : "";

      const completedAt = new Date().toISOString();
      const result = {
        id: entry.id,
        status: "done",
        workspaceId: workspace.id,
        cwd,
        mode,
        skill,
        provider,
        model,
        startedAt,
        completedAt,
        elapsedMs: Math.round(performance.now() - timer),
        assistantText,
        error: null,
      };
      await appendEvent(eventsFile, `[DONE] ${entry.id} ${completedAt}`);
      if (jsonl) {
        await appendFile(jsonlFile, `${JSON.stringify(result)}\n`, "utf-8");
      }
      console.log(`[DONE] ${entry.id} (${result.elapsedMs}ms)`);
      return result;
    } catch (error) {
      const completedAt = new Date().toISOString();
      const result = {
        id: entry.id,
        status: "error",
        workspaceId: workspace.id,
        cwd,
        mode,
        skill,
        provider,
        model,
        startedAt,
        completedAt,
        elapsedMs: Math.round(performance.now() - timer),
        assistantText: "",
        error: error instanceof Error ? error.message : String(error),
      };
      await appendEvent(eventsFile, `[ERROR] ${entry.id} ${completedAt} ${result.error}`);
      if (jsonl) {
        await appendFile(jsonlFile, `${JSON.stringify(result)}\n`, "utf-8");
      }
      console.log(`[ERROR] ${entry.id}: ${result.error}`);
      return result;
    }
  }

  async function worker() {
    while (true) {
      if (stopDispatch) {
        return;
      }
      const index = nextIndex;
      nextIndex += 1;
      if (index >= entries.length) {
        return;
      }

      const result = await runEntry(entries[index]);
      results.push(result);
      if (failFast && result.status !== "done") {
        stopDispatch = true;
      }
    }
  }

  const concurrency = Math.max(1, Math.min(workers, entries.length || 1));
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  results.sort((left, right) => left.id.localeCompare(right.id));
  const summary = {
    total: results.length,
    done: results.filter((result) => result.status === "done").length,
    failed: results.filter((result) => result.status !== "done").length,
    inputPath: path.resolve(inputPath),
    runDir,
  };

  await writeFile(resultsFile, JSON.stringify(results, null, 2), "utf-8");
  await writeFile(summaryFile, JSON.stringify(summary, null, 2), "utf-8");

  return {
    results,
    summary,
    runDir,
    resultsFile,
    summaryFile,
  };
}
