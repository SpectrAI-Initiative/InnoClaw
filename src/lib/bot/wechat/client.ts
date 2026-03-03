/**
 * WeChat (Enterprise WeChat / 企业微信) bot client.
 *
 * Handles access token management, message sending, and file (media)
 * upload/download through the Enterprise WeChat API.
 *
 * API docs: https://developer.work.weixin.qq.com/document/
 */

import crypto from "crypto";
import fsp from "fs/promises";
import path from "path";
import {
  type BotAdapter,
  type BotMessage,
  type FileHandler,
  type WechatBotConfig,
  MAX_FILE_SIZE,
  readResponseWithLimit,
} from "../types";

const WECHAT_API_BASE = "https://qyapi.weixin.qq.com/cgi-bin";

// ---------------------------------------------------------------------------
// Access token cache (keyed by corpId to support multiple instances)
// ---------------------------------------------------------------------------

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Obtain an access_token for Enterprise WeChat. Caches per corpId and refreshes automatically.
 */
async function getAccessToken(config: WechatBotConfig): Promise<string> {
  const cached = tokenCache.get(config.corpId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const url = `${WECHAT_API_BASE}/gettoken?corpid=${encodeURIComponent(config.corpId)}&corpsecret=${encodeURIComponent(config.corpSecret)}`;

  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `WeChat token request failed: ${res.status} ${res.statusText} — ${text}`
    );
  }

  const data = (await res.json()) as {
    errcode: number;
    errmsg: string;
    access_token: string;
    expires_in: number;
  };

  if (data.errcode !== 0) {
    throw new Error(`WeChat token error: ${data.errmsg}`);
  }

  tokenCache.set(config.corpId, {
    token: data.access_token,
    // Refresh 60s before expiry
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  });

  return data.access_token;
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

/**
 * Verify the Enterprise WeChat callback signature.
 *
 * Plaintext mode:  signature = SHA1(sort(token, timestamp, nonce))
 * Encrypted mode:  msg_signature = SHA1(sort(token, timestamp, nonce, encrypt))
 *
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param extraData  Optional encrypted payload (echostr or <Encrypt> value)
 *                   to include in the hash when using msg_signature.
 */
function verifySignature(
  token: string,
  timestamp: string,
  nonce: string,
  signature: string,
  extraData?: string
): boolean {
  const parts = [token, timestamp, nonce];
  if (extraData) parts.push(extraData);
  parts.sort();

  const computed = crypto
    .createHash("sha1")
    .update(parts.join(""))
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, "utf-8"),
      Buffer.from(signature, "utf-8")
    );
  } catch {
    // timingSafeEqual throws if lengths differ
    return false;
  }
}

// ---------------------------------------------------------------------------
// File handler
// ---------------------------------------------------------------------------

function createWechatFileHandler(config: WechatBotConfig): FileHandler {
  return {
    async downloadFile(
      mediaId: string,
      fileName: string,
      destDir: string
    ): Promise<string> {
      const token = await getAccessToken(config);

      const res = await fetch(
        `${WECHAT_API_BASE}/media/get?access_token=${encodeURIComponent(token)}&media_id=${encodeURIComponent(mediaId)}`
      );

      if (!res.ok) {
        throw new Error(
          `WeChat file download failed: ${res.status} ${res.statusText}`
        );
      }

      // Stream the response and enforce MAX_FILE_SIZE
      const buffer = await readResponseWithLimit(res, MAX_FILE_SIZE);

      await fsp.mkdir(destDir, { recursive: true });
      const safeName = path.basename(fileName) || `file_${Date.now()}`;
      const destPath = path.join(destDir, safeName);
      await fsp.writeFile(destPath, buffer);

      console.log(
        `[wechat] Downloaded file: ${destPath} (${buffer.length} bytes)`
      );
      return destPath;
    },

    async sendFile(
      filePath: string,
      fileName: string,
      chatId: string
    ): Promise<void> {
      const accessToken = await getAccessToken(config);

      // Check file size
      const stat = await fsp.stat(filePath);
      if (stat.size > MAX_FILE_SIZE) {
        throw new Error(
          `File too large: ${stat.size} bytes exceeds ${MAX_FILE_SIZE} byte limit`
        );
      }

      // Step 1: Upload media to get media_id
      const fileBuffer = await fsp.readFile(filePath);
      const formData = new FormData();
      formData.append("media", new Blob([fileBuffer]), fileName);

      const uploadRes = await fetch(
        `${WECHAT_API_BASE}/media/upload?access_token=${encodeURIComponent(accessToken)}&type=file`,
        {
          method: "POST",
          body: formData,
        }
      );

      const uploadData = (await uploadRes.json()) as {
        errcode: number;
        errmsg: string;
        media_id: string;
      };

      if (uploadData.errcode !== 0) {
        throw new Error(`WeChat file upload failed: ${uploadData.errmsg}`);
      }

      // Step 2: Send file message
      const sendRes = await fetch(
        `${WECHAT_API_BASE}/message/send?access_token=${encodeURIComponent(accessToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            touser: chatId,
            msgtype: "file",
            agentid: Number(config.agentId),
            file: { media_id: uploadData.media_id },
          }),
        }
      );

      const sendData = (await sendRes.json()) as {
        errcode: number;
        errmsg: string;
      };

      if (sendData.errcode !== 0) {
        throw new Error(`WeChat send file failed: ${sendData.errmsg}`);
      }

      console.log(`[wechat] Sent file "${fileName}" to user ${chatId}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Create a WeChat (Enterprise WeChat) bot adapter instance.
 */
export function createWechatAdapter(config: WechatBotConfig): BotAdapter {
  const fileHandler = createWechatFileHandler(config);

  return {
    platform: "wechat",

    isEnabled(): boolean {
      return (
        config.enabled &&
        !!config.corpId &&
        !!config.corpSecret &&
        !!config.token &&
        !!config.encodingAESKey &&
        !!config.agentId &&
        !isNaN(Number(config.agentId))
      );
    },

    verifyWebhook(
      headers: Record<string, string>,
      body: string
    ): boolean {
      const msgSignature = headers["msg_signature"] || "";
      const signature = headers["signature"] || "";
      const timestamp = headers["timestamp"] || "";
      const nonce = headers["nonce"] || "";

      if (!timestamp || !nonce) return false;

      // msg_signature: encrypted mode — include body (encrypt data) in hash
      if (msgSignature) {
        return verifySignature(
          config.token, timestamp, nonce, msgSignature, body
        );
      }
      // signature: plaintext mode — token + timestamp + nonce only
      if (signature) {
        return verifySignature(config.token, timestamp, nonce, signature);
      }

      return false;
    },

    parseMessages(body: Record<string, unknown>): BotMessage[] {
      const messages: BotMessage[] = [];

      // Enterprise WeChat callback JSON schema
      const msgType = body.MsgType as string | undefined;
      const fromUser = (body.FromUserName as string) || "";
      const msgId = String(body.MsgId || "");
      const createTime = (body.CreateTime as number) || 0;
      const timestamp = createTime
        ? new Date(createTime * 1000).toISOString()
        : new Date().toISOString();
      const agentId = String(body.AgentID || "");

      if (msgType === "text") {
        messages.push({
          type: "text",
          messageId: msgId,
          text: (body.Content as string) || "",
          senderId: fromUser,
          chatId: fromUser, // For enterprise WeChat, reply to the user
          isGroup: false,
          timestamp,
        });
      } else if (msgType === "file" || msgType === "image" || msgType === "voice") {
        messages.push({
          type: "file",
          messageId: msgId,
          senderId: fromUser,
          chatId: fromUser,
          isGroup: false,
          timestamp,
          fileName:
            (body.FileName as string) ||
            `${msgType}_${msgId}`,
          fileType: msgType,
          fileSize: Number(body.FileSize || 0),
          fileKey: (body.MediaId as string) || "",
        });
      }

      // Ignore other event types (e.g., event subscriptions) silently
      if (messages.length > 0) {
        console.log(
          `[wechat] Parsed ${messages.length} message(s) from user=${fromUser} agent=${agentId}`
        );
      }

      return messages;
    },

    async sendText(chatId: string, text: string): Promise<void> {
      const token = await getAccessToken(config);

      const res = await fetch(
        `${WECHAT_API_BASE}/message/send?access_token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            touser: chatId,
            msgtype: "text",
            agentid: Number(config.agentId),
            text: { content: text },
          }),
        }
      );

      const data = (await res.json()) as { errcode: number; errmsg: string };
      if (data.errcode !== 0) {
        throw new Error(`WeChat send text failed: ${data.errmsg}`);
      }

      console.log(`[wechat] Sent text to user ${chatId}`);
    },

    fileHandler,
  };
}
