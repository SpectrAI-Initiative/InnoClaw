import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  attachAuthCookies,
  claimExistingDataForFirstUser,
  createAuthSession,
  createUser,
  findUserByEmail,
  getUserCount,
  normalizeUserEmail,
} from "@/lib/auth/server";
import { isAuthDisabled } from "@/lib/auth/mode";
import { getSingleAdminState } from "@/lib/auth/admin-policy";
import { hashPassword } from "@/lib/auth/password";
import { isSingleAdminMode } from "@/lib/auth/policy";
import { jsonError } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  if (isAuthDisabled()) {
    return jsonError("Authentication is disabled", 403);
  }

  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const singleAdmin = isSingleAdminMode();

    if (singleAdmin && Object.prototype.hasOwnProperty.call(body, "role")) {
      return jsonError("Role cannot be selected during registration", 400);
    }

    if (!email || !password) {
      return jsonError("Missing email or password", 400);
    }

    if (password.length < 8) {
      return jsonError("Password must be at least 8 characters", 400);
    }

    if (singleAdmin) {
      const state = await getSingleAdminState();
      if (state.status !== "ready") {
        return jsonError("Administrator setup is incomplete", 503);
      }
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return jsonError("Email is already registered", 409);
    }

    const userCount = await getUserCount();
    const created = await createUser({
      email: normalizeUserEmail(email),
      name: name || undefined,
      passwordHash: hashPassword(password),
      role: singleAdmin ? "user" : userCount === 0 ? "admin" : "user",
      isActive: true,
    });

    if (!singleAdmin && userCount === 0) {
      await claimExistingDataForFirstUser(created.id);
    }

    const session = await createAuthSession(created.id);
    await db
      .update(users)
      .set({ lastLoginAt: new Date().toISOString() })
      .where(eq(users.id, created.id));

    const response = NextResponse.json(
      { user: created, requiresSetup: userCount === 0 },
      { status: 201 },
    );
    attachAuthCookies(response, session);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to register";
    return jsonError(message, 500);
  }
}
