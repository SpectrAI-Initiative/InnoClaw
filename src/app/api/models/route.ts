import { NextRequest, NextResponse } from "next/server";

/**
 * Fetch available models from the configured provider's API.
 *
 * OpenAI-compatible services expose GET /v1/models (or /models when
 * OPENAI_BASE_URL already includes "/v1").
 * Anthropic exposes GET /v1/models.
 *
 * Query params:
 *   provider – "openai" | "anthropic" (default: "openai")
 */
export async function GET(request: NextRequest) {
  const provider =
    request.nextUrl.searchParams.get("provider") || "openai";

  try {
    if (provider === "anthropic") {
      return await fetchAnthropicModels();
    }
    // Default: OpenAI-compatible
    return await fetchOpenAIModels();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch models";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/* ------------------------------------------------------------------ */
/*  OpenAI-compatible                                                  */
/* ------------------------------------------------------------------ */

async function fetchOpenAIModels() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 400 },
    );
  }

  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1")
    .replace(/\/+$/, "");

  // Ensure the URL ends with /models
  const modelsUrl = baseUrl.endsWith("/v1")
    ? `${baseUrl}/models`
    : `${baseUrl}/v1/models`;

  const res = await fetch(modelsUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Provider returned ${res.status}` },
      { status: 502 },
    );
  }

  const json = await res.json();
  const models = formatOpenAIModels(json);

  return NextResponse.json({ models });
}

/**
 * Parse the standard OpenAI /v1/models response into a flat list.
 */
function formatOpenAIModels(json: {
  data?: Array<{ id: string; owned_by?: string }>;
}) {
  if (!Array.isArray(json.data)) return [];
  return json.data
    .map((m) => ({ id: m.id, name: m.id }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/* ------------------------------------------------------------------ */
/*  Anthropic                                                          */
/* ------------------------------------------------------------------ */

async function fetchAnthropicModels() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 400 },
    );
  }

  const rawBase = process.env.ANTHROPIC_BASE_URL;
  let baseUrl = rawBase
    ? rawBase.replace(/\/+$/, "")
    : "https://api.anthropic.com";

  // Normalize: ensure base does NOT end with /v1 for Anthropic
  if (baseUrl.endsWith("/v1")) {
    baseUrl = baseUrl.slice(0, -3);
  }

  const modelsUrl = `${baseUrl}/v1/models`;

  const res = await fetch(modelsUrl, {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Provider returned ${res.status}` },
      { status: 502 },
    );
  }

  const json = await res.json();
  const models = formatAnthropicModels(json);

  return NextResponse.json({ models });
}

/**
 * Parse Anthropic /v1/models response.
 * Anthropic returns { data: [{ id, display_name, ... }] }
 */
function formatAnthropicModels(json: {
  data?: Array<{ id: string; display_name?: string }>;
}) {
  if (!Array.isArray(json.data)) return [];
  return json.data
    .map((m) => ({ id: m.id, name: m.display_name || m.id }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
