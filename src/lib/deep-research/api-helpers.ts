import { NextResponse } from "next/server";
import { getConfiguredModelSelection } from "@/lib/ai/provider";
import { getSession, updateSession } from "./event-store";
import {
  buildDeepResearchConfigForResolvedModel,
  hasDeepResearchModelConfigDrift,
} from "./model-overrides";
import type { DeepResearchSession } from "./types";

export class DeepResearchApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DeepResearchApiError";
  }
}

export type DeepResearchRouteParams = { params: Promise<{ id: string }> };

export function badRequest(message: string): never {
  throw new DeepResearchApiError(message, 400);
}

export function conflict(message: string): never {
  throw new DeepResearchApiError(message, 409);
}

export async function readSessionId(params: DeepResearchRouteParams["params"]): Promise<string> {
  return (await params).id;
}

export async function requireSession(sessionId: string): Promise<DeepResearchSession> {
  let session = await getSession(sessionId);
  if (!session) {
    throw new DeepResearchApiError("Session not found", 404);
  }

  if (session.config.interfaceOnly !== true) {
    const configuredModel = await getConfiguredModelSelection();
    const resolvedModel = {
      provider: configuredModel.providerId,
      modelId: configuredModel.modelId,
    };
    const nextConfig = buildDeepResearchConfigForResolvedModel(session.config, resolvedModel);
    const needsModelSync = hasDeepResearchModelConfigDrift(session.config, nextConfig);

    if (needsModelSync) {
      await updateSession(sessionId, {
        config: nextConfig,
      });
      session = await getSession(sessionId);
      if (!session) {
        throw new DeepResearchApiError("Session not found", 404);
      }
    }
  }

  return session;
}

export function parseRequiredString(value: unknown, message: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    badRequest(message);
  }
  return value.trim();
}

export function parseOptionalString(value: unknown, message: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    badRequest(message);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
}

export function parseNullableString(
  value: unknown,
  message: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return parseOptionalString(value, message);
}

export function parseOptionalRecord(
  value: unknown,
  message: string,
): Record<string, unknown> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    badRequest(message);
  }
  return value;
}

export function parseOptionalStringArray(value: unknown, message: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    badRequest(message);
  }
  return value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function handleDeepResearchRouteError(
  error: unknown,
  fallbackMessage: string,
): NextResponse {
  if (error instanceof DeepResearchApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : fallbackMessage;
  return NextResponse.json({ error: message }, { status: 500 });
}
