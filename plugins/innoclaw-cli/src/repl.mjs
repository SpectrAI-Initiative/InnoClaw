import readline from "node:readline/promises";
import process from "node:process";
import {
  makeUserMessage,
  runAgentStream,
  getMessageText,
  getToolName,
  summarizeToolInput,
} from "./agent-client.mjs";
import {
  getModelSettings,
  parseModelCommandArgs,
  setModelSettings,
} from "./model-client.mjs";

function printDivider() {
  console.log("=".repeat(72));
}

function printHeader({ baseUrl, workspace, cwd, session, provider, model, skill }) {
  printDivider();
  console.log("InnoClaw CLI");
  console.log(`workspace: ${workspace.name} (${workspace.id})`);
  console.log(`cwd:       ${cwd}`);
  console.log(`server:    ${baseUrl}`);
  console.log(`auth:      ${session?.user?.email || "AUTH_MODE=disabled"}`);
  console.log(`mode:      agent${skill ? ` | skill=${skill}` : ""}`);
  if (provider || model) {
    console.log(`model:     ${provider || "default"} / ${model || "default"}`);
  }
  printDivider();
  console.log("Commands: /help /clear /workspace /model /logout /exit");
  console.log("");
}

function summarizeToolState(part) {
  if (part.state === "output-error") {
    return "error";
  }
  if (part.state === "output-available") {
    return "done";
  }
  return "running";
}

export function createRenderer() {
  let activeText = "";
  const toolStates = new Map();

  function flushText() {
    if (activeText.length > 0) {
      process.stdout.write("\n");
      activeText = "";
    }
  }

  return {
    onSnapshot(message) {
      if (message.role !== "assistant") {
        return;
      }

      const nextText = getMessageText(message);
      const delta = nextText.slice(activeText.length);
      if (delta) {
        if (activeText.length === 0) {
          process.stdout.write("assistant> ");
        }
        process.stdout.write(delta);
        activeText = nextText;
      }

      for (const part of message.parts || []) {
        if (!(part.type?.startsWith("tool-") || part.type === "dynamic-tool")) {
          continue;
        }
        const toolName = getToolName(part);
        const stateKey = `${part.toolCallId}:${part.state}`;
        if (toolStates.has(stateKey)) {
          continue;
        }
        toolStates.set(stateKey, true);
        flushText();
        console.log(
          `[tool:${toolName}] ${summarizeToolState(part)} ${summarizeToolInput(toolName, part.input)}`.trim(),
        );
        if (part.state === "output-error" && part.errorText) {
          console.log(`  error: ${part.errorText}`);
        }
      }
    },
    finish() {
      flushText();
    },
  };
}

export async function startRepl(apiClient, {
  baseUrl,
  workspace,
  cwd,
  session,
  skill = null,
  provider = null,
  model = null,
  onLogout,
} = {}) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let messages = [];
  let sessionState = session;
  let activeProvider = provider;
  let activeModel = model;

  try {
    const current = await getModelSettings(apiClient);
    activeProvider = activeProvider || current.provider;
    activeModel = activeModel || current.model;
  } catch {
    // Keep the passed-in overrides if settings are unavailable.
  }

  printHeader({
    baseUrl,
    workspace,
    cwd,
    session: sessionState,
    provider: activeProvider,
    model: activeModel,
    skill,
  });

  try {
    while (true) {
      const input = (await rl.question("> ")).trim();
      if (!input) {
        continue;
      }

      if (input === "/exit" || input === "/quit") {
        break;
      }
      if (input === "/help") {
        console.log("Commands:");
        console.log("  /help       Show CLI commands");
        console.log("  /clear      Clear local conversation history");
        console.log("  /workspace  Show current workspace information");
        console.log("  /logout     Clear CLI session and stop this REPL");
        console.log("  /exit       Exit InnoClaw CLI");
        continue;
      }
      if (input === "/clear") {
        messages = [];
        console.log("[innoclaw] Conversation cleared.");
        continue;
      }
      if (input === "/workspace") {
        console.log(JSON.stringify(workspace, null, 2));
        continue;
      }
      if (input.startsWith("/model")) {
        try {
          const args = input
            .slice("/model".length)
            .trim()
            .split(/\s+/)
            .filter(Boolean);
          const command = parseModelCommandArgs(args, activeProvider || "openai");

          if (command.action === "show") {
            const current = await getModelSettings(apiClient);
            activeProvider = current.provider;
            activeModel = current.model;
            console.log(JSON.stringify(current, null, 2));
            continue;
          }

          const next = await setModelSettings(apiClient, {
            provider: command.provider,
            model: command.model,
          });
          activeProvider = next.provider;
          activeModel = next.model;
          console.log(`[innoclaw] Model set to ${next.provider} / ${next.model}`);
        } catch (error) {
          console.log(`[innoclaw] ${error instanceof Error ? error.message : String(error)}`);
        }
        continue;
      }
      if (input === "/logout") {
        await onLogout?.();
        console.log("[innoclaw] Logged out.");
        break;
      }

      messages = [...messages, makeUserMessage(input)];
      const renderer = createRenderer();
      const result = await runAgentStream(apiClient, {
        messages,
        workspaceId: workspace.id,
        cwd,
        mode: "agent",
        skillId: skill,
        paramValues: skill ? { user_input: input } : undefined,
        llmProvider: activeProvider,
        llmModel: activeModel,
        onHeaders(headers) {
          if (headers.provider || headers.model) {
            sessionState = sessionState;
          }
        },
        onSnapshot(message) {
          renderer.onSnapshot(message);
        },
      });
      renderer.finish();
      messages = result.messages;
      const lastAssistantMessage = [...messages]
        .reverse()
        .find((message) => message.role === "assistant");
      if (!lastAssistantMessage || !getMessageText(lastAssistantMessage).trim()) {
        console.log("[innoclaw] No assistant output. Check the server logs or current model configuration.");
      }
      console.log("");
    }
  } finally {
    rl.close();
  }
}
