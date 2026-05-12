import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_PUBLIC_API_PREFIXES,
  AUTH_PUBLIC_PATHS,
  AUTH_SESSION_COOKIE,
  AUTH_SESSION_EXPIRES_COOKIE,
  AUTH_SESSION_SIGNATURE_COOKIE,
} from "@/lib/auth/constants";

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

function isPublicPath(pathname: string): boolean {
  if (AUTH_PUBLIC_PATHS.has(pathname)) {
    return true;
  }

  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  );
}

function isPublicApi(pathname: string): boolean {
  return AUTH_PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname) || isPublicApi(pathname)) {
    return NextResponse.next();
  }

  const hasSession = await hasValidSessionMarker(request);
  if (hasSession) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
