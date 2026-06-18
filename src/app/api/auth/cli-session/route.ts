import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import {
  createAuthSession,
  getAuthContext,
  refreshAuthSessionIfNeeded,
  signSessionToken,
  unauthorizedResponse,
} from "@/lib/auth/server";
import { createCliSessionHandoffPayload } from "@/lib/auth/cli-handoff";

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    const body = await request.json().catch(() => ({}));
    const nonce = typeof body.nonce === "string" ? body.nonce.trim() : "";
    if (!nonce) {
      return jsonError("Missing nonce", 400);
    }

    const cliSession = await createAuthSession(auth.user.id);
    const payload = createCliSessionHandoffPayload({
      nonce,
      user: auth.user,
      token: cliSession.token,
      expiresAt: cliSession.expiresAt,
      signature: signSessionToken(cliSession.token),
    });

    const response = NextResponse.json(payload, { status: 201 });
    return refreshAuthSessionIfNeeded(response, auth);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create CLI session", 500);
  }
}
