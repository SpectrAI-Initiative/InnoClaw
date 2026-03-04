/**
 * Unit tests for bot types and configuration helpers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getFeishuConfig,
  getWechatConfig,
  MAX_FILE_SIZE,
} from "./types";

describe("Bot types", () => {
  describe("MAX_FILE_SIZE", () => {
    it("should be 100MB", () => {
      expect(MAX_FILE_SIZE).toBe(100 * 1024 * 1024);
    });
  });

  describe("getFeishuConfig", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should return empty config when env vars are not set", () => {
      delete process.env.FEISHU_APP_ID;
      delete process.env.FEISHU_APP_SECRET;
      delete process.env.FEISHU_VERIFICATION_TOKEN;
      delete process.env.FEISHU_BOT_ENABLED;

      const config = getFeishuConfig();
      expect(config.appId).toBe("");
      expect(config.appSecret).toBe("");
      expect(config.verificationToken).toBe("");
      expect(config.enabled).toBe(false);
    });

    it("should read config from environment variables", () => {
      process.env.FEISHU_APP_ID = "cli_test123";
      process.env.FEISHU_APP_SECRET = "secret123";
      process.env.FEISHU_VERIFICATION_TOKEN = "token123";
      process.env.FEISHU_ENCRYPT_KEY = "encrypt123";
      process.env.FEISHU_BOT_ENABLED = "true";

      const config = getFeishuConfig();
      expect(config.appId).toBe("cli_test123");
      expect(config.appSecret).toBe("secret123");
      expect(config.verificationToken).toBe("token123");
      expect(config.encryptKey).toBe("encrypt123");
      expect(config.enabled).toBe(true);
    });

    it("should return enabled=false when FEISHU_BOT_ENABLED is not 'true'", () => {
      process.env.FEISHU_BOT_ENABLED = "false";
      expect(getFeishuConfig().enabled).toBe(false);

      process.env.FEISHU_BOT_ENABLED = "yes";
      expect(getFeishuConfig().enabled).toBe(false);
    });
  });

  describe("getWechatConfig", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should return empty config when env vars are not set", () => {
      delete process.env.WECHAT_CORP_ID;
      delete process.env.WECHAT_CORP_SECRET;
      delete process.env.WECHAT_TOKEN;
      delete process.env.WECHAT_ENCODING_AES_KEY;
      delete process.env.WECHAT_AGENT_ID;
      delete process.env.WECHAT_BOT_ENABLED;

      const config = getWechatConfig();
      expect(config.corpId).toBe("");
      expect(config.corpSecret).toBe("");
      expect(config.token).toBe("");
      expect(config.encodingAESKey).toBe("");
      expect(config.agentId).toBe("");
      expect(config.enabled).toBe(false);
    });

    it("should read config from environment variables", () => {
      process.env.WECHAT_CORP_ID = "corp123";
      process.env.WECHAT_CORP_SECRET = "secret456";
      process.env.WECHAT_TOKEN = "token789";
      process.env.WECHAT_ENCODING_AES_KEY = "aeskey";
      process.env.WECHAT_AGENT_ID = "1000001";
      process.env.WECHAT_BOT_ENABLED = "true";

      const config = getWechatConfig();
      expect(config.corpId).toBe("corp123");
      expect(config.corpSecret).toBe("secret456");
      expect(config.token).toBe("token789");
      expect(config.encodingAESKey).toBe("aeskey");
      expect(config.agentId).toBe("1000001");
      expect(config.enabled).toBe(true);
    });
  });
});
