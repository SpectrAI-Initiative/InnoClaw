import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isSingleAdminMode } from "./policy";

export type SingleAdminState =
  | { status: "disabled" }
  | { status: "ready"; adminId: string }
  | { status: "invalid"; reason: "missing" | "inactive" | "multiple" };

export function classifyAdministrators(
  rows: Array<{ id: string; isActive: boolean }>,
): SingleAdminState {
  if (rows.length === 0) {
    return { status: "invalid", reason: "missing" };
  }
  if (rows.length > 1) {
    return { status: "invalid", reason: "multiple" };
  }
  if (!rows[0].isActive) {
    return { status: "invalid", reason: "inactive" };
  }
  return { status: "ready", adminId: rows[0].id };
}

export async function getSingleAdminState(): Promise<SingleAdminState> {
  if (!isSingleAdminMode()) {
    return { status: "disabled" };
  }

  const rows = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(eq(users.role, "admin"));

  return classifyAdministrators(rows);
}
