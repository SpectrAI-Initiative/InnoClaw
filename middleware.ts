import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_SESSION_COOKIE,
  AUTH_SESSION_EXPIRES_COOKIE,
  AUTH_SESSION_SIGNATURE_COOKIE,
} from "@/lib/auth/constants";
import { getAuthMiddlewareAction } from "@/lib/auth/middleware-policy";
import { isAuthDisabled } from "@/lib/auth/mode";

function getSigningSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "innoclaw-development-secret"
  );
}

function base64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signToken(token: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSigningSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(token),
  );
  return base64Url(signature);
}

async function hasValidSessionMarker(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  const signature = request.cookies.get(AUTH_SESSION_SIGNATURE_COOKIE)?.value;
  const expiresAt = request.cookies.get(AUTH_SESSION_EXPIRES_COOKIE)?.value;

  if (!token || !signature || !expiresAt) {
    return false;
  }

  if (Number.isNaN(Date.parse(expiresAt)) || new Date(expiresAt).getTime() <= Date.now()) {
    return false;
  }

  return (await signToken(token)) === signature;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authDisabled = isAuthDisabled();

  const hasSession = authDisabled ? false : await hasValidSessionMarker(request);
  const action = getAuthMiddlewareAction({
    pathname,
    authDisabled,
    hasSession,
  });

  if (action.type === "next") {
    return NextResponse.next();
  }

  if (action.type === "unauthorized-json") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (action.type === "redirect-home") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
