import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import {
  hfDatasets,
  scheduledTasks,
  skills,
  userSessions,
  users,
  workspaces,
} from "@/lib/db/schema";
import {
  AUTH_SESSION_COOKIE,
  AUTH_SESSION_DAYS,
  AUTH_SESSION_EXPIRES_COOKIE,
  AUTH_SESSION_REFRESH_DAYS,
  AUTH_SESSION_SIGNATURE_COOKIE,
} from "./constants";
import type { PublicUser } from "@/types/auth";

export type AuthRole = "admin" | "user";

export interface AuthContext {
  user: PublicUser;
  session: {
    id: string;
    expiresAt: string;
  };
  token: string;
}

function sessionDurationMs(): number {
  return AUTH_SESSION_DAYS * 24 * 60 * 60 * 1000;
}

function sessionRefreshMs(): number {
  return AUTH_SESSION_REFRESH_DAYS * 24 * 60 * 60 * 1000;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toPublicUser(user: typeof users.$inferSelect): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function normalizeUserEmail(email: string): string {
  return normalizeEmail(email);
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("base64url");
}

function getSessionSigningSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "innoclaw-development-secret"
  );
}

export function signSessionToken(token: string): string {
  return crypto
    .createHmac("sha256", getSessionSigningSecret())
    .update(token)
    .digest("base64url");
}

export function verifySessionSignature(token: string, signature: string): boolean {
  return signSessionToken(token) === signature;
}

export function createRawSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function getSessionExpiresAt(): string {
  return new Date(Date.now() + sessionDurationMs()).toISOString();
}

function setCookiePair(response: NextResponse, token: string, expiresAt: string): void {
  const expires = new Date(expiresAt);
  const common = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };

  response.cookies.set(AUTH_SESSION_COOKIE, token, common);
  response.cookies.set(AUTH_SESSION_EXPIRES_COOKIE, expiresAt, common);
  response.cookies.set(AUTH_SESSION_SIGNATURE_COOKIE, signSessionToken(token), {
    ...common,
    httpOnly: true,
  });
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(AUTH_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
  response.cookies.set(AUTH_SESSION_EXPIRES_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
  response.cookies.set(AUTH_SESSION_SIGNATURE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export async function getUserCount(): Promise<number> {
  const [row] = await db.select({ count: count() }).from(users);
  return row.count;
}

export async function findUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);

  return user ?? null;
}

export async function claimExistingDataForFirstUser(userId: string): Promise<void> {
  await db.update(workspaces).set({ ownerUserId: userId }).where(isNull(workspaces.ownerUserId));
  await db.update(hfDatasets).set({ ownerUserId: userId }).where(isNull(hfDatasets.ownerUserId));
  await db.update(scheduledTasks).set({ ownerUserId: userId }).where(isNull(scheduledTasks.ownerUserId));
  await db
    .update(skills)
    .set({ ownerUserId: userId })
    .where(and(isNull(skills.ownerUserId), isNull(skills.workspaceId)));
}

export async function createUser(input: {
  email: string;
  name?: string;
  passwordHash: string;
  role?: AuthRole;
  isActive?: boolean;
}): Promise<PublicUser> {
  const now = new Date().toISOString();
  const email = normalizeEmail(input.email);
  const fallbackName = email.split("@")[0] || "User";
  const [created] = await db
    .insert(users)
    .values({
      id: nanoid(),
      email,
      name: input.name?.trim() || fallbackName,
      passwordHash: input.passwordHash,
      role: input.role ?? "user",
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return toPublicUser(created);
}

export async function createAuthSession(userId: string): Promise<{
  token: string;
  expiresAt: string;
}> {
  const token = createRawSessionToken();
  const expiresAt = getSessionExpiresAt();
  const now = new Date().toISOString();

  await db.insert(userSessions).values({
    id: nanoid(),
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
    lastSeenAt: now,
    createdAt: now,
  });

  return { token, expiresAt };
}

export function attachAuthCookies(
  response: NextResponse,
  session: { token: string; expiresAt: string },
): NextResponse {
  setCookiePair(response, session.token, session.expiresAt);
  return response;
}

async function getTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_SESSION_COOKIE)?.value ?? null;
}

function getTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(AUTH_SESSION_COOKIE)?.value ?? null;
}

export async function getAuthContext(request?: NextRequest): Promise<AuthContext | null> {
  const token = request ? getTokenFromRequest(request) : await getTokenFromCookies();
  if (!token) {
    return null;
  }

  const now = new Date().toISOString();
  const [row] = await db
    .select({
      session: userSessions,
      user: users,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(
      and(
        eq(userSessions.tokenHash, hashSessionToken(token)),
        isNull(userSessions.revokedAt),
        gt(userSessions.expiresAt, now),
        eq(users.isActive, true),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const lastSeenAt = row.session.lastSeenAt;
  const shouldTouch =
    !lastSeenAt ||
    Date.now() - new Date(lastSeenAt).getTime() > 10 * 60 * 1000;

  if (shouldTouch) {
    await db
      .update(userSessions)
      .set({ lastSeenAt: now })
      .where(eq(userSessions.id, row.session.id));
  }

  return {
    user: toPublicUser(row.user),
    session: {
      id: row.session.id,
      expiresAt: row.session.expiresAt,
    },
    token,
  };
}

export async function refreshAuthSessionIfNeeded(
  response: NextResponse,
  auth: AuthContext,
): Promise<NextResponse> {
  const expiresAtMs = new Date(auth.session.expiresAt).getTime();
  if (expiresAtMs - Date.now() > sessionRefreshMs()) {
    return response;
  }

  const nextExpiresAt = getSessionExpiresAt();
  await db
    .update(userSessions)
    .set({
      expiresAt: nextExpiresAt,
      lastSeenAt: new Date().toISOString(),
    })
    .where(eq(userSessions.id, auth.session.id));

  setCookiePair(response, auth.token, nextExpiresAt);
  return response;
}

export async function revokeCurrentSession(request: NextRequest): Promise<void> {
  const token = getTokenFromRequest(request);
  if (!token) {
    return;
  }

  await db
    .update(userSessions)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(userSessions.tokenHash, hashSessionToken(token)));
}

export function unauthorizedResponse(message = "Unauthorized"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message = "Forbidden"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export const HEADLESS_ADMIN_ID = "headless";

const HEADLESS_ADMIN_CONTEXT: AuthContext = {
  user: {
    id: HEADLESS_ADMIN_ID,
    email: "headless@local",
    name: "Headless Runner",
    role: "admin",
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  },
  session: { id: HEADLESS_ADMIN_ID, expiresAt: "2099-01-01T00:00:00.000Z" },
  token: HEADLESS_ADMIN_ID,
};

export async function requireAuth(request: NextRequest): Promise<AuthContext | NextResponse> {
  if (process.env.DISABLE_AUTH === "true") {
    return HEADLESS_ADMIN_CONTEXT;
  }
  const auth = await getAuthContext(request);
  if (!auth) {
    return unauthorizedResponse();
  }
  return auth;
}

export async function requireAdmin(request: NextRequest): Promise<AuthContext | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }
  if (auth.user.role !== "admin") {
    return forbiddenResponse("Admin access required");
  }
  return auth;
}
