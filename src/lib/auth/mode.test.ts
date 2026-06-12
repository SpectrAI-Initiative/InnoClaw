import { afterEach, describe, expect, it } from "vitest";
import {
  ANONYMOUS_AUTH_CONTEXT,
  ANONYMOUS_AUTH_MODE_SESSION_EXPIRES_AT,
  getAuthMode,
  isAuthDisabled,
} from "./mode";

const originalAuthMode = process.env.AUTH_MODE;

afterEach(() => {
  if (originalAuthMode === undefined) {
    delete process.env.AUTH_MODE;
  } else {
    process.env.AUTH_MODE = originalAuthMode;
  }
});

describe("auth mode", () => {
  it("defaults to local auth when AUTH_MODE is unset", () => {
    delete process.env.AUTH_MODE;

    expect(getAuthMode()).toBe("local");
    expect(isAuthDisabled()).toBe(false);
  });

  it("treats AUTH_MODE=disabled as disabled auth", () => {
    process.env.AUTH_MODE = "disabled";

    expect(getAuthMode()).toBe("disabled");
    expect(isAuthDisabled()).toBe(true);
  });

  it("normalizes whitespace and case", () => {
    process.env.AUTH_MODE = " Disabled ";

    expect(getAuthMode()).toBe("disabled");
  });

  it("falls back to local auth for unknown values", () => {
    process.env.AUTH_MODE = "off";

    expect(getAuthMode()).toBe("local");
    expect(isAuthDisabled()).toBe(false);
  });

  it("provides an anonymous admin context for disabled auth", () => {
    expect(ANONYMOUS_AUTH_CONTEXT.user).toMatchObject({
      id: "anonymous-admin",
      email: "anonymous@local",
      name: "Anonymous Admin",
      role: "admin",
      isActive: true,
    });
    expect(ANONYMOUS_AUTH_CONTEXT.token).toBe("anonymous-disabled-auth");
    expect(ANONYMOUS_AUTH_CONTEXT.session.expiresAt).toBe(ANONYMOUS_AUTH_MODE_SESSION_EXPIRES_AT);
  });
});
