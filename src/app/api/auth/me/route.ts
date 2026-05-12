import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, refreshAuthSessionIfNeeded, unauthorizedResponse } from "@/lib/auth/server";

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  const response = NextResponse.json({
    user: auth.user,
    session: { expiresAt: auth.session.expiresAt },
  });
  return refreshAuthSessionIfNeeded(response, auth);
}
