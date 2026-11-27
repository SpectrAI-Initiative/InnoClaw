import { NextRequest, NextResponse } from "next/server";
import { getOidcConfig, isKeycloakMode, keycloakLogoutUrl, KEYCLOAK_LOGOUT_COOKIE } from "./config";

// Preserve frontend pages: managed authentication is routed before page rendering.
export function keycloakNavigation(request: NextRequest): NextResponse | null {
  if (!isKeycloakMode() || !["/login", "/register"].includes(request.nextUrl.pathname)) return null;
  try {
    if (request.cookies.get(KEYCLOAK_LOGOUT_COOKIE)?.value === "1") {
      const target = keycloakLogoutUrl();
      if (!target) throw new Error("Identity logout unavailable");
      const response = NextResponse.redirect(target);
      response.cookies.set(KEYCLOAK_LOGOUT_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true });
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
    if (request.nextUrl.searchParams.has("oidc_error") || request.nextUrl.searchParams.has("oidc_unavailable")) {
      return NextResponse.json({ error: "Identity sign-in failed. Retry from /login." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    const query = new URLSearchParams();
    const params = request.nextUrl.searchParams;
    query.set("next", params.has("cliCallback") ? `/login?${params.toString()}` : params.get("next") || "/");
    if (request.nextUrl.pathname === "/register") query.set("action", "register");
    const config = getOidcConfig();
    if (!config) throw new Error("Identity configuration unavailable");
    const target = new URL(`/api/auth/oidc/start?${query}`, new URL(config.redirectUri).origin);
    const response = NextResponse.redirect(target);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json({ error: "Identity service configuration is unavailable" }, { status: 503 });
  }
}
