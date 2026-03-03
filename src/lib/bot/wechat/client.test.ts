/**
 * Unit tests for WeChat bot adapter.
 */

import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { createWechatAdapter } from "./client";
import type { WechatBotConfig } from "../types";

const testConfig: WechatBotConfig = {
  corpId: "corp_test123",
  corpSecret: "secret_test456",
  token: "test_token",
  encodingAESKey: "test_aes_key_01234567890123456789012",
  agentId: "1000001",
  enabled: true,
};

describe("WeChat adapter", () => {
  describe("isEnabled", () => {
    it("should return true when all required fields are set and enabled", () => {
      const adapter = createWechatAdapter(testConfig);
      expect(adapter.isEnabled()).toBe(true);
    });

    it("should return false when enabled is false", () => {
      const adapter = createWechatAdapter({ ...testConfig, enabled: false });
      expect(adapter.isEnabled()).toBe(false);
    });

    it("should return false when corpId is empty", () => {
      const adapter = createWechatAdapter({ ...testConfig, corpId: "" });
      expect(adapter.isEnabled()).toBe(false);
    });

    it("should return false when corpSecret is empty", () => {
      const adapter = createWechatAdapter({ ...testConfig, corpSecret: "" });
      expect(adapter.isEnabled()).toBe(false);
    });

    it("should return false when token is empty", () => {
      const adapter = createWechatAdapter({ ...testConfig, token: "" });
      expect(adapter.isEnabled()).toBe(false);
    });

    it("should return false when encodingAESKey is empty", () => {
      const adapter = createWechatAdapter({ ...testConfig, encodingAESKey: "" });
      expect(adapter.isEnabled()).toBe(false);
    });

    it("should return false when agentId is empty", () => {
      const adapter = createWechatAdapter({ ...testConfig, agentId: "" });
      expect(adapter.isEnabled()).toBe(false);
    });

    it("should return false when agentId is non-numeric", () => {
      const adapter = createWechatAdapter({ ...testConfig, agentId: "abc" });
      expect(adapter.isEnabled()).toBe(false);
    });
  });

  describe("platform", () => {
    it("should return 'wechat'", () => {
      const adapter = createWechatAdapter(testConfig);
      expect(adapter.platform).toBe("wechat");
    });
  });

  describe("verifyWebhook", () => {
    it("should return false when signature params are missing", () => {
      const adapter = createWechatAdapter(testConfig);
      expect(adapter.verifyWebhook({}, "")).toBe(false);
      expect(adapter.verifyWebhook({ timestamp: "123" }, "")).toBe(false);
    });

    it("should verify correct SHA1 signature (plaintext mode)", () => {
      const adapter = createWechatAdapter(testConfig);
      const parts = ["test_token", "1234567890", "nonce123"].sort();
      const expected = crypto
        .createHash("sha1")
        .update(parts.join(""))
        .digest("hex");

      const result = adapter.verifyWebhook(
        {
          signature: expected,
          timestamp: "1234567890",
          nonce: "nonce123",
        },
        ""
      );

      expect(result).toBe(true);
    });

    it("should verify msg_signature with body data (encrypted mode)", () => {
      const adapter = createWechatAdapter(testConfig);
      const echostr = "encrypted_echostr_value";
      const parts = ["test_token", "1234567890", "nonce123", echostr].sort();
      const expected = crypto
        .createHash("sha1")
        .update(parts.join(""))
        .digest("hex");

      const result = adapter.verifyWebhook(
        {
          msg_signature: expected,
          timestamp: "1234567890",
          nonce: "nonce123",
        },
        echostr
      );

      expect(result).toBe(true);
    });

    it("should reject incorrect signature", () => {
      const adapter = createWechatAdapter(testConfig);
      const result = adapter.verifyWebhook(
        {
          signature: "wrong_signature_hash",
          timestamp: "1234567890",
          nonce: "nonce123",
        },
        ""
      );

      expect(result).toBe(false);
    });
  });

  describe("parseMessages", () => {
    it("should parse a text message", () => {
      const adapter = createWechatAdapter(testConfig);
      const body = {
        MsgType: "text",
        FromUserName: "user001",
        MsgId: 12345,
        Content: "Hello WeChat bot",
        CreateTime: 1700000000,
        AgentID: 1000001,
      };

      const messages = adapter.parseMessages(body);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe("text");
      if (messages[0].type === "text") {
        expect(messages[0].text).toBe("Hello WeChat bot");
        expect(messages[0].senderId).toBe("user001");
        expect(messages[0].chatId).toBe("user001");
        expect(messages[0].isGroup).toBe(false);
      }
    });

    it("should parse a file message", () => {
      const adapter = createWechatAdapter(testConfig);
      const body = {
        MsgType: "file",
        FromUserName: "user002",
        MsgId: 67890,
        MediaId: "media_abc123",
        FileName: "document.pdf",
        FileSize: 54321,
        CreateTime: 1700000100,
        AgentID: 1000001,
      };

      const messages = adapter.parseMessages(body);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe("file");
      if (messages[0].type === "file") {
        expect(messages[0].fileName).toBe("document.pdf");
        expect(messages[0].fileKey).toBe("media_abc123");
        expect(messages[0].fileSize).toBe(54321);
      }
    });

    it("should parse an image message", () => {
      const adapter = createWechatAdapter(testConfig);
      const body = {
        MsgType: "image",
        FromUserName: "user003",
        MsgId: 11111,
        MediaId: "media_img456",
        CreateTime: 1700000200,
        AgentID: 1000001,
      };

      const messages = adapter.parseMessages(body);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe("file");
      if (messages[0].type === "file") {
        expect(messages[0].fileType).toBe("image");
        expect(messages[0].fileKey).toBe("media_img456");
      }
    });

    it("should return empty array for unsupported message types", () => {
      const adapter = createWechatAdapter(testConfig);
      const body = {
        MsgType: "event",
        Event: "subscribe",
        FromUserName: "user004",
      };

      const messages = adapter.parseMessages(body);
      expect(messages).toHaveLength(0);
    });
  });
});
