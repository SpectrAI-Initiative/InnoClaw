import { afterEach, describe, expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  attachAuthCookies,
  clearAuthCookies,
  getAuthContext,
  requireAdmin,
  requireAuth,
} from "./server";

const originalAuthMode = process.env.AUTH_MODE;
const originalAuthCookieSecure = process.env.AUTH_COOKIE_SECURE;
const originalNodeEnv = process.env.NODE_ENV;

function requestFor(path: string) {
  return new NextRequest(new URL(path, "http://localhost"));
}

afterEach(() => {
  if (originalAuthMode === undefined) {
    delete process.env.AUTH_MODE;
  } else {
    process.env.AUTH_MODE = originalAuthMode;
  }
  if (originalAuthCookieSecure === undefined) {
    delete process.env.AUTH_COOKIE_SECURE;
  } else {
    process.env.AUTH_COOKIE_SECURE = originalAuthCookieSecure;
  }
  if (originalNodeEnv === undefined) {
    Reflect.deleteProperty(process.env, "NODE_ENV");
  } else {
    Reflect.set(process.env, "NODE_ENV", originalNodeEnv);
  }
});

function setCookieHeaders(response: NextResponse): string[] {
  return response.headers.getSetCookie();
}

describe("server auth cookie policy", () => {
  it("omits Secure from every session cookie for the explicit HTTP override", () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.AUTH_COOKIE_SECURE = "false";
    const expiresAt = "2030-01-01T00:00:00.000Z";

    const attached = attachAuthCookies(NextResponse.json({ ok: true }), {
      token: "session-token",
      expiresAt,
    });
    const cleared = NextResponse.json({ ok: true });
    clearAuthCookies(cleared);

    expect(setCookieHeaders(attached)).toHaveLength(3);
    expect(setCookieHeaders(cleared)).toHaveLength(3);
    for (const header of [
      ...setCookieHeaders(attached),
      ...setCookieHeaders(cleared),
    ]) {
      expect(header).toContain("HttpOnly");
      expect(header).not.toMatch(/;\s*Secure(?:;|$)/i);
    }
  });

  it("marks every session cookie Secure when explicitly enabled", () => {
    Reflect.set(process.env, "NODE_ENV", "development");
    process.env.AUTH_COOKIE_SECURE = "true";
    const expiresAt = "2030-01-01T00:00:00.000Z";

    const attached = attachAuthCookies(NextResponse.json({ ok: true }), {
      token: "session-token",
      expiresAt,
    });
    const cleared = NextResponse.json({ ok: true });
    clearAuthCookies(cleared);

    for (const header of [
      ...setCookieHeaders(attached),
      ...setCookieHeaders(cleared),
    ]) {
      expect(header).toContain("HttpOnly");
      expect(header).toMatch(/;\s*Secure(?:;|$)/i);
    }
  });
});

describe("server auth disabled mode", () => {
  it("returns anonymous admin auth without cookies", async () => {
    process.env.AUTH_MODE = "disabled";

    const auth = await getAuthContext(requestFor("/api/workspaces"));

    expect(auth?.user).toMatchObject({
      id: "anonymous-admin",
      email: "anonymous@local",
      role: "admin",
      isActive: true,
    });
    expect(auth?.session.id).toBe("anonymous-disabled-auth");
  });

  it("makes requireAuth succeed without cookies", async () => {
    process.env.AUTH_MODE = "disabled";

    const auth = await requireAuth(requestFor("/api/workspaces"));

    expect(auth).not.toBeInstanceOf(NextResponse);
    if (!(auth instanceof NextResponse)) {
      expect(auth.user.id).toBe("anonymous-admin");
    }
  });

  it("makes requireAdmin succeed without cookies", async () => {
    process.env.AUTH_MODE = "disabled";

    const auth = await requireAdmin(requestFor("/api/settings"));

    expect(auth).not.toBeInstanceOf(NextResponse);
    if (!(auth instanceof NextResponse)) {
      expect(auth.user.role).toBe("admin");
    }
  });
});
