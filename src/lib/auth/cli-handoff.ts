import type { PublicUser } from "@/types/auth";
import {
  AUTH_SESSION_COOKIE,
  AUTH_SESSION_EXPIRES_COOKIE,
  AUTH_SESSION_SIGNATURE_COOKIE,
} from "./constants";

type SearchParamSource = Pick<URLSearchParams, "get">;

export interface CliHandoffParams {
  callbackUrl: string;
  nonce: string;
}

export interface CliSessionCookies {
  [AUTH_SESSION_COOKIE]: string;
  [AUTH_SESSION_EXPIRES_COOKIE]: string;
  [AUTH_SESSION_SIGNATURE_COOKIE]: string;
}

export interface CliSessionHandoffPayload {
  nonce: string;
  user: PublicUser | null;
  expiresAt: string;
  cookies: CliSessionCookies;
}

function getResponseError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }
  return fallback;
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[(.*)\]$/, "$1").toLowerCase();
}

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

export function parseCliHandoffParams(searchParams: SearchParamSource): CliHandoffParams | null {
  const callbackUrl = searchParams.get("cliCallback");
  const nonce = searchParams.get("cliNonce");

  if (!callbackUrl || !nonce?.trim()) {
    return null;
  }

  try {
    const parsed = new URL(callbackUrl);
    if (parsed.protocol !== "http:" || !parsed.port || !isLoopbackHostname(parsed.hostname)) {
      return null;
    }

    return {
      callbackUrl: parsed.toString(),
      nonce: nonce.trim(),
    };
  } catch {
    return null;
  }
}

export function buildAuthPageHref(basePath: string, searchParams: SearchParamSource): string {
  const url = new URL(basePath, "http://innoclaw.local");

  for (const key of ["next", "cliCallback", "cliNonce"]) {
    const value = searchParams.get(key);
    if (value?.trim()) {
      url.searchParams.set(key, value);
    }
  }

  return `${url.pathname}${url.search}`;
}

export function createCliSessionHandoffPayload(input: {
  nonce: string;
  user: PublicUser | null;
  token: string;
  expiresAt: string;
  signature: string;
}): CliSessionHandoffPayload {
  return {
    nonce: input.nonce,
    user: input.user,
    expiresAt: input.expiresAt,
    cookies: {
      [AUTH_SESSION_COOKIE]: input.token,
      [AUTH_SESSION_EXPIRES_COOKIE]: input.expiresAt,
      [AUTH_SESSION_SIGNATURE_COOKIE]: input.signature,
    },
  };
}

export async function completeCliBrowserHandoff(
  searchParams: SearchParamSource,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const handoff = parseCliHandoffParams(searchParams);
  if (!handoff) {
    return false;
  }

  const sessionResponse = await fetchImpl("/api/auth/cli-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nonce: handoff.nonce }),
  });
  const sessionPayload = await sessionResponse.json().catch(() => null);
  if (!sessionResponse.ok) {
    throw new Error(getResponseError(sessionPayload, "Failed to create CLI session"));
  }

  const callbackResponse = await fetchImpl(handoff.callbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sessionPayload),
  });
  const callbackPayload = await callbackResponse.json().catch(() => null);
  if (!callbackResponse.ok) {
    throw new Error(getResponseError(callbackPayload, "Failed to deliver CLI session"));
  }

  return true;
}
