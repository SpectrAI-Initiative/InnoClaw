import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyPassword } from "./password";
import { bootstrapAdministrator } from "./bootstrap-admin";

let sqlite: Database.Database;

function insertUser(input: {
  id: string;
  email: string;
  role: "admin" | "user";
  isActive?: boolean;
}) {
  sqlite.prepare(`
    INSERT INTO users (
      id, email, name, password_hash, role, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.id,
    input.email,
    input.email,
    "existing-hash",
    input.role,
    input.isActive === false ? 0 : 1,
    "2026-01-01T00:00:00.000Z",
    "2026-01-01T00:00:00.000Z",
  );
}

beforeEach(() => {
  sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
});

afterEach(() => {
  sqlite.close();
});

describe("bootstrapAdministrator", () => {
  it("creates the sole active administrator with a verifiable password", () => {
    const result = bootstrapAdministrator(sqlite, {
      email: " Admin@InnoClaw.Local ",
      name: "Administrator",
      password: "a-long-test-password",
    });

    expect(result).toEqual({
      status: "created",
      email: "admin@innoclaw.local",
    });
    const row = sqlite.prepare(`
      SELECT email, name, password_hash AS passwordHash, role, is_active AS isActive
      FROM users
    `).get() as {
      email: string;
      name: string;
      passwordHash: string;
      role: string;
      isActive: number;
    };
    expect(row).toMatchObject({
      email: "admin@innoclaw.local",
      name: "Administrator",
      role: "admin",
      isActive: 1,
    });
    expect(verifyPassword("a-long-test-password", row.passwordHash)).toBe(true);
  });

  it("is idempotent for the same active administrator without resetting its password", () => {
    bootstrapAdministrator(sqlite, {
      email: "admin@innoclaw.local",
      name: "Administrator",
      password: "original-password",
    });
    const before = sqlite.prepare(
      "SELECT password_hash AS passwordHash FROM users",
    ).get() as { passwordHash: string };

    const result = bootstrapAdministrator(sqlite, {
      email: "ADMIN@INNOCLAW.LOCAL",
      name: "Changed Name",
      password: "different-password",
    });
    const after = sqlite.prepare(
      "SELECT name, password_hash AS passwordHash FROM users",
    ).get() as { name: string; passwordHash: string };

    expect(result).toEqual({
      status: "existing",
      email: "admin@innoclaw.local",
    });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.name).toBe("Administrator");
    expect(verifyPassword("different-password", after.passwordHash)).toBe(false);
  });

  it("rejects the same inactive administrator", () => {
    insertUser({
      id: "admin-id",
      email: "admin@innoclaw.local",
      role: "admin",
      isActive: false,
    });

    expect(() => bootstrapAdministrator(sqlite, {
      email: "admin@innoclaw.local",
      name: "Administrator",
      password: "a-long-test-password",
    })).toThrow("The existing administrator is inactive");
  });

  it("rejects a different existing administrator", () => {
    insertUser({
      id: "other-admin",
      email: "other@example.com",
      role: "admin",
    });

    expect(() => bootstrapAdministrator(sqlite, {
      email: "admin@innoclaw.local",
      name: "Administrator",
      password: "a-long-test-password",
    })).toThrow("A different administrator already exists");
  });

  it("rejects multiple existing administrators", () => {
    insertUser({ id: "admin-a", email: "a@example.com", role: "admin" });
    insertUser({ id: "admin-b", email: "b@example.com", role: "admin" });

    expect(() => bootstrapAdministrator(sqlite, {
      email: "admin@innoclaw.local",
      name: "Administrator",
      password: "a-long-test-password",
    })).toThrow("Multiple administrators already exist");
  });

  it("rejects an ordinary-user collision", () => {
    insertUser({
      id: "user-id",
      email: "admin@innoclaw.local",
      role: "user",
    });

    expect(() => bootstrapAdministrator(sqlite, {
      email: "admin@innoclaw.local",
      name: "Administrator",
      password: "a-long-test-password",
    })).toThrow("The administrator email already belongs to an ordinary user");
  });

  it("rejects a password shorter than eight characters", () => {
    expect(() => bootstrapAdministrator(sqlite, {
      email: "admin@innoclaw.local",
      name: "Administrator",
      password: "short",
    })).toThrow("Administrator password must be at least 8 characters");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM users").get()).toEqual({
      count: 0,
    });
  });
});
