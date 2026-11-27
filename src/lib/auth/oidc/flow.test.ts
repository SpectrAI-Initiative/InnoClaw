import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { NextRequest } from "next/server";
import { digest, OIDC_COOKIE } from "./protocol";
import { AUTH_SESSION_COOKIE } from "../constants";
import { getOidcConfig, validateEndpoint } from "./config";
import { verifyPassword } from "../password";

let server: Server;
let issuer: string;
let privateKey: CryptoKey;
let otherKey: CryptoKey;
let sqlite: typeof import("@/lib/db").sqlite;
let handlers: typeof import("./http");
let repo: typeof import("./repository");
const codes = new Map<string, URLSearchParams>();
const profiles = new Map<string, { sub: string; email: string }>();
let discoveryDisabled = false;
const directory = mkdtempSync(join(tmpdir(), "innoscale-oidc-test-"));
let sequence = 0;

beforeAll(async () => {
  const keys = await generateKeyPair("RS256");
  privateKey = keys.privateKey;
  otherKey = (await generateKeyPair("RS256")).privateKey;
  const jwk = { ...await exportJWK(keys.publicKey), kid: "test", alg: "RS256", use: "sig" };
  server = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/.well-known/openid-configuration") {
      if (discoveryDisabled) { response.writeHead(404).end(); return; }
      response.end(JSON.stringify({ issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`, userinfo_endpoint: `${issuer}/userinfo` })); return;
    }
    if (request.url === "/jwks" || request.url === "/oauth2/jwks") { response.end(JSON.stringify({ keys: [jwk] })); return; }
    const bearer = (request.headers.authorization ?? "").replace(/^Bearer /, "");
    if (request.url === "/userinfo" || request.url === "/oauth2/userinfo") {
      const profile = profiles.get(bearer);
      if (!profile) { response.writeHead(401).end(JSON.stringify({ error: "invalid_token" })); return; }
      response.end(JSON.stringify({ ...profile, name: "Portal Researcher", email_verified: "true" })); return;
    }
    if (request.url !== "/token" && request.url !== "/oauth2/token") { response.writeHead(404).end(); return; }
    let body = "";
    for await (const chunk of request) body += chunk;
    const values = new URLSearchParams(body);
    const code = values.get("code") || "";
    const auth = codes.get(code);
    codes.delete(code);
    if (!auth || digest(values.get("code_verifier") || "") !== auth.get("code_challenge") ||
      values.get("client_secret") !== "test-client-secret" || values.get("redirect_uri") !== "http://localhost:3000/api/auth/oidc/callback") {
      response.writeHead(400).end(JSON.stringify({ error: "invalid_grant" })); return;
    }
    const scenario = code.split(":")[0];
    const subject = ["repeat", "inactive"].includes(scenario) ? "stable-subject" : code;
    const email = ["repeat", "inactive"].includes(scenario) ? "stable@example.com" : scenario === "collision" ? "local@example.com" : `${code.replace(/:/g, "-")}@example.com`;
    profiles.set(code, { sub: scenario === "submismatch" ? "other-subject" : subject, email });
    const token = await new SignJWT({ nonce: scenario === "nonce" ? "wrong" : scenario === "no-nonce" ? undefined : auth.get("nonce"),
      ...(scenario === "profile" || scenario === "submismatch" ? {} : { email, email_verified: scenario !== "unverified" }),
      name: "Test Researcher", role: "admin",
      ...(scenario === "azp" ? { azp: "wrong-client" } : {}) })
      .setProtectedHeader({ alg: "RS256", kid: "test" }).setSubject(subject)
      .setIssuer(scenario === "issuer" ? "https://wrong.example" : issuer)
      .setAudience(scenario === "audience" ? "wrong-client" : "test-client")
      .setIssuedAt().setExpirationTime(scenario === "expired" ? Math.floor(Date.now() / 1000) - 60 : "5m")
      .sign(scenario === "signature" ? otherKey : privateKey);
    response.end(JSON.stringify({ id_token: token, access_token: code }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  issuer = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  vi.stubEnv("DATABASE_URL", join(directory, "test.db"));
  vi.stubEnv("AUTH_OIDC_ENABLED", "true"); vi.stubEnv("AUTH_OIDC_ALLOW_HTTP", "true");
  vi.stubEnv("AUTH_OIDC_ISSUER", issuer); vi.stubEnv("AUTH_OIDC_CLIENT_ID", "test-client");
  vi.stubEnv("AUTH_OIDC_CLIENT_SECRET", "test-client-secret");
  vi.stubEnv("AUTH_OIDC_REDIRECT_URI", "http://localhost:3000/api/auth/oidc/callback");
  vi.stubEnv("AUTH_SECRET", "a".repeat(48)); vi.stubEnv("AUTH_MODE", "local");
  vi.stubEnv("AUTH_SINGLE_ADMIN", "false"); vi.stubEnv("AUTH_COOKIE_SECURE", "false");
  sqlite = (await import("@/lib/db")).sqlite;
  sqlite.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    password_hash TEXT NOT NULL, role TEXT NOT NULL, is_active INTEGER NOT NULL, last_login_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE user_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL, last_seen_at TEXT, revoked_at TEXT, created_at TEXT NOT NULL);`);
  sqlite.exec(readFileSync("drizzle/0018_oidc_identity.sql", "utf8"));
  handlers = await import("./http"); repo = await import("./repository");
});

afterAll(async () => {
  sqlite?.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true });
});

async function begin(scenario = "ok", next = "/") {
  const response = await handlers.startOidc(new NextRequest(`http://localhost:3000/api/auth/oidc/start?next=${encodeURIComponent(next)}`));
  expect(response.status).toBe(307);
  const authorization = new URL(response.headers.get("location")!);
  expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
  const binding = response.cookies.get(OIDC_COOKIE)!.value;
  const state = authorization.searchParams.get("state")!;
  const code = `${scenario}:${++sequence}`;
  codes.set(code, authorization.searchParams);
  const callback = (cookie = binding, suppliedState = state) => handlers.callbackOidc(new NextRequest(
    `http://localhost:3000/api/auth/oidc/callback?code=${code}&state=${suppliedState}`,
    { headers: { cookie: `${OIDC_COOKIE}=${cookie}` } }));
  return { callback, state, binding, response };
}

describe("OneID local end-to-end flow", () => {
  it("creates a regular user and a local session, rejecting password login", async () => {
    const flow = await begin(); const response = await flow.callback();
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
    expect(response.cookies.get(AUTH_SESSION_COOKIE)?.value).toBeTruthy();
    expect(response.cookies.get(OIDC_COOKIE)?.value).toBe("");
    const user = sqlite.prepare("SELECT * FROM users LIMIT 1").get() as { role: string; password_hash: string };
    expect(user.role).toBe("user"); expect(verifyPassword("anything", user.password_hash)).toBe(false);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await flow.callback()).headers.get("location")).toBe("/login?oidc_error=1");
  });
  it("requires the initiating browser and state", async () => {
    const flow = await begin();
    expect((await flow.callback("wrong")).cookies.get(AUTH_SESSION_COOKIE)).toBeUndefined();
    expect((await flow.callback(flow.binding, "wrong")).cookies.get(AUTH_SESSION_COOKIE)).toBeUndefined();
    expect((await flow.callback()).cookies.get(AUTH_SESSION_COOKIE)?.value).toBeTruthy();
  });
  it.each(["signature", "nonce", "issuer", "audience", "expired", "unverified", "azp"])("rejects %s tokens without creating a session", async (scenario) => {
    const before = sqlite.prepare("SELECT count(*) AS n FROM users").get();
    const response = await (await begin(scenario)).callback();
    expect(response.headers.get("location")).toBe("/login?oidc_error=1");
    expect(response.cookies.get(AUTH_SESSION_COOKIE)).toBeUndefined();
    expect(sqlite.prepare("SELECT count(*) AS n FROM users").get()).toEqual(before);
  });
  it("keeps a stable user ID and refuses inactive users", async () => {
    await (await begin("repeat")).callback();
    const before = sqlite.prepare("SELECT count(*) AS n FROM users").get();
    await (await begin("repeat")).callback();
    expect(sqlite.prepare("SELECT count(*) AS n FROM users").get()).toEqual(before);
    sqlite.prepare("UPDATE users SET is_active=0 WHERE email=?").run("stable@example.com");
    expect((await (await begin("inactive")).callback()).cookies.get(AUTH_SESSION_COOKIE)).toBeUndefined();
  });
  it("does not link by matching email", async () => {
    sqlite.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run("local", "local@example.com", "Local", "hash", "admin", 1, null, "now", "now");
    expect((await (await begin("collision")).callback()).cookies.get(AUTH_SESSION_COOKIE)).toBeUndefined();
    expect(sqlite.prepare("SELECT * FROM oidc_identities WHERE user_id='local'").get()).toBeUndefined();
  });
  it("rejects expired transactions and atomically consumes only once", async () => {
    const flow = await begin();
    sqlite.prepare("UPDATE oidc_transactions SET expires_at=0 WHERE state_hash=?").run(digest(flow.state));
    expect((await flow.callback()).cookies.get(AUTH_SESSION_COOKIE)).toBeUndefined();
    const second = await begin();
    const results = await Promise.all([repo.oidcRepository.consume(digest(second.state), digest(second.binding)), repo.oidcRepository.consume(digest(second.state), digest(second.binding))]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
  it.each(["https://evil.example", "//evil.example", "/admin/users"])("prevents unsafe return destination %s", async (destination) => {
    expect((await (await begin("ok", destination)).callback()).headers.get("location")).toBe("http://localhost:3000/");
  });
  it("keeps independently authenticated users in separate local sessions", async () => {
    const a = await (await begin()).callback();
    const b = await (await begin()).callback();
    const { getAuthContext } = await import("../server");
    const context = (token: string) => getAuthContext(new NextRequest("http://localhost:3000/api/auth/me", {
      headers: { cookie: `${AUTH_SESSION_COOKIE}=${token}` },
    }));
    const userA = await context(a.cookies.get(AUTH_SESSION_COOKIE)!.value);
    const userB = await context(b.cookies.get(AUTH_SESSION_COOKIE)!.value);
    expect(userA?.user.id).toBeTruthy();
    expect(userB?.user.id).toBeTruthy();
    expect(userA?.user.id).not.toBe(userB?.user.id);
    expect(await context("invalid-session")).toBeNull();
  });
  it("consumes cancelled login attempts without a session", async () => {
    const flow = await begin();
    const response = await handlers.callbackOidc(new NextRequest(
      `http://localhost:3000/api/auth/oidc/callback?error=access_denied&state=${flow.state}`,
      { headers: { cookie: `${OIDC_COOKIE}=${flow.binding}` } },
    ));
    expect(response.cookies.get(AUTH_SESSION_COOKIE)).toBeUndefined();
    expect(await repo.oidcRepository.consume(digest(flow.state), digest(flow.binding))).toBeNull();
  });
  it("defaults off and blocks disabled or single-admin auth", async () => {
    for (const key of ["AUTH_MODE", "AUTH_SINGLE_ADMIN", "AUTH_OIDC_ENABLED"]) {
      const old = process.env[key]; process.env[key] = key === "AUTH_MODE" ? "disabled" : key === "AUTH_SINGLE_ADMIN" ? "true" : "false";
      const response = await handlers.startOidc(new NextRequest("http://localhost:3000/api/auth/oidc/start"));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/login?oidc_unavailable=1");
      process.env[key] = old;
    }
  });
  it("requires secure remote endpoints and explicit configuration", () => {
    expect(() => validateEndpoint("http://example.com/token", true)).toThrow();
    expect(() => validateEndpoint("https://user:pass@example.com", false)).toThrow();
    expect(() => validateEndpoint("http://localhost:4000", false)).toThrow();
    expect(getOidcConfig()?.issuer).toBe(issuer);
  });
});

// OneID publishes /oauth2/* paths and no discovery document, and returns the
// profile from /userinfo instead of the ID token.
describe("OneID explicit endpoint mode", () => {
  let portal: Record<string, string>;
  let saved: Record<string, string | undefined>;

  beforeAll(() => {
    discoveryDisabled = true;
    // Built here because issuer is only known once the mock portal is listening.
    portal = {
      AUTH_OIDC_AUTHORIZE_URL: `${issuer}/oauth2/authorize`,
      AUTH_OIDC_TOKEN_URL: `${issuer}/oauth2/token`,
      AUTH_OIDC_JWKS_URL: `${issuer}/oauth2/jwks`,
      AUTH_OIDC_USERINFO_URL: `${issuer}/oauth2/userinfo`,
    };
    saved = {};
    for (const [key, value] of Object.entries(portal)) { saved[key] = process.env[key]; process.env[key] = value; }
  });
  afterAll(() => {
    discoveryDisabled = false;
    delete process.env.AUTH_OIDC_SCOPE;
    for (const key of Object.keys(portal)) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  });

  it("logs in without a discovery document and reads the profile from userinfo", async () => {
    const flow = await begin("profile");
    expect(new URL(flow.response.headers.get("location")!).pathname).toBe("/oauth2/authorize");
    expect(new URL(flow.response.headers.get("location")!).searchParams.get("scope")).toBe("openid");
    const response = await flow.callback();
    expect(response.cookies.get(AUTH_SESSION_COOKIE)?.value).toBeTruthy();
    // The email only exists on /userinfo, so reaching this row proves it was read.
    const user = sqlite.prepare("SELECT name FROM users WHERE email=?").get(`profile-${sequence}@example.com`);
    expect(user).toEqual({ name: "Test Researcher" });
  });

  it("rejects a userinfo subject that disagrees with the ID token", async () => {
    const before = sqlite.prepare("SELECT count(*) AS n FROM users").get();
    expect((await (await begin("submismatch")).callback()).cookies.get(AUTH_SESSION_COOKIE)).toBeUndefined();
    expect(sqlite.prepare("SELECT count(*) AS n FROM users").get()).toEqual(before);
  });

  it("honours the nonce and verified-email switches without weakening defaults", async () => {
    const missingNonce = await (await begin("no-nonce")).callback();
    expect(missingNonce.cookies.get(AUTH_SESSION_COOKIE)).toBeUndefined();
    process.env.AUTH_OIDC_REQUIRE_NONCE = "false";
    expect((await (await begin("no-nonce")).callback()).cookies.get(AUTH_SESSION_COOKIE)).toBeTruthy();
    process.env.AUTH_OIDC_REQUIRE_NONCE = "true";

    expect((await (await begin("unverified")).callback()).cookies.get(AUTH_SESSION_COOKIE)).toBeUndefined();
    process.env.AUTH_OIDC_REQUIRE_EMAIL_VERIFIED = "false";
    expect((await (await begin("unverified")).callback()).cookies.get(AUTH_SESSION_COOKIE)).toBeTruthy();
    process.env.AUTH_OIDC_REQUIRE_EMAIL_VERIFIED = "true";
  });

  it("refuses a partial endpoint set and validates every configured URL", () => {
    const jwks = process.env.AUTH_OIDC_JWKS_URL;
    delete process.env.AUTH_OIDC_JWKS_URL;
    expect(() => getOidcConfig()).toThrow(/requires authorize, token and jwks/);
    process.env.AUTH_OIDC_JWKS_URL = jwks;

    process.env.AUTH_OIDC_TOKEN_URL = "http://evil.example/token";
    expect(() => getOidcConfig()).toThrow(/require HTTPS/);
    process.env.AUTH_OIDC_TOKEN_URL = portal.AUTH_OIDC_TOKEN_URL;

    process.env.AUTH_OIDC_SCOPE = "openid profile email";
    expect(getOidcConfig()?.scope).toBe("openid profile email");
  });
});
