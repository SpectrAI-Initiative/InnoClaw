/**
 * Unit tests for Feishu WebSocket client helpers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSdkLogger } from "./ws-client";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("createSdkLogger", () => {
  it("should prefix all log calls with [feishu-ws]", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    const logger = createSdkLogger({});

    logger.info("hello");
    expect(infoSpy).toHaveBeenCalledWith("[feishu-ws]", "hello");

    logger.error("oops");
    expect(errorSpy).toHaveBeenCalledWith("[feishu-ws]", "oops");

    logger.warn("careful");
    expect(warnSpy).toHaveBeenCalledWith("[feishu-ws]", "careful");

    logger.debug("detail");
    expect(debugSpy).toHaveBeenCalledWith("[feishu-ws]", "detail");

    logger.trace("verbose");
    expect(debugSpy).toHaveBeenCalledWith("[feishu-ws]", "[trace]", "verbose");
  });

  it("should call onReady when SDK logs 'ws client ready'", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const onReady = vi.fn();
    const logger = createSdkLogger({ onReady });

    logger.info("[ws]", "ws client ready");

    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("should call onReady when 'ws client ready' is inside an array arg (SDK LoggerProxy wraps args)", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const onReady = vi.fn();
    const logger = createSdkLogger({ onReady });

    // The SDK's LoggerProxy passes args as: logger.info([...msg])
    logger.info(["[ws]", "ws client ready"]);

    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("should call onConnectFailed when SDK logs 'connect failed'", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onConnectFailed = vi.fn();
    const logger = createSdkLogger({ onConnectFailed });

    logger.error("[ws]", "connect failed");

    expect(onConnectFailed).toHaveBeenCalledTimes(1);
  });

  it("should call onConnectFailed when 'connect failed' is inside an array arg", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onConnectFailed = vi.fn();
    const logger = createSdkLogger({ onConnectFailed });

    logger.error(["[ws]", "connect failed"]);

    expect(onConnectFailed).toHaveBeenCalledTimes(1);
  });

  it("should not call callbacks for unrelated messages", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
    const onReady = vi.fn();
    const onConnectFailed = vi.fn();
    const logger = createSdkLogger({ onReady, onConnectFailed });

    logger.info("[ws]", "some other message");
    // "ws connect success" is intentionally different from "ws client ready"
    // to verify that similar but different SDK status phrases do not trigger callbacks.
    logger.debug("[ws]", "ws connect success");

    expect(onReady).not.toHaveBeenCalled();
    expect(onConnectFailed).not.toHaveBeenCalled();
  });

  it("should work when callbacks are not provided", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createSdkLogger({});

    // Should not throw
    logger.info("[ws]", "ws client ready");
    logger.error("[ws]", "connect failed");
  });
});
