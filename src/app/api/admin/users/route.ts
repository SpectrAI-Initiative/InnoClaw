import { NextRequest, NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";
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
import { requireAdmin } from "@/lib/auth/server";
import { isAuthDisabled } from "@/lib/auth/mode";
import { hashPassword } from "@/lib/auth/password";
import { jsonError } from "@/lib/api-errors";

const AUTH_DISABLED_USER_MANAGEMENT_ERROR = "User management is disabled when authentication is disabled";

function rejectUserManagementWhenAuthDisabled(): NextResponse | null {
  return isAuthDisabled() ? jsonError(AUTH_DISABLED_USER_MANAGEMENT_ERROR, 403) : null;
}

function publicUserRow(user: typeof users.$inferSelect) {
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

async function activeAdminCount(): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true)));
  return row.count;
}

async function assertNotLastActiveAdmin(targetUserId: string): Promise<NextResponse | null> {
  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!target) {
    return jsonError("User not found", 404);
  }

  if (target.role === "admin" && target.isActive && (await activeAdminCount()) <= 1) {
    return jsonError("Cannot remove the last active administrator", 400);
  }

  return null;
}

export async function GET(request: NextRequest) {
  const authDisabledResponse = rejectUserManagementWhenAuthDisabled();
  if (authDisabledResponse) {
    return authDisabledResponse;
  }

  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const rows = await db.select().from(users);
  return NextResponse.json({ users: rows.map(publicUserRow) });
}

export async function POST(request: NextRequest) {
  const authDisabledResponse = rejectUserManagementWhenAuthDisabled();
  if (authDisabledResponse) {
    return authDisabledResponse;
  }

  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role === "admin" ? "admin" : "user";

    if (!email || !password) {
      return jsonError("Missing email or password", 400);
    }
    if (password.length < 8) {
      return jsonError("Password must be at least 8 characters", 400);
    }

    const now = new Date().toISOString();
    await db.insert(users).values({
      id: nanoid(),
      email,
      name: name || email.split("@")[0] || "User",
      passwordHash: hashPassword(password),
      role,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create user";
    const status = message.includes("UNIQUE") ? 409 : 500;
    return jsonError(status === 409 ? "Email is already registered" : message, status);
  }
}

export async function PATCH(request: NextRequest) {
  const authDisabledResponse = rejectUserManagementWhenAuthDisabled();
  if (authDisabledResponse) {
    return authDisabledResponse;
  }

  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = await request.json();
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) {
    return jsonError("Missing userId", 400);
  }

  if ((body.role && body.role !== "admin") || body.isActive === false) {
    const lastAdminError = await assertNotLastActiveAdmin(userId);
    if (lastAdminError) {
      return lastAdminError;
    }
  }

  const updates: Partial<typeof users.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };

  if (typeof body.name === "string") {
    updates.name = body.name.trim() || "User";
  }
  if (body.role === "admin" || body.role === "user") {
    updates.role = body.role;
  }
  if (typeof body.isActive === "boolean") {
    updates.isActive = body.isActive;
  }
  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 8) {
      return jsonError("Password must be at least 8 characters", 400);
    }
    updates.passwordHash = hashPassword(body.password);
  }

  await db.update(users).set(updates).where(eq(users.id, userId));

  if (body.isActive === false || updates.passwordHash) {
    await db
      .update(userSessions)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(userSessions.userId, userId));
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const authDisabledResponse = rejectUserManagementWhenAuthDisabled();
  if (authDisabledResponse) {
    return authDisabledResponse;
  }

  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = await request.json();
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) {
    return jsonError("Missing userId", 400);
  }
  if (userId === auth.user.id) {
    return jsonError("Administrators cannot delete their own account", 400);
  }

  const lastAdminError = await assertNotLastActiveAdmin(userId);
  if (lastAdminError) {
    return lastAdminError;
  }

  const transferToUserId =
    typeof body.transferToUserId === "string" && body.transferToUserId
      ? body.transferToUserId
      : auth.user.id;

  await db.update(workspaces).set({ ownerUserId: transferToUserId }).where(eq(workspaces.ownerUserId, userId));
  await db.update(hfDatasets).set({ ownerUserId: transferToUserId }).where(eq(hfDatasets.ownerUserId, userId));
  await db.update(scheduledTasks).set({ ownerUserId: transferToUserId }).where(eq(scheduledTasks.ownerUserId, userId));
  await db.update(skills).set({ ownerUserId: transferToUserId }).where(eq(skills.ownerUserId, userId));
  await db.delete(users).where(eq(users.id, userId));

  return NextResponse.json({ success: true, transferredToUserId: transferToUserId });
}
