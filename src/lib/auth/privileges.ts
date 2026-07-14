import { NextRequest, NextResponse } from "next/server";
import { isAuthDisabled } from "./mode";
import { isSingleAdminMode } from "./policy";
import { forbiddenResponse, requireAuth, type AuthContext } from "./server";

export function canUseHighRiskExecution(auth: AuthContext): boolean {
  return (
    isAuthDisabled() ||
    !isSingleAdminMode() ||
    auth.user.role === "admin"
  );
}

export async function requireHighRiskExecution(
  request: NextRequest,
): Promise<AuthContext | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }
  if (!canUseHighRiskExecution(auth)) {
    return forbiddenResponse("High-risk execution access required");
  }
  return auth;
}
