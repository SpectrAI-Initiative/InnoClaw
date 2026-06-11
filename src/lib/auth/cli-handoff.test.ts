import { describe, expect, it } from "vitest";
import {
  AUTH_SESSION_COOKIE,
  AUTH_SESSION_EXPIRES_COOKIE,
  AUTH_SESSION_SIGNATURE_COOKIE,
} from "./constants";
import {
  buildAuthPageHref,
  createCliSessionHandoffPayload,
  isLoopbackHostname,
  parseCliHandoffParams,
} from "./cli-handoff";

describe("cli-handoff", () => {
  it("recognizes supported loopback hostnames", () => {
    expect(isLoopbackHostname("localhost")).toBe(true);
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
    expect(isLoopbackHostname("::1")).toBe(true);
    expect(isLoopbackHostname("[::1]")).toBe(true);
    expect(isLoopbackHostname("example.com")).toBe(false);
  });

  it("parses cli handoff params for a loopback callback", () => {
    const params = new URLSearchParams({
      cliCallback: "http://127.0.0.1:43123/callback",
      cliNonce: "nonce-123",
      next: "/workspace",
    });

    expect(parseCliHandoffParams(params)).toEqual({
      callbackUrl: "http://127.0.0.1:43123/callback",
      nonce: "nonce-123",
    });
  });

  it("rejects cli handoff params for non-loopback callbacks", () => {
    const params = new URLSearchParams({
      cliCallback: "http://example.com:43123/callback",
      cliNonce: "nonce-123",
    });

    expect(parseCliHandoffParams(params)).toBeNull();
  });

  it("preserves auth handoff query params when switching auth pages", () => {
    const params = new URLSearchParams({
      next: "/",
      cliCallback: "http://localhost:43123/callback",
      cliNonce: "nonce-456",
    });

    expect(buildAuthPageHref("/register", params)).toBe(
      "/register?next=%2F&cliCallback=http%3A%2F%2Flocalhost%3A43123%2Fcallback&cliNonce=nonce-456",
    );
  });

  it("creates a CLI session payload with the auth cookie triple", () => {
    const payload = createCliSessionHandoffPayload({
      nonce: "nonce-789",
      user: {
        id: "user-1",
        email: "user@example.com",
        name: "User",
        role: "user",
        isActive: true,
        lastLoginAt: null,
        createdAt: "2026-05-20T00:00:00.000Z",
        updatedAt: "2026-05-20T00:00:00.000Z",
      },
      token: "token-123",
      expiresAt: "2026-06-20T00:00:00.000Z",
      signature: "sig-123",
    });

    expect(payload).toEqual({
      nonce: "nonce-789",
      user: expect.objectContaining({ id: "user-1", email: "user@example.com" }),
      expiresAt: "2026-06-20T00:00:00.000Z",
      cookies: {
        [AUTH_SESSION_COOKIE]: "token-123",
        [AUTH_SESSION_EXPIRES_COOKIE]: "2026-06-20T00:00:00.000Z",
        [AUTH_SESSION_SIGNATURE_COOKIE]: "sig-123",
      },
    });
  });
});
