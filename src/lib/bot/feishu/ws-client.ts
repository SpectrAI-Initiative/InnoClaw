/**
 * Feishu WebSocket long-connection client.
 *
 * Uses @larksuiteoapi/node-sdk WSClient to maintain a persistent WebSocket
 * connection with Feishu, receiving events in real-time instead of through
 * HTTP webhooks.
 *
 * Started once via `startFeishuWSClient()` in instrumentation.ts when the
 * Next.js server boots.
 *
 * **Important**: The SDK's `WSClient.start()` resolves its promise *before*
 * the WebSocket connection is fully established (the internal `reConnect()`
 * call is not awaited). Therefore we inject a custom logger to detect the
 * actual connection outcome from the SDK's own log messages:
 *   - `"ws client ready"` → connection succeeded
 *   - `"connect failed"` → connection failed
 */

import * as lark from "@larksuiteoapi/node-sdk";
import { getFeishuConfig } from "../types";
import { createFeishuAdapter } from "./client";
import { handleFeishuMessage } from "./message-handler";

// ---------------------------------------------------------------------------
// Singleton guard (survives HMR in dev)
// ---------------------------------------------------------------------------

// Use globalThis to prevent multiple WSClient instances during Next.js HMR
const globalForFeishu = globalThis as unknown as {
  __feishuWsStarted?: boolean;
  __feishuWsClient?: InstanceType<typeof lark.WSClient>;
};

// ---------------------------------------------------------------------------
// SDK logger
// ---------------------------------------------------------------------------

/**
 * Build a custom logger that:
 *  1. Prefixes every SDK message with `[feishu-ws]` for easy grep-ability.
 *  2. Detects the SDK's internal "ws client ready" / "connect failed" messages
 *     and calls the corresponding callbacks so we can provide accurate
 *     user-facing feedback.
 */
export function createSdkLogger(callbacks: {
  onReady?: () => void;
  onConnectFailed?: () => void;
}) {
  const PREFIX = "[feishu-ws]";

  /** Check whether any argument contains a target substring. */
  function includes(args: unknown[], target: string): boolean {
    for (const a of args) {
      if (typeof a === "string" && a.includes(target)) return true;
      if (Array.isArray(a)) {
        for (const v of a) {
          if (typeof v === "string" && v.includes(target)) return true;
        }
      }
    }
    return false;
  }

  function handleArgs(args: unknown[]) {
    if (includes(args, "ws client ready")) {
      callbacks.onReady?.();
    }
    if (includes(args, "connect failed")) {
      callbacks.onConnectFailed?.();
    }
  }

  return {
    error: (...args: unknown[]) => {
      console.error(PREFIX, ...args);
      handleArgs(args);
    },
    warn: (...args: unknown[]) => {
      console.warn(PREFIX, ...args);
      handleArgs(args);
    },
    info: (...args: unknown[]) => {
      console.info(PREFIX, ...args);
      handleArgs(args);
    },
    debug: (...args: unknown[]) => {
      console.debug(PREFIX, ...args);
      handleArgs(args);
    },
    trace: (...args: unknown[]) => {
      console.debug(PREFIX, "[trace]", ...args);
      handleArgs(args);
    },
  };
}

// ---------------------------------------------------------------------------
// Cleanup helper
// ---------------------------------------------------------------------------

/**
 * Centralised cleanup for the WSClient singleton.
 *
 * Closes the existing client (if any), clears the global reference, and resets
 * the started flag so a future call to `startFeishuWSClient()` can retry.
 */
function cleanupWsClient(reason: string, err?: unknown): void {
  try {
    globalForFeishu.__feishuWsClient?.close({ force: true });
  } catch (e) {
    console.debug("[feishu-ws] Ignoring error during WSClient cleanup:", e);
  }
  globalForFeishu.__feishuWsClient = undefined;
  globalForFeishu.__feishuWsStarted = false;
  if (err) {
    console.error(`[feishu-ws] ${reason}:`, err);
  } else {
    console.error(`[feishu-ws] ${reason}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the Feishu WSClient long connection.
 *
 * Safe to call multiple times — only the first call creates the connection.
 * Uses globalThis to survive Next.js HMR reloads in development.
 */
export function startFeishuWSClient(): void {
  if (globalForFeishu.__feishuWsStarted) {
    console.log("[feishu-ws] WSClient already started, skipping");
    return;
  }

  const config = getFeishuConfig();

  if (!config.enabled || !config.appId || !config.appSecret) {
    console.log("[feishu-ws] Feishu bot not enabled or missing credentials, skipping WSClient");
    return;
  }

  // Create adapter for sending messages (uses lark.Client internally)
  const adapter = createFeishuAdapter(config);

  // Determine SDK log level from env (default: info)
  const envLogLevel = (process.env.FEISHU_LOG_LEVEL || "info").toLowerCase().trim();
  const logLevelMap: Record<string, lark.LoggerLevel> = {
    error: lark.LoggerLevel.error,
    warn: lark.LoggerLevel.warn,
    info: lark.LoggerLevel.info,
    debug: lark.LoggerLevel.debug,
    trace: lark.LoggerLevel.trace,
  };
  if (!(envLogLevel in logLevelMap)) {
    console.warn(
      `[feishu-ws] Unknown FEISHU_LOG_LEVEL="${envLogLevel}", ` +
        `expected one of: ${Object.keys(logLevelMap).join(", ")}. Falling back to "info".`
    );
  }
  const loggerLevel = logLevelMap[envLogLevel] ?? lark.LoggerLevel.info;

  // Custom logger to detect actual connection status from SDK internals
  const logger = createSdkLogger({
    onReady() {
      console.log(
        "[feishu-ws] ✅ WSClient connected successfully — " +
          "Feishu Developer Console should now detect the connection."
      );
    },
    onConnectFailed() {
      // Do not close or reset the WSClient here: the SDK manages its own
      // internal reconnect loop. We only log the failure so operators can
      // investigate, while allowing the client to keep retrying.
      console.error(
        "[feishu-ws] ❌ WSClient connection failed — " +
          "please verify FEISHU_APP_ID and FEISHU_APP_SECRET in .env.local. " +
          "The Feishu Developer Console will show \"App connection info not detected\" " +
          "until the connection is established successfully. " +
          "The SDK will continue attempting to reconnect automatically."
      );
    },
  });

  // Create WSClient for receiving events via WebSocket
  const wsClient = new lark.WSClient({
    appId: config.appId,
    appSecret: config.appSecret,
    domain: lark.Domain.Feishu,
    loggerLevel,
    logger,
  });

  // Create EventDispatcher and register message handler
  const eventDispatcher = new lark.EventDispatcher({}).register({
    "im.message.receive_v1": async (data) => {
      // WSClient event data is the "event" portion directly:
      //   { sender: {...}, message: {...}, event_id, ... }
      // Wrap it into the format that adapter.parseMessages() expects:
      //   { header: { event_type, token }, event: {...} }
      const body = {
        header: {
          event_type: "im.message.receive_v1",
          token: config.verificationToken,
        },
        event: data,
      };

      const messages = adapter.parseMessages(
        body as unknown as Record<string, unknown>
      );

      if (messages.length === 0) {
        console.log("[feishu-ws] No parseable messages in event");
        return;
      }

      // Process each message (fire-and-forget, don't block the event loop)
      for (const message of messages) {
        handleFeishuMessage(adapter, message, "[feishu-ws]").catch((err: unknown) => {
          console.error("[feishu-ws] Unhandled error in handleMessage:", err);
        });
      }
    },
  });

  // Set flag and store instance before starting to prevent concurrent start attempts
  globalForFeishu.__feishuWsStarted = true;
  globalForFeishu.__feishuWsClient = wsClient;
  console.log("[feishu-ws] WSClient starting...");

  // Start the WebSocket connection.
  // NOTE: The SDK's start() resolves its promise BEFORE the WebSocket is
  // actually connected (the internal reConnect() is not awaited). The real
  // connection status is reported through the custom logger above.
  wsClient
    .start({ eventDispatcher })
    .then(() => {
      console.log(
        "[feishu-ws] WSClient start() initiated — " +
          "waiting for connection to be established (watch for ✅ or ❌ above)..."
      );
    })
    .catch((err) => {
      cleanupWsClient("WSClient failed to start", err);
    });
}
