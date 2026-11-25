import type { Pool, RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SETUP_TIMEOUT_MS, describeMysql, setUpTestDatabase } from "@/lib/db/test-mysql";
import { verifyPassword } from "./password";
import { bootstrapAdministrator } from "./bootstrap-admin";

describe("bootstrapAdministrator input validation", () => {
  const unusedPool = {
    getConnection: () => {
      throw new Error("should not connect");
    },
  } as unknown as Pool;

  it("rejects a password shorter than eight characters before touching the database", async () => {
    await expect(bootstrapAdministrator(unusedPool, {
      email: "admin@innobuddy.local",
      name: "Administrator",
      password: "short",
    })).rejects.toThrow("Administrator password must be at least 8 characters");
  });

  it("rejects an invalid email", async () => {
    await expect(bootstrapAdministrator(unusedPool, {
      email: "not-an-email",
      name: "Administrator",
      password: "a-long-test-password",
    })).rejects.toThrow("A valid administrator email is required");
  });
});

describeMysql("bootstrapAdministrator (MySQL)", () => {
  let pool: Pool;

  async function insertUser(input: {
    id: string;
    email: string;
    role: "admin" | "user";
    isActive?: boolean;
  }) {
    await pool.query(
      `INSERT INTO users (id, email, name, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.email,
        input.email,
        "existing-hash",
        input.role,
        input.isActive === false ? 0 : 1,
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
      ],
    );
  }

  async function users() {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT email, name, password_hash AS passwordHash, role, is_active AS isActive FROM users",
    );
    return rows;
  }

  beforeAll(async () => {
    await setUpTestDatabase("bootstrap_admin");
    const { getPool } = await import("@/lib/db");
    pool = getPool();
   }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    const { closeDb } = await import("@/lib/db");
    await closeDb();
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM users");
  });

  it("creates the sole active administrator with a verifiable password", async () => {
    const result = await bootstrapAdministrator(pool, {
      email: " Admin@innobuddy.Local ",
      name: "Administrator",
      password: "a-long-test-password",
    });

    expect(result).toEqual({ status: "created", email: "admin@innobuddy.local" });
    const rows = await users();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: "admin@innobuddy.local",
      name: "Administrator",
      role: "admin",
      isActive: 1,
    });
    expect(verifyPassword("a-long-test-password", rows[0].passwordHash)).toBe(true);
  });

  it("is idempotent for the same active administrator without resetting its password", async () => {
    await bootstrapAdministrator(pool, {
      email: "admin@innobuddy.local",
      name: "Administrator",
      password: "original-password",
    });
    const [before] = await users();

    const result = await bootstrapAdministrator(pool, {
      email: "ADMIN@innobuddy.LOCAL",
      name: "Changed Name",
      password: "different-password",
    });
    const [after] = await users();

    expect(result).toEqual({ status: "existing", email: "admin@innobuddy.local" });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.name).toBe("Administrator");
    expect(verifyPassword("different-password", after.passwordHash)).toBe(false);
  });

  it("rejects the same inactive administrator", async () => {
    await insertUser({ id: "admin-id", email: "admin@innobuddy.local", role: "admin", isActive: false });

    await expect(bootstrapAdministrator(pool, {
      email: "admin@innobuddy.local",
      name: "Administrator",
      password: "a-long-test-password",
    })).rejects.toThrow("The existing administrator is inactive");
  });

  it("rejects a different existing administrator", async () => {
    await insertUser({ id: "other-admin", email: "other@example.com", role: "admin" });

    await expect(bootstrapAdministrator(pool, {
      email: "admin@innobuddy.local",
      name: "Administrator",
      password: "a-long-test-password",
    })).rejects.toThrow("A different administrator already exists");
  });

  it("rejects multiple existing administrators", async () => {
    await insertUser({ id: "admin-a", email: "a@example.com", role: "admin" });
    await insertUser({ id: "admin-b", email: "b@example.com", role: "admin" });

    await expect(bootstrapAdministrator(pool, {
      email: "admin@innobuddy.local",
      name: "Administrator",
      password: "a-long-test-password",
    })).rejects.toThrow("Multiple administrators already exist");
  });

  it("rejects an ordinary-user collision, even with different case", async () => {
    await insertUser({ id: "user-id", email: "Admin@Innobuddy.local", role: "user" });

    await expect(bootstrapAdministrator(pool, {
      email: "admin@innobuddy.local",
      name: "Administrator",
      password: "a-long-test-password",
    })).rejects.toThrow("The administrator email already belongs to an ordinary user");
    expect(await users()).toHaveLength(1);
  });

  it("creates exactly one administrator when two bootstraps race", async () => {
    const input = { email: "admin@innobuddy.local", name: "Administrator", password: "a-long-test-password" };
    const results = await Promise.all([
      bootstrapAdministrator(pool, input),
      bootstrapAdministrator(pool, input),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual(["created", "existing"]);
    expect(await users()).toHaveLength(1);
  });
});
