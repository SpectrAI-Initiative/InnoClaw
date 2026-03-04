/**
 * Feishu WebSocket long-connection client.
 *
 * Uses @larksuiteoapi/node-sdk WSClient to maintain a persistent WebSocket
 * connection with Feishu, receiving events in real-time instead of through
 * HTTP webhooks.
 *
 * Started once via `startFeishuWSClient()` in instrumentation.ts when the
 * Next.js server boots.
 */

import * as lark from "@larksuiteoapi/node-sdk";
import { getFeishuConfig } from "../types";
import { createFeishuAdapter } from "./client";
import { routeMessage } from "./message-router";

// ---------------------------------------------------------------------------
// Singleton guard (survives HMR in dev)
// ---------------------------------------------------------------------------

// Use globalThis to prevent multiple WSClient instances during Next.js HMR
const globalForFeishu = globalThis as unknown as {
  __feishuWsStarted?: boolean;
};

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

  // Create WSClient for receiving events via WebSocket
  const wsClient = new lark.WSClient({
    appId: config.appId,
    appSecret: config.appSecret,
    domain: lark.Domain.Feishu,
    loggerLevel: lark.LoggerLevel.info,
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
        routeMessage(adapter, message, "[feishu-ws]");
      }
    },
  });

  // Set flag before starting to prevent concurrent start attempts
  globalForFeishu.__feishuWsStarted = true;
  console.log("[feishu-ws] WSClient starting...");

  // Start the WebSocket connection
  wsClient
    .start({ eventDispatcher })
    .then(() => {
      console.log("[feishu-ws] WSClient connected successfully");
    })
    .catch((err) => {
      // Reset flag so a subsequent call can retry
      globalForFeishu.__feishuWsStarted = false;
      console.error("[feishu-ws] WSClient failed to start:", err);
    });
}
