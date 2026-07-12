import crypto from "crypto";
import type Database from "better-sqlite3";
import { hashPassword } from "./password";

export interface BootstrapAdminInput {
  email: string;
  name: string;
  password: string;
}

export type BootstrapAdminResult =
  | { status: "created"; email: string }
  | { status: "existing"; email: string };

interface ExistingAdministrator {
  id: string;
  email: string;
  isActive: number;
}

export function bootstrapAdministrator(
  sqlite: Database.Database,
  input: BootstrapAdminInput,
): BootstrapAdminResult {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim() || "Administrator";

  if (!email || !email.includes("@")) {
    throw new Error("A valid administrator email is required");
  }
  if (input.password.length < 8) {
    throw new Error("Administrator password must be at least 8 characters");
  }

  return sqlite.transaction(() => {
    const administrators = sqlite
      .prepare(`
        SELECT id, email, is_active AS isActive
        FROM users
        WHERE role = 'admin'
      `)
      .all() as ExistingAdministrator[];

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
      return { status: "existing" as const, email };
    }

    const collision = sqlite
      .prepare("SELECT role FROM users WHERE lower(email) = ?")
      .get(email);
    if (collision) {
      throw new Error(
        "The administrator email already belongs to an ordinary user",
      );
    }

    const now = new Date().toISOString();
    sqlite
      .prepare(`
        INSERT INTO users (
          id,
          email,
          name,
          password_hash,
          role,
          is_active,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, 'admin', 1, ?, ?)
      `)
      .run(
        crypto.randomUUID(),
        email,
        name,
        hashPassword(input.password),
        now,
        now,
      );

    return { status: "created" as const, email };
  })();
}
