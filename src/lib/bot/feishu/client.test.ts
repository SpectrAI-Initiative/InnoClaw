/**
 * Unit tests for Feishu bot adapter.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FeishuBotConfig } from "../types";

// ---------------------------------------------------------------------------
// Mock the SDK before importing the adapter
// ---------------------------------------------------------------------------

const mockMessageCreate = vi.fn();
const mockMessagePatch = vi.fn();
const mockFileCreate = vi.fn();
const mockImageGet = vi.fn();
const mockMessageResourceGet = vi.fn();

vi.mock("@larksuiteoapi/node-sdk", () => ({
  AppType: { SelfBuild: 0 },
  Domain: { Feishu: 0 },
  Client: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.im = {
      message: { create: mockMessageCreate, patch: mockMessagePatch },
      file: { create: mockFileCreate },
      image: { get: mockImageGet },
      messageResource: { get: mockMessageResourceGet },
    };
  }),
}));

import { createFeishuAdapter } from "./client";

const testConfig: FeishuBotConfig = {
  appId: "cli_test123",
  appSecret: "secret123",
  verificationToken: "verify_token_abc",
  encryptKey: "encrypt_key_xyz",
  enabled: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Feishu adapter", () => {
  describe("isEnabled", () => {
    it("should return true when all required fields are set and enabled", () => {
      const adapter = createFeishuAdapter(testConfig);
      expect(adapter.isEnabled()).toBe(true);
    });

    it("should return false when enabled is false", () => {
      const adapter = createFeishuAdapter({ ...testConfig, enabled: false });
      expect(adapter.isEnabled()).toBe(false);
    });

    it("should return false when appId is empty", () => {
      const adapter = createFeishuAdapter({ ...testConfig, appId: "" });
      expect(adapter.isEnabled()).toBe(false);
    });

    it("should return false when appSecret is empty", () => {
      const adapter = createFeishuAdapter({ ...testConfig, appSecret: "" });
      expect(adapter.isEnabled()).toBe(false);
    });

    it("should return false when verificationToken is empty", () => {
      const adapter = createFeishuAdapter({
        ...testConfig,
        verificationToken: "",
      });
      expect(adapter.isEnabled()).toBe(false);
    });
  });

  describe("platform", () => {
    it("should return 'feishu'", () => {
      const adapter = createFeishuAdapter(testConfig);
      expect(adapter.platform).toBe("feishu");
    });
  });

  describe("verifyWebhook", () => {
    it("should verify valid token in event callback v2 body", () => {
      const adapter = createFeishuAdapter(testConfig);
      const body = JSON.stringify({
        header: { token: "verify_token_abc" },
        event: {},
      });
      expect(adapter.verifyWebhook({}, body)).toBe(true);
    });

    it("should verify valid token in url_verification body", () => {
      const adapter = createFeishuAdapter(testConfig);
      const body = JSON.stringify({
        type: "url_verification",
        token: "verify_token_abc",
        challenge: "abc123",
      });
      expect(adapter.verifyWebhook({}, body)).toBe(true);
    });

    it("should reject invalid token", () => {
      const adapter = createFeishuAdapter(testConfig);
      const body = JSON.stringify({
        header: { token: "wrong_token" },
        event: {},
      });
      expect(adapter.verifyWebhook({}, body)).toBe(false);
    });

    it("should reject malformed JSON body", () => {
      const adapter = createFeishuAdapter(testConfig);
      expect(adapter.verifyWebhook({}, "not-json")).toBe(false);
    });
  });

  describe("parseMessages", () => {
    it("should parse a text message", () => {
      const adapter = createFeishuAdapter(testConfig);
      const body = {
        header: {
          event_type: "im.message.receive_v1",
          token: "verify_token_abc",
        },
        event: {
          sender: {
            sender_id: { open_id: "ou_user123" },
          },
          message: {
            message_id: "msg_001",
            chat_id: "oc_chat123",
            chat_type: "group",
            message_type: "text",
            content: JSON.stringify({ text: "Hello bot" }),
          },
        },
      };

      const messages = adapter.parseMessages(body);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe("text");
      if (messages[0].type === "text") {
        expect(messages[0].text).toBe("Hello bot");
        expect(messages[0].senderId).toBe("ou_user123");
        expect(messages[0].chatId).toBe("oc_chat123");
        expect(messages[0].isGroup).toBe(true);
      }
    });

    it("should parse a file message with encoded messageId:fileKey", () => {
      const adapter = createFeishuAdapter(testConfig);
      const body = {
        header: {
          event_type: "im.message.receive_v1",
          token: "verify_token_abc",
        },
        event: {
          sender: {
            sender_id: { open_id: "ou_user456" },
          },
          message: {
            message_id: "msg_002",
            chat_id: "oc_chat456",
            chat_type: "p2p",
            message_type: "file",
            content: JSON.stringify({
              file_key: "fk_001",
              file_name: "report.xlsx",
              file_size: 12345,
            }),
          },
        },
      };

      const messages = adapter.parseMessages(body);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe("file");
      if (messages[0].type === "file") {
        expect(messages[0].fileName).toBe("report.xlsx");
        // fileKey is encoded as "messageId:fileKey" for download URL construction
        expect(messages[0].fileKey).toBe("msg_002:fk_001");
        expect(messages[0].fileSize).toBe(12345);
        expect(messages[0].isGroup).toBe(false);
      }
    });

    it("should parse an image message with encoded image:imageKey", () => {
      const adapter = createFeishuAdapter(testConfig);
      const body = {
        header: {
          event_type: "im.message.receive_v1",
          token: "verify_token_abc",
        },
        event: {
          sender: {
            sender_id: { open_id: "ou_user789" },
          },
          message: {
            message_id: "msg_004",
            chat_id: "oc_chat789",
            chat_type: "p2p",
            message_type: "image",
            content: JSON.stringify({
              image_key: "img_key_001",
            }),
          },
        },
      };

      const messages = adapter.parseMessages(body);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe("file");
      if (messages[0].type === "file") {
        // Image keys are encoded as "image:{imageKey}"
        expect(messages[0].fileKey).toBe("image:img_key_001");
        expect(messages[0].fileType).toBe("image");
      }
    });

    it("should reject messages with invalid verification token", () => {
      const adapter = createFeishuAdapter(testConfig);
      const body = {
        header: {
          event_type: "im.message.receive_v1",
          token: "wrong_token",
        },
        event: {
          sender: { sender_id: { open_id: "ou_user" } },
          message: {
            message_id: "msg_003",
            chat_id: "oc_chat",
            chat_type: "p2p",
            message_type: "text",
            content: JSON.stringify({ text: "test" }),
          },
        },
      };

      const messages = adapter.parseMessages(body);
      expect(messages).toHaveLength(0);
    });

    it("should return empty array for unknown event types", () => {
      const adapter = createFeishuAdapter(testConfig);
      const body = {
        header: {
          event_type: "unknown_event",
          token: "verify_token_abc",
        },
        event: {},
      };

      const messages = adapter.parseMessages(body);
      expect(messages).toHaveLength(0);
    });

    it("should return empty array when header or event is missing", () => {
      const adapter = createFeishuAdapter(testConfig);
      expect(adapter.parseMessages({})).toHaveLength(0);
      expect(adapter.parseMessages({ header: {} })).toHaveLength(0);
    });
  });

  describe("sendText", () => {
    it("should send text message via SDK", async () => {
      mockMessageCreate.mockResolvedValue({ code: 0, msg: "success" });

      const adapter = createFeishuAdapter(testConfig);
      await adapter.sendText("oc_chat123", "Hello!");

      expect(mockMessageCreate).toHaveBeenCalledWith({
        params: { receive_id_type: "chat_id" },
        data: {
          receive_id: "oc_chat123",
          msg_type: "text",
          content: JSON.stringify({ text: "Hello!" }),
        },
      });
    });

    it("should throw on SDK error response", async () => {
      mockMessageCreate.mockResolvedValue({
        code: 99991,
        msg: "token invalid",
      });

      const adapter = createFeishuAdapter(testConfig);
      await expect(adapter.sendText("oc_chat123", "Hi")).rejects.toThrow(
        "Feishu send text failed: token invalid"
      );
    });
  });

  describe("sendFile", () => {
    it("should upload file then send file message via SDK", async () => {
      mockFileCreate.mockResolvedValue({ file_key: "fk_uploaded_001" });
      mockMessageCreate.mockResolvedValue({ code: 0, msg: "success" });

      const adapter = createFeishuAdapter(testConfig);
      // Use a real temp file for the test
      const os = await import("os");
      const fsp = await import("fs/promises");
      const tmpFile = `${os.default.tmpdir()}/feishu_test_upload_${Date.now()}.txt`;
      await fsp.default.writeFile(tmpFile, "test content");

      await adapter.fileHandler.sendFile(tmpFile, "test.txt", "oc_chat456");

      // Verify file upload was called
      expect(mockFileCreate).toHaveBeenCalledTimes(1);
      const uploadCall = mockFileCreate.mock.calls[0][0];
      expect(uploadCall.data.file_type).toBe("stream");
      expect(uploadCall.data.file_name).toBe("test.txt");

      // Verify send message was called with the uploaded file_key
      expect(mockMessageCreate).toHaveBeenCalledWith({
        params: { receive_id_type: "chat_id" },
        data: {
          receive_id: "oc_chat456",
          msg_type: "file",
          content: JSON.stringify({ file_key: "fk_uploaded_001" }),
        },
      });

      // Delay cleanup to avoid ENOENT from lazy ReadStream open
      setTimeout(() => fsp.default.unlink(tmpFile).catch(() => {}), 100);
    });

    it("should throw when file upload returns no file_key", async () => {
      mockFileCreate.mockResolvedValue(null);

      const adapter = createFeishuAdapter(testConfig);
      const os = await import("os");
      const fsp = await import("fs/promises");
      const tmpFile = `${os.default.tmpdir()}/feishu_test_nofk_${Date.now()}.txt`;
      await fsp.default.writeFile(tmpFile, "test");

      await expect(
        adapter.fileHandler.sendFile(tmpFile, "test.txt", "oc_chat")
      ).rejects.toThrow("no file_key returned");

      // Delay cleanup to avoid ENOENT from lazy ReadStream open
      setTimeout(() => fsp.default.unlink(tmpFile).catch(() => {}), 100);
    });
  });

  describe("downloadFile", () => {
    it("should download image via SDK image.get", async () => {
      const fsp = await import("fs/promises");
      const os = await import("os");
      const destDir = `${os.default.tmpdir()}/feishu_test_dl_img_${Date.now()}`;

      mockImageGet.mockResolvedValue({
        writeFile: vi.fn().mockImplementation(async (filePath: string) => {
          await fsp.default.mkdir(
            (await import("path")).default.dirname(filePath),
            { recursive: true }
          );
          await fsp.default.writeFile(filePath, "fake image data");
        }),
      });

      const adapter = createFeishuAdapter(testConfig);
      const result = await adapter.fileHandler.downloadFile(
        "image:img_key_abc",
        "photo.jpg",
        destDir
      );

      expect(mockImageGet).toHaveBeenCalledWith({
        path: { image_key: "img_key_abc" },
      });
      expect(result).toContain("photo.jpg");

      // Cleanup
      await fsp.default.rm(destDir, { recursive: true }).catch(() => {});
    });

    it("should download file via SDK messageResource.get", async () => {
      const fsp = await import("fs/promises");
      const os = await import("os");
      const destDir = `${os.default.tmpdir()}/feishu_test_dl_file_${Date.now()}`;

      mockMessageResourceGet.mockResolvedValue({
        writeFile: vi.fn().mockImplementation(async (filePath: string) => {
          await fsp.default.mkdir(
            (await import("path")).default.dirname(filePath),
            { recursive: true }
          );
          await fsp.default.writeFile(filePath, "fake file data");
        }),
      });

      const adapter = createFeishuAdapter(testConfig);
      const result = await adapter.fileHandler.downloadFile(
        "msg_001:fk_002",
        "report.xlsx",
        destDir
      );

      expect(mockMessageResourceGet).toHaveBeenCalledWith({
        path: { message_id: "msg_001", file_key: "fk_002" },
        params: { type: "file" },
      });
      expect(result).toContain("report.xlsx");

      // Cleanup
      await fsp.default.rm(destDir, { recursive: true }).catch(() => {});
    });

    it("should throw on invalid file key format", async () => {
      const adapter = createFeishuAdapter(testConfig);
      await expect(
        adapter.fileHandler.downloadFile("invalid_no_colon", "file.txt", "/tmp")
      ).rejects.toThrow("Invalid Feishu file key format");
    });
  });

  describe("sendInteractiveCard", () => {
    it("should send card and return message_id", async () => {
      mockMessageCreate.mockResolvedValue({
        code: 0,
        msg: "success",
        data: { message_id: "om_card_001" },
      });

      const adapter = createFeishuAdapter(testConfig);
      const card = { config: { wide_screen_mode: true }, elements: [] };
      const messageId = await adapter.sendInteractiveCard!("oc_chat123", card);

      expect(messageId).toBe("om_card_001");
      expect(mockMessageCreate).toHaveBeenCalledWith({
        params: { receive_id_type: "chat_id" },
        data: {
          receive_id: "oc_chat123",
          msg_type: "interactive",
          content: JSON.stringify(card),
        },
      });
    });

    it("should throw on SDK error response", async () => {
      mockMessageCreate.mockResolvedValue({
        code: 99991,
        msg: "token invalid",
      });

      const adapter = createFeishuAdapter(testConfig);
      await expect(
        adapter.sendInteractiveCard!("oc_chat123", {})
      ).rejects.toThrow("Feishu send card failed: token invalid");
    });

    it("should throw when response is missing message_id", async () => {
      mockMessageCreate.mockResolvedValue({
        code: 0,
        msg: "success",
        data: {},
      });

      const adapter = createFeishuAdapter(testConfig);
      await expect(
        adapter.sendInteractiveCard!("oc_chat123", {})
      ).rejects.toThrow("Feishu send card failed: missing message_id in response");
    });
  });

  describe("patchInteractiveCard", () => {
    it("should patch card via SDK", async () => {
      mockMessagePatch.mockResolvedValue({ code: 0, msg: "success" });

      const adapter = createFeishuAdapter(testConfig);
      const card = { config: { wide_screen_mode: true }, elements: [] };
      await adapter.patchInteractiveCard!("om_card_001", card);

      expect(mockMessagePatch).toHaveBeenCalledWith({
        path: { message_id: "om_card_001" },
        data: {
          content: JSON.stringify(card),
        },
      });
    });

    it("should throw on SDK error response", async () => {
      mockMessagePatch.mockResolvedValue({
        code: 99991,
        msg: "token invalid",
      });

      const adapter = createFeishuAdapter(testConfig);
      await expect(
        adapter.patchInteractiveCard!("om_card_001", {})
      ).rejects.toThrow("Feishu patch card failed: token invalid");
    });
  });
});
