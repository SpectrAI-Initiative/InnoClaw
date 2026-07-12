import { describe, expect, it } from "vitest";
import { resolveRoleAwareRedirectPath } from "./redirect-policy";

describe("resolveRoleAwareRedirectPath", () => {
  it.each([
    "/admin",
    "/admin/users",
    "/admin/users?tab=active",
    "/admin%2Fusers",
    "/workspace/../admin/users",
    "/workspace/%2e%2e/admin/users",
  ])(
    "redirects an ordinary user away from %s",
    (next) => {
      expect(resolveRoleAwareRedirectPath(next, "user", "/")).toBe("/");
    },
  );

  it.each(["/", "/workspace", "/workspace/id", "/settings"])(
    "keeps an ordinary user's allowed destination %s",
    (next) => {
      expect(resolveRoleAwareRedirectPath(next, "user", "/")).toBe(next);
    },
  );

  it("does not confuse a non-admin prefix with an administrator route", () => {
    expect(resolveRoleAwareRedirectPath("/administrator", "user", "/"))
      .toBe("/administrator");
  });

  it("allows an administrator destination for an administrator", () => {
    expect(resolveRoleAwareRedirectPath("/admin/users", "admin", "/admin/users"))
      .toBe("/admin/users");
  });

  it("preserves the existing unsafe-path fallback", () => {
    expect(resolveRoleAwareRedirectPath("https://evil.example", "user", "/"))
      .toBe("/");
  });

  it("never uses an administrator fallback for an ordinary user", () => {
    expect(resolveRoleAwareRedirectPath(null, "user", "/admin/users")).toBe("/");
  });
});
