import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { isKeycloakMode, keycloakLogoutUrl } from "./config";
afterEach(() => vi.unstubAllEnvs());
describe("Keycloak mode", () => {
  it("preserves the legacy login mode unless explicitly enabled", () => {
    vi.stubEnv("AUTH_OIDC_ENABLED", "true");
    vi.stubEnv("AUTH_OIDC_PROVIDER", "oidc");
    expect(isKeycloakMode()).toBe(false);
    expect(keycloakLogoutUrl()).toBeNull();
  });
  it("builds logout only from trusted server configuration", () => {
    vi.stubEnv("AUTH_OIDC_ENABLED", "true");
    vi.stubEnv("AUTH_OIDC_PROVIDER", "keycloak");
    vi.stubEnv("AUTH_OIDC_ISSUER", "http://localhost:8280/realms/innoscale");
    vi.stubEnv("AUTH_OIDC_CLIENT_ID", "innoscale-local");
    vi.stubEnv("AUTH_OIDC_CLIENT_SECRET", "test-secret");
    vi.stubEnv("AUTH_OIDC_REDIRECT_URI", "http://localhost:3200/api/auth/oidc/callback");
    vi.stubEnv("AUTH_OIDC_ALLOW_HTTP", "true");
    expect(isKeycloakMode()).toBe(true);
    const url = new URL(keycloakLogoutUrl()!);
    expect(url.pathname).toBe("/realms/innoscale/protocol/openid-connect/logout");
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe("http://localhost:3200/login");
    expect(url.searchParams.has("client_secret")).toBe(false);
  });
});

import { NextRequest } from "next/server";
import { keycloakNavigation } from "./navigation";
describe("server-side managed navigation", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_OIDC_ISSUER", "http://localhost:8280/realms/innoscale");
    vi.stubEnv("AUTH_OIDC_CLIENT_ID", "local"); vi.stubEnv("AUTH_OIDC_CLIENT_SECRET", "test-secret");
    vi.stubEnv("AUTH_OIDC_REDIRECT_URI", "http://localhost:3200/api/auth/oidc/callback");
    vi.stubEnv("AUTH_OIDC_ALLOW_HTTP", "true");
  });
  it("routes registration without changing the frontend", () => {
    vi.stubEnv("AUTH_OIDC_ENABLED", "true"); vi.stubEnv("AUTH_OIDC_PROVIDER", "keycloak");
    const r = keycloakNavigation(new NextRequest("http://localhost/register?next=/workspace"));
    expect(r?.headers.get("location")).toBe("http://localhost:3200/api/auth/oidc/start?next=%2Fworkspace&action=register");
  });
  it("does not loop failed callbacks back into the provider", () => {
    vi.stubEnv("AUTH_OIDC_ENABLED", "true"); vi.stubEnv("AUTH_OIDC_PROVIDER", "keycloak");
    expect(keycloakNavigation(new NextRequest("http://localhost/login?oidc_error=1"))?.status).toBe(503);
  });
  it("preserves local mode and unrelated routes", () => {
    vi.stubEnv("AUTH_OIDC_PROVIDER", "oidc");
    expect(keycloakNavigation(new NextRequest("http://localhost/login"))).toBeNull();
  });
});
