/**
 * Feishu bot slash command handler.
 *
 * Parses and handles commands like /workspace, /status, /clear, /help, /mode
 * sent by users in Feishu chats.
 */

import { validatePath, getWorkspaceRoots } from "@/lib/files/filesystem";
import { buildCommandResponseCard } from "./cards";
import {
  getChatState,
  setChatWorkspace,
  setChatMode,
  clearChatState,
  type AgentMode,
} from "./state";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommandResult {
  handled: boolean;
  card?: Record<string, unknown>;
  text?: string;
}

const NOT_HANDLED: CommandResult = { handled: false };

// ---------------------------------------------------------------------------
// Command implementations
// ---------------------------------------------------------------------------

async function handleWorkspaceCommand(
  chatId: string,
  args: string
): Promise<CommandResult> {
  const workspacePath = args.trim();

  if (!workspacePath) {
    const state = getChatState(chatId);
    if (state.workspacePath) {
      return {
        handled: true,
        card: buildCommandResponseCard(
          "/workspace",
          `Current workspace: \`${state.workspacePath}\``,
          "success"
        ),
      };
    }

    const roots = getWorkspaceRoots();
    return {
      handled: true,
      card: buildCommandResponseCard(
        "/workspace",
        `No workspace bound. Usage: \`/workspace <path>\`\n\nAllowed roots:\n${roots.map((r) => `- \`${r}\``).join("\n")}`,
        "error"
      ),
    };
  }

  try {
    const resolved = validatePath(workspacePath);
    setChatWorkspace(chatId, resolved);
    return {
      handled: true,
      card: buildCommandResponseCard(
        "/workspace",
        `Workspace bound to: \`${resolved}\`\n\nYou can now send messages to use the Agent with full tool access.`,
        "success"
      ),
    };
  } catch (err) {
    const roots = getWorkspaceRoots();
    return {
      handled: true,
      card: buildCommandResponseCard(
        "/workspace",
        `${err instanceof Error ? err.message : "Invalid path"}\n\nAllowed roots:\n${roots.map((r) => `- \`${r}\``).join("\n")}`,
        "error"
      ),
    };
  }
}

async function handleStatusCommand(
  chatId: string
): Promise<CommandResult> {
  const state = getChatState(chatId);
  const lines = [
    `**Chat ID**: \`${chatId}\``,
    `**Workspace**: ${state.workspacePath ? `\`${state.workspacePath}\`` : "Not set"}`,
    `**Mode**: ${state.mode}`,
    `**History**: ${state.conversationHistory.length} messages`,
    `**Processing**: ${state.processingLock ? "Yes (locked)" : "No"}`,
  ];

  return {
    handled: true,
    card: buildCommandResponseCard("/status", lines.join("\n"), "success"),
  };
}

async function handleClearCommand(
  chatId: string
): Promise<CommandResult> {
  clearChatState(chatId);
  return {
    handled: true,
    card: buildCommandResponseCard(
      "/clear",
      "Conversation history cleared. Workspace and mode settings preserved.",
      "success"
    ),
  };
}

async function handleHelpCommand(): Promise<CommandResult> {
  const help = [
    "**Available Commands**",
    "",
    "| Command | Description |",
    "|---------|-------------|",
    "| `/workspace <path>` | Bind a workspace directory |",
    "| `/workspace` | Show current workspace |",
    "| `/mode <agent\\|plan\\|ask>` | Switch agent mode |",
    "| `/status` | Show chat state |",
    "| `/clear` | Clear conversation history |",
    "| `/help` | Show this help |",
    "",
    "**Modes**:",
    "- **agent**: Full tool access (bash, readFile, writeFile, grep, etc.)",
    "- **plan**: Read-only (readFile, listDirectory, grep)",
    "- **ask**: Read-only, answer questions about code",
    "",
    "Send a message without a command prefix to chat with the Agent.",
    "If no workspace is bound, the bot falls back to simple AI chat.",
  ];

  return {
    handled: true,
    card: buildCommandResponseCard("/help", help.join("\n"), "success"),
  };
}

async function handleModeCommand(
  chatId: string,
  args: string
): Promise<CommandResult> {
  const mode = args.trim().toLowerCase();
  const validModes: AgentMode[] = ["agent", "plan", "ask"];

  if (!validModes.includes(mode as AgentMode)) {
    return {
      handled: true,
      card: buildCommandResponseCard(
        "/mode",
        `Invalid mode: \`${mode}\`\n\nValid modes: ${validModes.map((m) => `\`${m}\``).join(", ")}`,
        "error"
      ),
    };
  }

  setChatMode(chatId, mode as AgentMode);
  const descriptions: Record<AgentMode, string> = {
    agent: "Full tool access (bash, readFile, writeFile, grep, etc.)",
    plan: "Read-only (readFile, listDirectory, grep) — analysis and planning",
    ask: "Read-only — answer questions about code",
  };

  return {
    handled: true,
    card: buildCommandResponseCard(
      "/mode",
      `Mode set to **${mode}**: ${descriptions[mode as AgentMode]}`,
      "success"
    ),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse and handle a slash command from a Feishu message.
 * Returns { handled: false } if the text is not a command.
 */
export async function parseAndHandleCommand(
  chatId: string,
  text: string
): Promise<CommandResult> {
  const trimmed = text.trim();

  // Only handle messages starting with /
  if (!trimmed.startsWith("/")) return NOT_HANDLED;

  const spaceIdx = trimmed.indexOf(" ");
  const command = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1);

  switch (command.toLowerCase()) {
    case "/workspace":
      return handleWorkspaceCommand(chatId, args);
    case "/status":
      return handleStatusCommand(chatId);
    case "/clear":
      return handleClearCommand(chatId);
    case "/help":
      return handleHelpCommand();
    case "/mode":
      return handleModeCommand(chatId, args);
    default:
      return NOT_HANDLED;
  }
}
