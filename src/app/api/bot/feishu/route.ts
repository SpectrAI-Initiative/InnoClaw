/**
 * Feishu bot webhook endpoint.
 *
 * Receives event callbacks from Feishu (Lark), including:
 * - URL verification challenges
 * - Text and file messages
 * - Slash commands (/workspace, /status, /clear, /help, /mode)
 *
 * When a workspace is bound to the chat, text messages are routed through
 * the full agent pipeline with tool support. Otherwise, falls back to
 * simple AI chat via the unified bot processor.
 */

import { NextRequest, NextResponse } from "next/server";
import { getFeishuConfig } from "@/lib/bot/types";
import { createFeishuAdapter } from "@/lib/bot/feishu/client";
import { handleFeishuMessage } from "@/lib/bot/feishu/message-handler";

/** Simple in-memory set to deduplicate Feishu event re-deliveries (TTL 5min) */
const processedEvents = new Map<string, number>();
const EVENT_TTL = 5 * 60 * 1000;

// Sweep expired entries periodically instead of on every request
const _sweepTimer = setInterval(() => {
  const cutoff = Date.now() - EVENT_TTL;
  for (const [id, ts] of processedEvents) {
    if (ts < cutoff) processedEvents.delete(id);
  }
}, 60_000);
if (typeof _sweepTimer === "object" && "unref" in _sweepTimer) {
  _sweepTimer.unref();
}

function isDuplicateEvent(eventId: string): boolean {
  if (processedEvents.has(eventId)) return true;
  processedEvents.set(eventId, Date.now());
  return false;
}

export async function POST(req: NextRequest) {
  const config = getFeishuConfig();
  const adapter = createFeishuAdapter(config);

  if (!adapter.isEnabled()) {
    return NextResponse.json(
      { error: "Feishu bot is not enabled" },
      { status: 503 }
    );
  }

  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody) as Record<string, unknown>;

    // Verify webhook token from body (Feishu uses body-embedded tokens)
    if (!adapter.verifyWebhook({}, rawBody)) {
      console.warn("[feishu-webhook] Webhook verification failed");
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 403 }
      );
    }

    // Handle URL verification challenge
    if (body.type === "url_verification") {
      const challenge = body.challenge as string;
      console.log("[feishu-webhook] URL verification challenge received");
      return NextResponse.json({ challenge });
    }

    // Deduplicate events (Feishu may re-deliver on slow response)
    const header = body.header as Record<string, unknown> | undefined;
    const eventId = (header?.event_id as string) || "";
    if (eventId && isDuplicateEvent(eventId)) {
      console.log(`[feishu-webhook] Duplicate event ${eventId}, skipping`);
      return NextResponse.json({ ok: true });
    }

    // Parse messages
    const messages = adapter.parseMessages(body);

    if (messages.length === 0) {
      return NextResponse.json({ ok: true });
    }

    // Process messages asynchronously (don't block the webhook response).
    // Feishu requires a quick response to acknowledge receipt.
    for (const message of messages) {
      handleFeishuMessage(adapter, message, "[feishu-webhook]").catch((err) => {
        console.error("[feishu-webhook] Unhandled error in handleMessage:", err);
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[feishu-webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
