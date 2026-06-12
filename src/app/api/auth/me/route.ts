import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, refreshAuthSessionIfNeeded, unauthorizedResponse } from "@/lib/auth/server";
import { getAuthMode, isAuthDisabled } from "@/lib/auth/mode";

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  const response = NextResponse.json({
    user: auth.user,
    session: { expiresAt: auth.session.expiresAt },
    authMode: getAuthMode(),
    isAuthDisabled: isAuthDisabled(),
  });
  return refreshAuthSessionIfNeeded(response, auth);
}
