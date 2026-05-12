import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies, revokeCurrentSession } from "@/lib/auth/server";

export async function POST(request: NextRequest) {
  await revokeCurrentSession(request);
  const response = NextResponse.json({ success: true });
  clearAuthCookies(response);
  return response;
}
