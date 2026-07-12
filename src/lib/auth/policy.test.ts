import { afterEach, describe, expect, it } from "vitest";
import { isSingleAdminMode, shouldUseSecureAuthCookies } from "./policy";

const originalAuthSingleAdmin = process.env.AUTH_SINGLE_ADMIN;
const originalAuthCookieSecure = process.env.AUTH_COOKIE_SECURE;
const originalNodeEnv = process.env.NODE_ENV;

function restore(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

afterEach(() => {
  restore("AUTH_SINGLE_ADMIN", originalAuthSingleAdmin);
  restore("AUTH_COOKIE_SECURE", originalAuthCookieSecure);
  restore("NODE_ENV", originalNodeEnv);
});

describe("auth policy environment", () => {
  it("keeps single-admin mode off by default", () => {
    delete process.env.AUTH_SINGLE_ADMIN;

    expect(isSingleAdminMode()).toBe(false);
  });

  it.each([
    ["true", true],
    [" TRUE ", true],
    ["false", false],
    [" False ", false],
  ])("parses AUTH_SINGLE_ADMIN=%s", (raw, expected) => {
    process.env.AUTH_SINGLE_ADMIN = raw;

    expect(isSingleAdminMode()).toBe(expected);
  });

  it("rejects an invalid single-admin value", () => {
    process.env.AUTH_SINGLE_ADMIN = "yes";

    expect(() => isSingleAdminMode()).toThrow(
      "AUTH_SINGLE_ADMIN must be either true or false",
    );
  });

  it("defaults production cookies to secure", () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    delete process.env.AUTH_COOKIE_SECURE;

    expect(shouldUseSecureAuthCookies()).toBe(true);
  });

  it("defaults development cookies to insecure", () => {
    Reflect.set(process.env, "NODE_ENV", "development");
    delete process.env.AUTH_COOKIE_SECURE;

    expect(shouldUseSecureAuthCookies()).toBe(false);
  });

  it("allows the explicit temporary HTTP override", () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.AUTH_COOKIE_SECURE = "false";

    expect(shouldUseSecureAuthCookies()).toBe(false);
  });

  it("allows an explicit secure cookie in development", () => {
    Reflect.set(process.env, "NODE_ENV", "development");
    process.env.AUTH_COOKIE_SECURE = " TRUE ";

    expect(shouldUseSecureAuthCookies()).toBe(true);
  });

  it("rejects an invalid cookie value", () => {
    process.env.AUTH_COOKIE_SECURE = "0";

    expect(() => shouldUseSecureAuthCookies()).toThrow(
      "AUTH_COOKIE_SECURE must be either true or false",
    );
  });
});
