import crypto from "crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { hashPassword } from "./password";

export interface BootstrapAdminInput {
  email: string;
  name: string;
  password: string;
}

export type BootstrapAdminResult =
  | { status: "created"; email: string }
  | { status: "existing"; email: string };

interface ExistingAdministrator extends RowDataPacket {
  id: string;
  email: string;
  isActive: number;
}

/** Serialises concurrent bootstrap runs (e.g. two containers starting at once). */
const BOOTSTRAP_LOCK_NAME = "innoclaw_bootstrap_admin";
const BOOTSTRAP_LOCK_TIMEOUT_SECONDS = 30;

function validateInput(input: BootstrapAdminInput): { email: string; name: string } {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim() || "Administrator";

  if (!email || !email.includes("@")) {
    throw new Error("A valid administrator email is required");
  }
  if (input.password.length < 8) {
    throw new Error("Administrator password must be at least 8 characters");
  }
  return { email, name };
}

/**
 * Create the single administrator account, or confirm it already exists.
 * Uses plain SQL (no path aliases) because it is also compiled into the
 * standalone admin CLI.
 */
export async function bootstrapAdministrator(
  pool: Pool,
  input: BootstrapAdminInput,
): Promise<BootstrapAdminResult> {
  const { email, name } = validateInput(input);
  const connection = await pool.getConnection();

  try {
    const [lockRows] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK(?, ?) AS acquired",
      [BOOTSTRAP_LOCK_NAME, BOOTSTRAP_LOCK_TIMEOUT_SECONDS],
    );
    if (lockRows[0]?.acquired !== 1) {
      throw new Error("Timed out waiting for another administrator bootstrap to finish");
    }

    try {
      await connection.beginTransaction();
      try {
        const [administrators] = await connection.query<ExistingAdministrator[]>(
          `SELECT id, email, is_active AS isActive
           FROM users
           WHERE role = 'admin'`,
        );

        if (administrators.length > 1) {
          throw new Error("Multiple administrators already exist");
        }

        if (administrators.length === 1) {
          const administrator = administrators[0];
          if (administrator.email.trim().toLowerCase() !== email) {
            throw new Error("A different administrator already exists");
          }
          if (!administrator.isActive) {
            throw new Error("The existing administrator is inactive");
          }
          await connection.commit();
          return { status: "existing", email };
        }

        const [collisions] = await connection.query<RowDataPacket[]>(
          "SELECT role FROM users WHERE lower(email) = ? LIMIT 1",
          [email],
        );
        if (collisions.length > 0) {
          throw new Error(
            "The administrator email already belongs to an ordinary user",
          );
        }

        const now = new Date().toISOString();
        await connection.query(
          `INSERT INTO users (
             id, email, name, password_hash, role, is_active, created_at, updated_at
           ) VALUES (?, ?, ?, ?, 'admin', 1, ?, ?)`,
          [crypto.randomUUID(), email, name, hashPassword(input.password), now, now],
        );
        await connection.commit();
        return { status: "created", email };
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    } finally {
      await connection.query("SELECT RELEASE_LOCK(?)", [BOOTSTRAP_LOCK_NAME]);
    }
  } finally {
    connection.release();
  }
}
