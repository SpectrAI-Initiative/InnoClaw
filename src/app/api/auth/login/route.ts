import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  attachAuthCookies,
  createAuthSession,
  findUserByEmail,
  normalizeUserEmail,
} from "@/lib/auth/server";
import { isAuthDisabled } from "@/lib/auth/mode";
import { verifyPassword } from "@/lib/auth/password";
import { jsonError } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  if (isAuthDisabled()) {
    return jsonError("Authentication is disabled", 403);
  }

  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return jsonError("Missing email or password", 400);
    }

    const user = await findUserByEmail(normalizeUserEmail(email));
    if (!user || !user.isActive) {
      return jsonError("Invalid credentials", 401);
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return jsonError("Invalid credentials", 401);
    }

    const session = await createAuthSession(user.id);
    const now = new Date().toISOString();
    await db
      .update(users)
      .set({ lastLoginAt: now, updatedAt: now })
      .where(eq(users.id, user.id));

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          lastLoginAt: now,
          createdAt: user.createdAt,
          updatedAt: now,
        },
      },
      { status: 200 },
    );
    attachAuthCookies(response, session);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to login";
    return jsonError(message, 500);
  }
}
