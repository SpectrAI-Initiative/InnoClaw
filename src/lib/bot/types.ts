/**
 * Unified bot adapter interfaces for IM platform integrations.
 *
 * Implements the adapter pattern so that Feishu, WeChat, and future
 * IM platforms share a common contract. The Agent core layer only
 * interacts with these interfaces, keeping platform specifics decoupled.
 */

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

/** Represents a text message received from an IM platform. */
export interface BotTextMessage {
  type: "text";
  /** Platform-specific message ID */
  messageId: string;
  /** Text content of the message */
  text: string;
  /** Sender identifier (user ID on the platform) */
  senderId: string;
  /** Chat / conversation identifier (group or direct) */
  chatId: string;
  /** Whether this message is from a group chat */
  isGroup: boolean;
  /** ISO-8601 timestamp */
  timestamp: string;
}

/** Represents a file message received from an IM platform. */
export interface BotFileMessage {
  type: "file";
  messageId: string;
  senderId: string;
  chatId: string;
  isGroup: boolean;
  timestamp: string;
  /** Original file name */
  fileName: string;
  /** MIME type or platform-specific file type */
  fileType: string;
  /** File size in bytes */
  fileSize: number;
  /** Platform-specific key used to download the file (e.g. file_key, media_id) */
  fileKey: string;
  /** Optional accompanying text */
  text?: string;
}

export type BotMessage = BotTextMessage | BotFileMessage;

// ---------------------------------------------------------------------------
// Reply types
// ---------------------------------------------------------------------------

export interface BotTextReply {
  type: "text";
  text: string;
}

export interface BotFileReply {
  type: "file";
  /** Absolute path to the local file to send */
  filePath: string;
  /** File name for the recipient */
  fileName: string;
}

export type BotReply = BotTextReply | BotFileReply;

// ---------------------------------------------------------------------------
// File handler interface
// ---------------------------------------------------------------------------

/** Maximum file size allowed for download/upload (100 MB). */
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * Read a fetch Response body with a streaming size limit.
 * Aborts early if the received bytes exceed `maxBytes`, avoiding
 * unbounded memory usage when content-length is absent or incorrect.
 */
export async function readResponseWithLimit(
  res: Response,
  maxBytes: number
): Promise<Buffer> {
  // Quick reject via content-length header (if present)
  const contentLength = Number(res.headers.get("content-length") || "0");
  if (contentLength > maxBytes) {
    throw new Error(
      `File too large: ${contentLength} bytes exceeds ${maxBytes} byte limit`
    );
  }

  const body = res.body;
  if (!body) {
    throw new Error("Response body is empty");
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      received += value.byteLength;
      if (received > maxBytes) {
        throw new Error(
          `File too large: received ${received} bytes exceeds ${maxBytes} byte limit`
        );
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Ignore — lock may already be released
    }
  }

  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

/**
 * Platform-specific file operations.
 * Each IM adapter implements this interface to handle file download/upload
 * through the platform's own APIs.
 */
export interface FileHandler {
  /**
   * Download a file from the IM platform to a local directory.
   * @param fileKey   Platform-specific file identifier
   * @param fileName  Original file name
   * @param destDir   Local directory to save the file
   * @returns Absolute path of the downloaded file
   */
  downloadFile(fileKey: string, fileName: string, destDir: string): Promise<string>;

  /**
   * Upload a local file and send it to the specified chat.
   * @param filePath  Absolute path of the local file to send
   * @param fileName  File name for the recipient
   * @param chatId    Target chat / conversation ID
   */
  sendFile(filePath: string, fileName: string, chatId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Bot adapter interface
// ---------------------------------------------------------------------------

/**
 * Unified bot adapter that each IM platform must implement.
 * Provides text messaging, file handling, and webhook verification.
 */
export interface BotAdapter {
  /** Human-readable platform name */
  readonly platform: string;

  /** Whether this adapter is properly configured and enabled */
  isEnabled(): boolean;

  /** Verify the authenticity of an incoming webhook request */
  verifyWebhook(headers: Record<string, string>, body: string): boolean;

  /** Parse raw webhook payload into standardised BotMessage(s) */
  parseMessages(body: Record<string, unknown>): BotMessage[];

  /** Send a text reply to the specified chat */
  sendText(chatId: string, text: string): Promise<void>;

  /** Send an interactive card to the specified chat. Returns message_id. */
  sendInteractiveCard?(chatId: string, card: Record<string, unknown>): Promise<string>;

  /** Update an existing interactive card message. */
  patchInteractiveCard?(messageId: string, card: Record<string, unknown>): Promise<void>;

  /** File handler for download / upload operations */
  fileHandler: FileHandler;
}

// ---------------------------------------------------------------------------
// Bot configuration types
// ---------------------------------------------------------------------------

export interface FeishuBotConfig {
  appId: string;
  appSecret: string;
  verificationToken: string;
  /** Optional: encrypt key for event subscription */
  encryptKey?: string;
  /** Whether the bot is enabled */
  enabled: boolean;
}

export interface WechatBotConfig {
  corpId: string;
  corpSecret: string;
  token: string;
  encodingAESKey: string;
  /** Agent ID for enterprise WeChat */
  agentId: string;
  /** Whether the bot is enabled */
  enabled: boolean;
}

/**
 * Read Feishu bot configuration from environment variables.
 */
export function getFeishuConfig(): FeishuBotConfig {
  return {
    appId: process.env.FEISHU_APP_ID || "",
    appSecret: process.env.FEISHU_APP_SECRET || "",
    verificationToken: process.env.FEISHU_VERIFICATION_TOKEN || "",
    encryptKey: process.env.FEISHU_ENCRYPT_KEY || "",
    enabled: process.env.FEISHU_BOT_ENABLED === "true",
  };
}

/**
 * Read WeChat bot configuration from environment variables.
 */
export function getWechatConfig(): WechatBotConfig {
  return {
    corpId: process.env.WECHAT_CORP_ID || "",
    corpSecret: process.env.WECHAT_CORP_SECRET || "",
    token: process.env.WECHAT_TOKEN || "",
    encodingAESKey: process.env.WECHAT_ENCODING_AES_KEY || "",
    agentId: process.env.WECHAT_AGENT_ID || "",
    enabled: process.env.WECHAT_BOT_ENABLED === "true",
  };
}
