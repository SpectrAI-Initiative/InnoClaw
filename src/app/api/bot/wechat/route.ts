/**
 * WeChat (Enterprise WeChat / 企业微信) bot webhook endpoint.
 *
 * Receives event callbacks from Enterprise WeChat, including:
 * - URL verification (echostr)
 * - Text and file messages
 *
 * Processes messages through the unified bot processor and replies
 * via the WeChat API.
 */

import { NextRequest, NextResponse } from "next/server";
import { getWechatConfig } from "@/lib/bot/types";
import { createWechatAdapter } from "@/lib/bot/wechat/client";
import { processMessage, sendReplies } from "@/lib/bot/processor";

/**
 * GET handler for WeChat URL verification.
 * WeChat sends a GET request with msg_signature, timestamp, nonce, echostr
 * to verify the webhook URL.
 */
export async function GET(req: NextRequest) {
  const config = getWechatConfig();
  const adapter = createWechatAdapter(config);

  if (!adapter.isEnabled()) {
    return new Response("WeChat bot is not enabled", { status: 503 });
  }

  const searchParams = req.nextUrl.searchParams;
  const echostr = searchParams.get("echostr") || "";
  const msgSignature = searchParams.get("msg_signature") || "";
  const signature = searchParams.get("signature") || "";
  const timestamp = searchParams.get("timestamp") || "";
  const nonce = searchParams.get("nonce") || "";

  const headers: Record<string, string> = {
    timestamp,
    nonce,
    ...(msgSignature ? { msg_signature: msgSignature } : {}),
    ...(signature ? { signature } : {}),
  };

  if (!adapter.verifyWebhook(headers, echostr)) {
    console.warn("[wechat-webhook] URL verification failed");
    return new Response("Verification failed", { status: 403 });
  }

  console.log("[wechat-webhook] URL verification successful");
  return new Response(echostr, {
    headers: { "Content-Type": "text/plain" },
  });
}

/**
 * POST handler for incoming WeChat messages.
 */
export async function POST(req: NextRequest) {
  const config = getWechatConfig();
  const adapter = createWechatAdapter(config);

  if (!adapter.isEnabled()) {
    return NextResponse.json(
      { error: "WeChat bot is not enabled" },
      { status: 503 }
    );
  }

  try {
    // Read body first so we can include it in signature verification
    const rawBody = await req.text();

    // Verify webhook signature from query params
    const searchParams = req.nextUrl.searchParams;
    const msgSignature = searchParams.get("msg_signature") || "";
    const signature = searchParams.get("signature") || "";
    const timestamp = searchParams.get("timestamp") || "";
    const nonce = searchParams.get("nonce") || "";

    const headers: Record<string, string> = {
      timestamp,
      nonce,
      ...(msgSignature ? { msg_signature: msgSignature } : {}),
      ...(signature ? { signature } : {}),
    };

    if (!adapter.verifyWebhook(headers, rawBody)) {
      console.warn("[wechat-webhook] Webhook verification failed");
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 403 }
      );
    }

    let body: Record<string, unknown>;

    // WeChat can send XML or JSON depending on configuration
    // For simplicity, we expect JSON mode or pre-parsed XML
    try {
      body = JSON.parse(rawBody);
    } catch {
      // Basic XML parsing for common fields
      body = parseSimpleXml(rawBody);
    }

    // Parse messages
    const messages = adapter.parseMessages(body);

    if (messages.length === 0) {
      return new Response("success", {
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Process messages asynchronously.
    // Note: This relies on the Node.js runtime keeping the process alive
    // after the response. In serverless/edge environments, consider using
    // a durable queue (e.g., Vercel Background Functions) instead.
    for (const message of messages) {
      (async () => {
        try {
          console.log(
            `[wechat-webhook] Processing ${message.type} message from ${message.senderId}`
          );
          const replies = await processMessage(adapter, message);
          await sendReplies(adapter, message.chatId, replies);
        } catch (error) {
          console.error("[wechat-webhook] Async processing error:", error);
        }
      })();
    }

    // WeChat expects "success" as acknowledgement
    return new Response("success", {
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error("[wechat-webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Very basic XML tag extractor for WeChat callback messages.
 * Handles simple <Tag>value</Tag> patterns without nesting.
 */
function parseSimpleXml(xml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const tagPattern = /<(\w+)><!\[CDATA\[(.*?)\]\]><\/\1>|<(\w+)>(.*?)<\/\3>/g;

  let match;
  while ((match = tagPattern.exec(xml)) !== null) {
    const key = match[1] || match[3];
    const value = match[2] ?? match[4] ?? "";
    // Try to parse as number if it looks like one
    const num = Number(value);
    result[key] = !isNaN(num) && value.length > 0 && !/\s/.test(value)
      ? num
      : value;
  }

  return result;
}
