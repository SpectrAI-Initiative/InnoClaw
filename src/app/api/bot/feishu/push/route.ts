/**
 * Feishu push API endpoint.
 *
 * Allows the web agent panel (or any internal caller) to push messages
 * and interactive cards to a Feishu chat. Enables bidirectional
 * communication between the web UI and Feishu.
 *
 * POST /api/bot/feishu/push
 * Body: { chatId: string, title?: string, content: string, type?: "text" | "card" }
 */

import { NextRequest, NextResponse } from "next/server";
import { getFeishuConfig } from "@/lib/bot/types";
import { createFeishuAdapter } from "@/lib/bot/feishu/client";

export async function POST(req: NextRequest) {
  // Authenticate the request using a shared secret
  const expectedSecret = process.env.FEISHU_PUSH_SECRET;
  if (!expectedSecret) {
    console.error(
      "[feishu-push] Missing FEISHU_PUSH_SECRET; refusing unauthenticated access.",
    );
    return NextResponse.json(
      { error: "Feishu push endpoint is not configured" },
      { status: 503 },
    );
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const providedSecret = authHeader.slice(7).trim();
  if (providedSecret !== expectedSecret) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const config = getFeishuConfig();
  const adapter = createFeishuAdapter(config);

  if (!adapter.isEnabled()) {
    return NextResponse.json(
      { error: "Feishu bot is not enabled" },
      { status: 503 }
    );
  }

  const expectedSecret = process.env.FEISHU_PUSH_SECRET;
  if (!expectedSecret) {
    console.error(
      "[feishu-push] Missing FEISHU_PUSH_SECRET; refusing unauthenticated access.",
    );
    return NextResponse.json(
      { error: "Feishu push endpoint is not configured" },
      { status: 503 },
    );
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const providedSecret = authHeader.slice(7).trim();
  if (providedSecret !== expectedSecret) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }
  try {
    const { chatId, title, content, type = "card" } = await req.json();

    if (!chatId || typeof chatId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid chatId" },
        { status: 400 }
      );
    }

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid content" },
        { status: 400 }
      );
    }

    if (type === "text") {
      await adapter.sendText(chatId, content);
      return NextResponse.json({ ok: true });
    }

    // Default: send as interactive card
    if (!adapter.sendInteractiveCard) {
      // Fallback to text if card method not available
      await adapter.sendText(chatId, content);
      return NextResponse.json({ ok: true });
    }

    const card = {
      config: { wide_screen_mode: true },
      header: {
        title: {
          content: title || "Agent Message",
          tag: "plain_text" as const,
        },
        template: "blue",
      },
      elements: [
        {
          tag: "div",
          text: { content, tag: "lark_md" },
        },
      ],
    };

    const messageId = await adapter.sendInteractiveCard(chatId, card);
    return NextResponse.json({ ok: true, messageId });
  } catch (error) {
    console.error("[feishu-push] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
