import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  AUTH_SESSION_COOKIE,
  AUTH_SESSION_EXPIRES_COOKIE,
  AUTH_SESSION_SIGNATURE_COOKIE,
} from "./constants";
import {
  buildAuthPageHref,
  completeCliBrowserHandoff,
  createCliSessionHandoffPayload,
  isLoopbackHostname,
  parseCliHandoffParams,
} from "./cli-handoff";

const originalAuthMode = process.env.AUTH_MODE;

afterEach(() => {
  if (originalAuthMode === undefined) {
    delete process.env.AUTH_MODE;
  } else {
    process.env.AUTH_MODE = originalAuthMode;
  }
});

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

  it("returns false without cli handoff params", async () => {
    const fetchMock = vi.fn();

    await expect(completeCliBrowserHandoff(new URLSearchParams(), fetchMock)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("completes the CLI browser handoff", async () => {
    const params = new URLSearchParams({
      cliCallback: "http://127.0.0.1:43123/callback",
      cliNonce: "nonce-123",
    });
    const sessionPayload = {
      nonce: "nonce-123",
      cookies: {
        [AUTH_SESSION_COOKIE]: "token-123",
        [AUTH_SESSION_EXPIRES_COOKIE]: "2026-06-20T00:00:00.000Z",
        [AUTH_SESSION_SIGNATURE_COOKIE]: "sig-123",
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(sessionPayload, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ ok: true }));

    await expect(completeCliBrowserHandoff(params, fetchMock)).resolves.toBe(true);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/auth/cli-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nonce: "nonce-123" }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://127.0.0.1:43123/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sessionPayload),
    });
  });

  it("throws the cli-session JSON error when session creation fails", async () => {
    const params = new URLSearchParams({
      cliCallback: "http://127.0.0.1:43123/callback",
      cliNonce: "nonce-123",
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ error: "Authentication is disabled" }, { status: 403 }));

    await expect(completeCliBrowserHandoff(params, fetchMock)).rejects.toThrow("Authentication is disabled");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws the callback JSON error when callback delivery fails", async () => {
    const params = new URLSearchParams({
      cliCallback: "http://127.0.0.1:43123/callback",
      cliNonce: "nonce-123",
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ nonce: "nonce-123", cookies: {} }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ error: "nonce mismatch" }, { status: 400 }));

    await expect(completeCliBrowserHandoff(params, fetchMock)).rejects.toThrow("nonce mismatch");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects CLI session creation when auth is disabled", async () => {
    process.env.AUTH_MODE = "disabled";
    const { POST } = await import("../../app/api/auth/cli-session/route");
    const request = new NextRequest("http://localhost/api/auth/cli-session", {
      method: "POST",
      body: JSON.stringify({ nonce: "nonce-123" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Authentication is disabled");
  });
});
