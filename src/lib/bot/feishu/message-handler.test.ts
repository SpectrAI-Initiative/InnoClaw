/**
 * Unit tests for Feishu message-handler.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BotAdapter, BotTextMessage, BotFileMessage } from "../types";

// ---------------------------------------------------------------------------
// Mock dependencies before importing the router
// ---------------------------------------------------------------------------

const mockParseAndHandleCommand = vi.fn();
const mockProcessAgentMessage = vi.fn();
const mockProcessMessage = vi.fn();
const mockSendReplies = vi.fn();
const mockGetChatState = vi.fn();
const mockAcquireProcessingLock = vi.fn();
const mockReleaseProcessingLock = vi.fn();

vi.mock("./commands", () => ({
  parseAndHandleCommand: (...args: unknown[]) =>
    mockParseAndHandleCommand(...args),
}));

vi.mock("./agent-processor", () => ({
  processAgentMessage: (...args: unknown[]) =>
    mockProcessAgentMessage(...args),
}));

vi.mock("../processor", () => ({
  processMessage: (...args: unknown[]) => mockProcessMessage(...args),
  sendReplies: (...args: unknown[]) => mockSendReplies(...args),
}));

vi.mock("./state", () => ({
  getChatState: (...args: unknown[]) => mockGetChatState(...args),
  acquireProcessingLock: (...args: unknown[]) =>
    mockAcquireProcessingLock(...args),
  releaseProcessingLock: (...args: unknown[]) =>
    mockReleaseProcessingLock(...args),
}));

import { handleFeishuMessage } from "./message-handler";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockAdapter(overrides?: Partial<BotAdapter>): BotAdapter {
  return {
    platform: "feishu",
    isEnabled: () => true,
    verifyWebhook: () => true,
    parseMessages: () => [],
    sendText: vi.fn(),
    sendInteractiveCard: vi.fn(),
    fileHandler: {
      downloadFile: vi.fn(),
      sendFile: vi.fn(),
    },
    ...overrides,
  };
}

function createTextMessage(overrides?: Partial<BotTextMessage>): BotTextMessage {
  return {
    type: "text",
    messageId: "msg_001",
    text: "Hello bot",
    senderId: "ou_user123",
    chatId: "oc_chat123",
    isGroup: false,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function createFileMessage(overrides?: Partial<BotFileMessage>): BotFileMessage {
  return {
    type: "file",
    messageId: "msg_002",
    senderId: "ou_user123",
    chatId: "oc_chat123",
    isGroup: false,
    timestamp: new Date().toISOString(),
    fileName: "report.xlsx",
    fileType: "file",
    fileSize: 12345,
    fileKey: "msg_002:fk_001",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no command handled, no workspace bound
  mockParseAndHandleCommand.mockResolvedValue({ handled: false });
  mockGetChatState.mockReturnValue({ workspacePath: null, mode: "agent" });
  mockProcessMessage.mockResolvedValue([]);
  mockSendReplies.mockResolvedValue(undefined);
});

describe("handleFeishuMessage", () => {
  describe("slash command handling", () => {
    it("should send interactive card when command returns a card", async () => {
      const card = { header: { title: "Status" } };
      mockParseAndHandleCommand.mockResolvedValue({ handled: true, card });
      const adapter = createMockAdapter();
      const message = createTextMessage({ text: "/status" });

      await handleFeishuMessage(adapter, message, "[test]");

      expect(mockParseAndHandleCommand).toHaveBeenCalledWith("oc_chat123", "/status");
      expect(adapter.sendInteractiveCard).toHaveBeenCalledWith("oc_chat123", card);
      expect(mockProcessMessage).not.toHaveBeenCalled();
    });

    it("should send text when command returns text but no card", async () => {
      mockParseAndHandleCommand.mockResolvedValue({
        handled: true,
        text: "Help info",
      });
      const adapter = createMockAdapter();
      const message = createTextMessage({ text: "/help" });

      await handleFeishuMessage(adapter, message, "[test]");

      expect(adapter.sendText).toHaveBeenCalledWith("oc_chat123", "Help info");
      expect(adapter.sendInteractiveCard).not.toHaveBeenCalled();
      expect(mockProcessMessage).not.toHaveBeenCalled();
    });

    it("should fall back to sendText when adapter has no sendInteractiveCard", async () => {
      const card = { header: { title: "Status" } };
      mockParseAndHandleCommand.mockResolvedValue({
        handled: true,
        card,
        text: "Fallback text",
      });
      const adapter = createMockAdapter({ sendInteractiveCard: undefined });
      const message = createTextMessage({ text: "/status" });

      await handleFeishuMessage(adapter, message, "[test]");

      expect(adapter.sendText).toHaveBeenCalledWith("oc_chat123", "Fallback text");
    });
  });

  describe("agent processing (workspace bound)", () => {
    it("should process via agent when workspace is bound", async () => {
      mockGetChatState.mockReturnValue({
        workspacePath: "/home/user/project",
        mode: "agent",
      });
      mockAcquireProcessingLock.mockReturnValue(true);
      mockProcessAgentMessage.mockResolvedValue(undefined);
      const adapter = createMockAdapter();
      const message = createTextMessage();

      await handleFeishuMessage(adapter, message, "[test]");

      expect(mockAcquireProcessingLock).toHaveBeenCalledWith("oc_chat123");
      expect(mockProcessAgentMessage).toHaveBeenCalledWith({
        adapter,
        chatId: "oc_chat123",
        userMessage: "Hello bot",
        workspacePath: "/home/user/project",
        mode: "agent",
      });
      expect(mockReleaseProcessingLock).toHaveBeenCalledWith("oc_chat123");
      expect(mockProcessMessage).not.toHaveBeenCalled();
    });

    it("should send lock message when processing lock is not acquired", async () => {
      mockGetChatState.mockReturnValue({
        workspacePath: "/home/user/project",
        mode: "agent",
      });
      mockAcquireProcessingLock.mockReturnValue(false);
      const adapter = createMockAdapter();
      const message = createTextMessage();

      await handleFeishuMessage(adapter, message, "[test]");

      expect(adapter.sendText).toHaveBeenCalledWith(
        "oc_chat123",
        "I'm still processing your previous request. Please wait."
      );
      expect(mockProcessAgentMessage).not.toHaveBeenCalled();
    });

    it("should release lock even when agent processing throws", async () => {
      mockGetChatState.mockReturnValue({
        workspacePath: "/home/user/project",
        mode: "agent",
      });
      mockAcquireProcessingLock.mockReturnValue(true);
      mockProcessAgentMessage.mockRejectedValue(new Error("Agent failed"));
      const adapter = createMockAdapter();
      const message = createTextMessage();

      await handleFeishuMessage(adapter, message, "[test]");

      expect(mockReleaseProcessingLock).toHaveBeenCalledWith("oc_chat123");
      // Error should be caught and a generic message sent
      expect(adapter.sendText).toHaveBeenCalledWith(
        "oc_chat123",
        expect.stringContaining("Something went wrong")
      );
    });
  });

  describe("simple processor fallback", () => {
    it("should fall back to simple processor for text without workspace", async () => {
      const replies = [{ type: "text" as const, text: "AI reply" }];
      mockProcessMessage.mockResolvedValue(replies);
      const adapter = createMockAdapter();
      const message = createTextMessage();

      await handleFeishuMessage(adapter, message, "[test]");

      expect(mockProcessMessage).toHaveBeenCalledWith(adapter, message);
      expect(mockSendReplies).toHaveBeenCalledWith(adapter, "oc_chat123", replies);
    });

    it("should use simple processor for file messages", async () => {
      const replies = [{ type: "text" as const, text: "File processed" }];
      mockProcessMessage.mockResolvedValue(replies);
      const adapter = createMockAdapter();
      const message = createFileMessage();

      await handleFeishuMessage(adapter, message, "[test]");

      // File messages skip command parsing entirely
      expect(mockParseAndHandleCommand).not.toHaveBeenCalled();
      expect(mockProcessMessage).toHaveBeenCalledWith(adapter, message);
      expect(mockSendReplies).toHaveBeenCalledWith(adapter, "oc_chat123", replies);
    });
  });

  describe("error handling", () => {
    it("should send generic error with correlation id when processing fails", async () => {
      mockProcessMessage.mockRejectedValue(new Error("AI provider down"));
      const adapter = createMockAdapter();
      const message = createTextMessage();

      await handleFeishuMessage(adapter, message, "[test]");

      expect(adapter.sendText).toHaveBeenCalledWith(
        "oc_chat123",
        expect.stringMatching(
          /Something went wrong.*error id: [a-z0-9]+/
        )
      );
    });

    it("should not leak internal error details to the user", async () => {
      mockProcessMessage.mockRejectedValue(
        new Error("/internal/path/secret.ts: connection refused")
      );
      const adapter = createMockAdapter();
      const message = createTextMessage();

      await handleFeishuMessage(adapter, message, "[test]");

      const sentText = (adapter.sendText as ReturnType<typeof vi.fn>).mock
        .calls[0][1] as string;
      expect(sentText).not.toContain("/internal/path/secret.ts");
      expect(sentText).not.toContain("connection refused");
      expect(sentText).toContain("Something went wrong");
    });

    it("should not throw when sendText also fails in error handler", async () => {
      mockProcessMessage.mockRejectedValue(new Error("fail"));
      const adapter = createMockAdapter({
        sendText: vi.fn().mockRejectedValue(new Error("send also failed")),
      });
      const message = createTextMessage();

      // Should not throw
      await expect(
        handleFeishuMessage(adapter, message, "[test]")
      ).resolves.toBeUndefined();
    });
  });
});
