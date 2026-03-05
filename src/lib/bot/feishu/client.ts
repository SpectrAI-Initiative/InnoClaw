/**
 * Feishu (Lark) bot client.
 *
 * Uses the official @larksuiteoapi/node-sdk for tenant access token
 * management, message sending, and file upload/download.
 *
 * API docs: https://open.feishu.cn/document/server-docs
 */

import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
import * as lark from "@larksuiteoapi/node-sdk";
import {
  type BotAdapter,
  type BotMessage,
  type FileHandler,
  type FeishuBotConfig,
  MAX_FILE_SIZE,
} from "../types";

// ---------------------------------------------------------------------------
// Shared lark.Client cache (keyed by appId to avoid recreating per request)
// ---------------------------------------------------------------------------

const clientCache = new Map<string, lark.Client>();

function getLarkClient(config: FeishuBotConfig): lark.Client {
  let client = clientCache.get(config.appId);
  if (!client) {
    client = new lark.Client({
      appId: config.appId,
      appSecret: config.appSecret,
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Feishu,
    });
    clientCache.set(config.appId, client);
  }
  return client;
}

// ---------------------------------------------------------------------------
// File handler
// ---------------------------------------------------------------------------

function createFeishuFileHandler(client: lark.Client): FileHandler {
  return {
    async downloadFile(
      fileKey: string,
      fileName: string,
      destDir: string
    ): Promise<string> {
      // fileKey is encoded as "image:{imageKey}" or "{messageId}:{fileKey}"
      // by parseMessages to carry the message_id needed for the download.
      let resp: { getReadableStream: () => import("stream").Readable };

      if (fileKey.startsWith("image:")) {
        const imageKey = fileKey.slice(6);
        resp = await client.im.image.get({
          path: { image_key: imageKey },
        });
      } else {
        const sepIdx = fileKey.indexOf(":");
        if (sepIdx === -1) {
          throw new Error(`Invalid Feishu file key format: ${fileKey}`);
        }
        const msgId = fileKey.slice(0, sepIdx);
        const fKey = fileKey.slice(sepIdx + 1);
        resp = await client.im.messageResource.get({
          path: { message_id: msgId, file_key: fKey },
          params: { type: "file" },
        });
      }

      await fsp.mkdir(destDir, { recursive: true });
      const safeName = path.basename(fileName) || `file_${Date.now()}`;
      const destPath = path.join(destDir, safeName);

      // Stream the response and abort early if MAX_FILE_SIZE is exceeded,
      // avoiding writing the full file to disk before the size check.
      let bytesReceived = 0;
      const sizeLimiter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          bytesReceived += chunk.length;
          if (bytesReceived > MAX_FILE_SIZE) {
            callback(
              new Error(
                `File too large: ${bytesReceived} bytes exceeds ${MAX_FILE_SIZE} byte limit`
              )
            );
          } else {
            callback(null, chunk);
          }
        },
      });

      try {
        await pipeline(
          resp.getReadableStream(),
          sizeLimiter,
          fs.createWriteStream(destPath)
        );
      } catch (err) {
        await fsp.unlink(destPath).catch((cleanupErr) => {
          console.warn(`[feishu] Failed to remove partial file ${destPath}:`, cleanupErr);
        });
        throw err;
      }

      console.log(
        `[feishu] Downloaded file: ${destPath} (${bytesReceived} bytes)`
      );
      return destPath;
    },

    async sendFile(
      filePath: string,
      fileName: string,
      chatId: string
    ): Promise<void> {
      // Check file size
      const stat = await fsp.stat(filePath);
      if (stat.size > MAX_FILE_SIZE) {
        throw new Error(
          `File too large: ${stat.size} bytes exceeds ${MAX_FILE_SIZE} byte limit`
        );
      }

      // Step 1: Upload file to get file_key
      const uploadResp = await client.im.file.create({
        data: {
          file_type: "stream",
          file_name: fileName,
          file: fs.createReadStream(filePath),
        },
      });

      const fileKeyValue = uploadResp?.file_key;
      if (!fileKeyValue) {
        throw new Error("Feishu file upload failed: no file_key returned");
      }

      // Step 2: Send file message
      const sendResp = await client.im.message.create({
        params: { receive_id_type: "chat_id" },
        data: {
          receive_id: chatId,
          msg_type: "file",
          content: JSON.stringify({ file_key: fileKeyValue }),
        },
      });

      if (sendResp.code !== 0) {
        throw new Error(`Feishu send file failed: ${sendResp.msg}`);
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
  const client = getLarkClient(config);

  const fileHandler = createFeishuFileHandler(client);

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
        } else if (msgType === "audio") {
          const rawKey = (content.file_key as string) || "";
          messages.push({
            type: "audio",
            messageId,
            senderId,
            chatId,
            isGroup: chatType === "group",
            timestamp,
            duration: Number(content.duration || 0),
            fileKey: `${messageId}:${rawKey}`,
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
      const resp = await client.im.message.create({
        params: { receive_id_type: "chat_id" },
        data: {
          receive_id: chatId,
          msg_type: "text",
          content: JSON.stringify({ text }),
        },
      });

      if (resp.code !== 0) {
        throw new Error(`Feishu send text failed: ${resp.msg}`);
      }

      console.log(`[feishu] Sent text to chat ${chatId}`);
    },

    async sendInteractiveCard(
      chatId: string,
      card: Record<string, unknown>
    ): Promise<string> {
      const resp = await client.im.message.create({
        params: { receive_id_type: "chat_id" },
        data: {
          receive_id: chatId,
          msg_type: "interactive",
          content: JSON.stringify(card),
        },
      });

      if (resp.code !== 0) {
        throw new Error(`Feishu send card failed: ${resp.msg}`);
      }

      const messageId = resp.data?.message_id;
      if (!messageId) {
        throw new Error("Feishu send card failed: missing message_id in response");
      }
      console.log(`[feishu] Sent card to chat ${chatId} (msg: ${messageId})`);
      return messageId;
    },

    async patchInteractiveCard(
      messageId: string,
      card: Record<string, unknown>
    ): Promise<void> {
      const resp = await client.im.message.patch({
        path: { message_id: messageId },
        data: {
          content: JSON.stringify(card),
        },
      });

      if (resp.code !== 0) {
        throw new Error(`Feishu patch card failed: ${resp.msg}`);
      }
    },

    async transcribeAudio(fileKey: string): Promise<string> {
      const destDir = path.join(os.tmpdir(), "notebooklm-bot-audio");
      const localPath = await fileHandler.downloadFile(
        fileKey,
        `audio_${Date.now()}.ogg`,
        destDir
      );

      try {
        const audioBuffer = await fsp.readFile(localPath);
        const base64Audio = audioBuffer.toString("base64");

        const resp = await client.speech_to_text.speech.fileRecognize({
          data: {
            speech: { speech: base64Audio },
            config: {
              file_id: `audio_${Date.now()}`,
              format: "ogg_opus",
              engine_type: "16k_auto",
            },
          },
        });

        if (resp.code !== 0 || !resp.data?.recognition_text) {
          throw new Error(
            `Speech recognition failed: ${resp.msg || "no text returned"}`
          );
        }

        console.log(
          `[feishu] Transcribed audio: "${resp.data.recognition_text.slice(0, 100)}..."`
        );
        return resp.data.recognition_text;
      } finally {
        await fsp.unlink(localPath).catch(() => {});
      }
    },

    fileHandler,
  };
}
