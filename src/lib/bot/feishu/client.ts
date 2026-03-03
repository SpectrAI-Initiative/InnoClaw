/**
 * Feishu (Lark) bot client.
 *
 * Handles tenant access token management, message sending, and file
 * upload/download through the Feishu Open API.
 *
 * API docs: https://open.feishu.cn/document/server-docs
 */

import fsp from "fs/promises";
import path from "path";
import {
  type BotAdapter,
  type BotMessage,
  type FileHandler,
  type FeishuBotConfig,
  MAX_FILE_SIZE,
  readResponseWithLimit,
} from "../types";

const FEISHU_API_BASE = "https://open.feishu.cn/open-apis";

// ---------------------------------------------------------------------------
// Tenant access token cache (keyed by appId to support multiple instances)
// ---------------------------------------------------------------------------

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Obtain a tenant_access_token. Caches per appId and refreshes automatically.
 */
async function getTenantAccessToken(config: FeishuBotConfig): Promise<string> {
  const cached = tokenCache.get(config.appId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const res = await fetch(
    `${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: config.appId,
        app_secret: config.appSecret,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Feishu token request failed: ${res.status} ${res.statusText} — ${text}`
    );
  }

  const data = (await res.json()) as {
    code: number;
    msg: string;
    tenant_access_token: string;
    expire: number;
  };

  if (data.code !== 0) {
    throw new Error(`Feishu token error: ${data.msg}`);
  }

  tokenCache.set(config.appId, {
    token: data.tenant_access_token,
    // Refresh 60s before expiry
    expiresAt: Date.now() + (data.expire - 60) * 1000,
  });

  return data.tenant_access_token;
}

// ---------------------------------------------------------------------------
// File handler
// ---------------------------------------------------------------------------

function createFeishuFileHandler(config: FeishuBotConfig): FileHandler {
  return {
    async downloadFile(
      fileKey: string,
      fileName: string,
      destDir: string
    ): Promise<string> {
      const token = await getTenantAccessToken(config);

      // fileKey is encoded as "image:{imageKey}" or "{messageId}:{fileKey}"
      // by parseMessages to carry the message_id needed for the download URL.
      let downloadUrl: string;
      if (fileKey.startsWith("image:")) {
        const imageKey = fileKey.slice(6);
        downloadUrl = `${FEISHU_API_BASE}/im/v1/images/${imageKey}`;
      } else {
        const sepIdx = fileKey.indexOf(":");
        if (sepIdx === -1) {
          throw new Error(`Invalid Feishu file key format: ${fileKey}`);
        }
        const msgId = fileKey.slice(0, sepIdx);
        const fKey = fileKey.slice(sepIdx + 1);
        downloadUrl = `${FEISHU_API_BASE}/im/v1/messages/${msgId}/resources/${fKey}?type=file`;
      }

      const res = await fetch(downloadUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(
          `Feishu file download failed: ${res.status} ${res.statusText}`
        );
      }

      // Stream the response and enforce MAX_FILE_SIZE
      const buffer = await readResponseWithLimit(res, MAX_FILE_SIZE);

      await fsp.mkdir(destDir, { recursive: true });
      const safeName = path.basename(fileName) || `file_${Date.now()}`;
      const destPath = path.join(destDir, safeName);
      await fsp.writeFile(destPath, buffer);

      console.log(
        `[feishu] Downloaded file: ${destPath} (${buffer.length} bytes)`
      );
      return destPath;
    },

    async sendFile(
      filePath: string,
      fileName: string,
      chatId: string
    ): Promise<void> {
      const token = await getTenantAccessToken(config);

      // Check file size
      const stat = await fsp.stat(filePath);
      if (stat.size > MAX_FILE_SIZE) {
        throw new Error(
          `File too large: ${stat.size} bytes exceeds ${MAX_FILE_SIZE} byte limit`
        );
      }

      // Step 1: Upload file to get file_key
      const formData = new FormData();
      const fileBuffer = await fsp.readFile(filePath);
      formData.append("file", new Blob([fileBuffer]), fileName);
      formData.append("file_type", "stream");
      formData.append("file_name", fileName);

      const uploadRes = await fetch(
        `${FEISHU_API_BASE}/im/v1/files`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      const uploadData = (await uploadRes.json()) as {
        code: number;
        msg: string;
        data: { file_key: string };
      };

      if (uploadData.code !== 0) {
        throw new Error(`Feishu file upload failed: ${uploadData.msg}`);
      }

      // Step 2: Send file message
      const sendRes = await fetch(
        `${FEISHU_API_BASE}/im/v1/messages?receive_id_type=chat_id`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receive_id: chatId,
            msg_type: "file",
            content: JSON.stringify({ file_key: uploadData.data.file_key }),
          }),
        }
      );

      const sendData = (await sendRes.json()) as { code: number; msg: string };
      if (sendData.code !== 0) {
        throw new Error(`Feishu send file failed: ${sendData.msg}`);
      }

      console.log(`[feishu] Sent file "${fileName}" to chat ${chatId}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Create a Feishu bot adapter instance.
 */
export function createFeishuAdapter(config: FeishuBotConfig): BotAdapter {
  const fileHandler = createFeishuFileHandler(config);

  return {
    platform: "feishu",

    isEnabled(): boolean {
      return (
        config.enabled &&
        !!config.appId &&
        !!config.appSecret &&
        !!config.verificationToken
      );
    },

    verifyWebhook(_headers: Record<string, string>, body: string): boolean {
      // Feishu uses a verification token embedded in the JSON body
      // (header.token for event callback v2, or top-level token for v1).
      try {
        const parsed = JSON.parse(body);
        const token =
          (parsed?.header as Record<string, unknown>)?.token ??
          parsed?.token ??
          "";
        return token === config.verificationToken;
      } catch {
        return false;
      }
    },

    parseMessages(body: Record<string, unknown>): BotMessage[] {
      const messages: BotMessage[] = [];

      // Feishu event callback v2 schema
      const header = body.header as
        | { event_type: string; token: string }
        | undefined;
      const event = body.event as Record<string, unknown> | undefined;

      if (!header || !event) {
        return messages;
      }

      // Verify token
      if (header.token !== config.verificationToken) {
        console.warn("[feishu] Invalid verification token");
        return messages;
      }

      if (header.event_type === "im.message.receive_v1") {
        const message = event.message as Record<string, unknown> | undefined;
        const sender = event.sender as Record<string, unknown> | undefined;

        if (!message || !sender) return messages;

        const senderId =
          ((sender.sender_id as Record<string, string>)?.open_id) || "";
        const chatId = (message.chat_id as string) || "";
        const messageId = (message.message_id as string) || "";
        const chatType = (message.chat_type as string) || "";
        const msgType = (message.message_type as string) || "";
        const timestamp = new Date().toISOString();

        let content: Record<string, unknown> = {};
        try {
          content = JSON.parse((message.content as string) || "{}");
        } catch {
          console.warn("[feishu] Failed to parse message content JSON");
          return messages;
        }

        if (msgType === "text") {
          messages.push({
            type: "text",
            messageId,
            text: (content.text as string) || "",
            senderId,
            chatId,
            isGroup: chatType === "group",
            timestamp,
          });
        } else if (msgType === "file" || msgType === "image") {
          // Encode messageId into fileKey so downloadFile can build the
          // correct Feishu API URL (files need message_id + file_key;
          // images just need image_key).
          const rawKey =
            (content.file_key as string) || (content.image_key as string) || "";
          const encodedKey =
            msgType === "image" ? `image:${rawKey}` : `${messageId}:${rawKey}`;

          messages.push({
            type: "file",
            messageId,
            senderId,
            chatId,
            isGroup: chatType === "group",
            timestamp,
            fileName: (content.file_name as string) || `file_${messageId}`,
            fileType: msgType,
            fileSize: Number(content.file_size || 0),
            fileKey: encodedKey,
          });
        }
      }

      return messages;
    },

    async sendText(chatId: string, text: string): Promise<void> {
      const token = await getTenantAccessToken(config);

      const res = await fetch(
        `${FEISHU_API_BASE}/im/v1/messages?receive_id_type=chat_id`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receive_id: chatId,
            msg_type: "text",
            content: JSON.stringify({ text }),
          }),
        }
      );

      const data = (await res.json()) as { code: number; msg: string };
      if (data.code !== 0) {
        throw new Error(`Feishu send text failed: ${data.msg}`);
      }

      console.log(`[feishu] Sent text to chat ${chatId}`);
    },

    fileHandler,
  };
}
