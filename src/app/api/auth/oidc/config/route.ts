import { NextResponse } from "next/server";
import { getOidcConfig, isKeycloakMode } from "@/lib/auth/oidc/config";
import { isAuthDisabled } from "@/lib/auth/mode";
import { isSingleAdminMode } from "@/lib/auth/policy";

export function GET() {
  let enabled = false;
  try { enabled = !!getOidcConfig() && !isAuthDisabled() && !isSingleAdminMode(); } catch { /* Do not expose configuration. */ }
  return NextResponse.json({ enabled, managed: isKeycloakMode() }, { headers: { "Cache-Control": "no-store" } });
}
