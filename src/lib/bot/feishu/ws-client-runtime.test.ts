import { beforeEach, describe, expect, it, vi } from "vitest";

describe("startFeishuWSClient", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    delete (globalThis as { __feishuWsStarted?: boolean }).__feishuWsStarted;
    delete (globalThis as { __feishuWsClient?: unknown }).__feishuWsClient;
    delete (globalThis as { __feishuWsUnsupported?: boolean }).__feishuWsUnsupported;
  });

  it("falls back to webhook mode when the installed SDK has no WSClient export", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.doMock("@larksuiteoapi/node-sdk", () => ({
      Domain: { Feishu: "feishu" },
      LoggerLevel: {
        error: 1,
        warn: 2,
        info: 3,
        debug: 4,
        trace: 5,
      },
      WSClient: undefined,
      EventDispatcher: class {
        register() {
          return this;
        }
      },
    }));
    vi.doMock("../types", () => ({
      getFeishuConfig: () => ({
        enabled: true,
        appId: "app-id",
        appSecret: "app-secret",
        verificationToken: "token",
      }),
    }));
    vi.doMock("./client", () => ({
      createFeishuAdapter: () => ({
        parseMessages: () => [],
      }),
    }));
    vi.doMock("./message-handler", () => ({
      handleFeishuMessage: vi.fn(),
    }));

    const { startFeishuWSClient } = await import("./ws-client");
    startFeishuWSClient();

    expect(warnSpy).toHaveBeenCalledWith(
      "[feishu-ws] Installed @larksuiteoapi/node-sdk does not export WSClient. " +
        "Skipping Feishu WebSocket startup and keeping HTTP webhook mode enabled at /api/bot/feishu."
    );
    expect((globalThis as { __feishuWsUnsupported?: boolean }).__feishuWsUnsupported).toBe(true);
    expect((globalThis as { __feishuWsStarted?: boolean }).__feishuWsStarted).toBeUndefined();
  });

  it("starts the SDK WSClient when the export is available", async () => {
    const startMock = vi.fn().mockResolvedValue(undefined);
    const ctorSpy = vi.fn();
    class WsClientMock {
      close = vi.fn();

      constructor(options: unknown) {
        ctorSpy(options);
      }

      start = startMock;
    }

    vi.spyOn(console, "log").mockImplementation(() => {});

    vi.doMock("@larksuiteoapi/node-sdk", () => ({
      Domain: { Feishu: "feishu" },
      LoggerLevel: {
        error: 1,
        warn: 2,
        info: 3,
        debug: 4,
        trace: 5,
      },
      WSClient: WsClientMock,
      EventDispatcher: class {
        register() {
          return this;
        }
      },
    }));
    vi.doMock("../types", () => ({
      getFeishuConfig: () => ({
        enabled: true,
        appId: "app-id",
        appSecret: "app-secret",
        verificationToken: "token",
      }),
    }));
    vi.doMock("./client", () => ({
      createFeishuAdapter: () => ({
        parseMessages: () => [],
      }),
    }));
    vi.doMock("./message-handler", () => ({
      handleFeishuMessage: vi.fn(),
    }));

    const { startFeishuWSClient } = await import("./ws-client");
    startFeishuWSClient();
    await Promise.resolve();

    expect(ctorSpy).toHaveBeenCalledTimes(1);
    expect(ctorSpy).toHaveBeenCalledWith(expect.objectContaining({
      appId: "app-id",
      appSecret: "app-secret",
      domain: "feishu",
    }));
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(startMock).toHaveBeenCalledWith({
      eventDispatcher: expect.any(Object),
    });
    expect((globalThis as { __feishuWsStarted?: boolean }).__feishuWsStarted).toBe(true);
  });
});
