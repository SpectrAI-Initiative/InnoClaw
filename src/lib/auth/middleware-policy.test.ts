import { describe, expect, it } from "vitest";
import { getAuthMiddlewareAction } from "./middleware-policy";

describe("auth middleware policy", () => {
  it("allows protected pages when auth is disabled", () => {
    expect(getAuthMiddlewareAction({ pathname: "/workspace/abc", authDisabled: true, hasSession: false })).toEqual({
      type: "next",
    });
  });

  it("allows protected APIs when auth is disabled", () => {
    expect(getAuthMiddlewareAction({ pathname: "/api/workspaces", authDisabled: true, hasSession: false })).toEqual({
      type: "next",
    });
  });

  it("redirects user management pages when auth is disabled", () => {
    expect(getAuthMiddlewareAction({ pathname: "/admin/users", authDisabled: true, hasSession: false })).toEqual({
      type: "redirect-home",
    });
  });

  it("redirects protected pages without a session in local auth mode", () => {
    expect(getAuthMiddlewareAction({ pathname: "/workspace/abc", authDisabled: false, hasSession: false })).toEqual({
      type: "redirect-login",
    });
  });

  it("rejects protected APIs without a session in local auth mode", () => {
    expect(getAuthMiddlewareAction({ pathname: "/api/workspaces", authDisabled: false, hasSession: false })).toEqual({
      type: "unauthorized-json",
    });
  });

  it("allows public auth routes in local auth mode", () => {
    expect(getAuthMiddlewareAction({ pathname: "/login", authDisabled: false, hasSession: false })).toEqual({
      type: "next",
    });
  });
});
