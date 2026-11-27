import { keycloakLogoutUrl, KEYCLOAK_LOGOUT_COOKIE, getOidcConfig } from "@/lib/auth/oidc/config";
import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies, revokeCurrentSession } from "@/lib/auth/server";

export async function POST(request: NextRequest) {
  await revokeCurrentSession(request);
  let logoutUrl: string | null = null;
  try { logoutUrl = keycloakLogoutUrl(); } catch { /* Always revoke the local session. */ }
  const response = NextResponse.json({ success: true, ...(logoutUrl ? { logoutUrl } : {}) });
  clearAuthCookies(response);
  if (logoutUrl) response.cookies.set(KEYCLOAK_LOGOUT_COOKIE, "1", {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 300,
    secure: getOidcConfig()!.redirectUri.startsWith("https:"),
  });
  return response;
}
