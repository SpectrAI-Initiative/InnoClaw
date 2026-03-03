/**
 * Feishu bot webhook endpoint.
 *
 * Receives event callbacks from Feishu (Lark), including:
 * - URL verification challenges
 * - Text and file messages
 *
 * Processes messages through the unified bot processor and replies
 * via the Feishu API.
 */

import { NextRequest, NextResponse } from "next/server";
import { getFeishuConfig } from "@/lib/bot/types";
import { createFeishuAdapter } from "@/lib/bot/feishu/client";
import { processMessage, sendReplies } from "@/lib/bot/processor";

/** Simple in-memory set to deduplicate Feishu event re-deliveries (TTL 5min) */
const processedEvents = new Map<string, number>();
const EVENT_TTL = 5 * 60 * 1000;

function isDuplicateEvent(eventId: string): boolean {
  // Clean expired entries
  const now = Date.now();
  for (const [id, ts] of processedEvents) {
    if (now - ts > EVENT_TTL) processedEvents.delete(id);
  }
  if (processedEvents.has(eventId)) return true;
  processedEvents.set(eventId, now);
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
    // Note: This relies on the Node.js runtime keeping the process alive
    // after the response. In serverless/edge environments, consider using
    // a durable queue (e.g., Vercel Background Functions) instead.
    for (const message of messages) {
      (async () => {
        try {
          console.log(
            `[feishu-webhook] Processing ${message.type} message from ${message.senderId}`
          );
          const replies = await processMessage(adapter, message);
          await sendReplies(adapter, message.chatId, replies);
        } catch (error) {
          console.error("[feishu-webhook] Async processing error:", error);
        }
      })();
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
