import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { validateEndpoint, type OidcConfig } from "./config";

export const OIDC_COOKIE = "INNOSCALE_oidc_binding";
export const TRANSACTION_SECONDS = 600;
export const digest = (value: string) => createHash("sha256").update(value).digest("base64url");
export const randomValue = () => randomBytes(32).toString("base64url");
export interface Identity { issuer: string; subject: string; email: string; name: string }
export interface Transaction {
  stateHash: string; bindingHash: string; nonce: string; verifier: string;
  returnTo: string; expiresAt: number;
}
interface Metadata {
  issuer: string; authorization_endpoint: string; token_endpoint: string;
  jwks_uri: string; userinfo_endpoint?: string;
}

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, { ...init, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Identity provider request failed");
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid identity provider response");
  return body as Record<string, unknown>;
}

export async function resolveMetadata(config: OidcConfig): Promise<Metadata> {
  if (config.endpoints) return {
    issuer: config.issuer,
    authorization_endpoint: config.endpoints.authorization,
    token_endpoint: config.endpoints.token,
    jwks_uri: config.endpoints.jwks,
    ...(config.endpoints.userinfo ? { userinfo_endpoint: config.endpoints.userinfo } : {}),
  };
  const data = await fetchJson(`${config.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`);
  if (data.issuer !== config.issuer) throw new Error("Identity provider issuer mismatch");
  for (const field of ["authorization_endpoint", "token_endpoint", "jwks_uri"] as const) {
    if (typeof data[field] !== "string") throw new Error("Incomplete OIDC discovery metadata");
    validateEndpoint(data[field], config.allowHttp);
  }
  if (data.userinfo_endpoint !== undefined) {
    if (typeof data.userinfo_endpoint !== "string") throw new Error("Incomplete OIDC discovery metadata");
    validateEndpoint(data.userinfo_endpoint, config.allowHttp);
  }
  return data as unknown as Metadata;
}

export function authorizationUrl(config: OidcConfig, metadata: Metadata, state: string, tx: Transaction): string {
  const url = new URL(metadata.authorization_endpoint);
  for (const [key, value] of Object.entries({
    client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code",
    scope: config.scope, response_mode: "query", state, nonce: tx.nonce,
    code_challenge: digest(tx.verifier), code_challenge_method: "S256",
  })) url.searchParams.set(key, value);
  return url.toString();
}

async function userInfo(config: OidcConfig, metadata: Metadata, accessToken: string, subject: string) {
  if (!metadata.userinfo_endpoint) return null;
  const claims = await fetchJson(metadata.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // OIDC Core: a userinfo response that disagrees with the ID token subject is rejected.
  if (typeof claims.sub !== "string" || claims.sub.length > 255 || claims.sub !== subject) {
    throw new Error("Invalid user info response");
  }
  return claims;
}

const emailClaim = (value: unknown) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  && value.length <= 320 ? value.trim().toLowerCase() : undefined;

export async function exchange(config: OidcConfig, code: string, tx: Transaction): Promise<Identity> {
  const metadata = await resolveMetadata(config);
  const tokens = await fetchJson(metadata.token_endpoint, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, code_verifier: tx.verifier,
      client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri }),
  });
  if (typeof tokens.id_token !== "string") throw new Error("Missing ID token");
  const { payload } = await jwtVerify(tokens.id_token,
    createRemoteJWKSet(new URL(metadata.jwks_uri), { timeoutDuration: 10000 }), {
      issuer: config.issuer, audience: config.clientId, algorithms: ["RS256"],
      requiredClaims: config.requireNonce ? ["sub", "iat", "exp", "nonce"] : ["sub", "iat", "exp"],
      clockTolerance: 5, maxTokenAge: "10m",
    });
  if (payload.nonce !== undefined && payload.nonce !== tx.nonce) throw new Error("Invalid ID token claims");
  if (!payload.sub || payload.sub.length > 255 ||
      (payload.azp !== undefined && payload.azp !== config.clientId) ||
      (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== config.clientId)) {
    throw new Error("Invalid ID token claims");
  }
  if (payload.at_hash !== undefined) {
    if (typeof tokens.access_token !== "string" || payload.at_hash !== createHash("sha256")
      .update(tokens.access_token).digest().subarray(0, 16).toString("base64url")) {
      throw new Error("Invalid access token hash");
    }
  }
  let email = emailClaim(payload.email);
  let verified = payload.email_verified === true || payload.email_verified === "true";
  let name = typeof payload.name === "string" ? payload.name : undefined;
  // OneID returns the profile from /userinfo rather than in the ID token. An email
  // claim already present in the ID token stays authoritative.
  if (!email && typeof tokens.access_token === "string") {
    const claims = await userInfo(config, metadata, tokens.access_token, payload.sub);
    if (claims) {
      email = emailClaim(claims.email) ?? email;
      if (claims.email_verified === true || claims.email_verified === "true") verified = true;
      name = name ?? (typeof claims.name === "string" ? claims.name : undefined);
    }
  }
  // Never bind a local account using a malformed email or a provider-supplied role.
  if (!email || (config.requireEmailVerified && !verified)) {
    throw new Error("A verified email claim is required");
  }
  return { issuer: config.issuer, subject: payload.sub, email,
    name: (name ?? "Researcher").slice(0, 200) };
}
