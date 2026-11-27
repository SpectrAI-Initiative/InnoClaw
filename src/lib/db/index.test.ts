import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "./index";
import { isUniqueConstraintError } from "./errors";

describe("resolveDatabaseUrl", () => {
  it("accepts a mysql:// connection string", () => {
    const url = resolveDatabaseUrl("mysql://app:p%40ss@10.0.0.5:3306/innoscale");
    expect(url.hostname).toBe("10.0.0.5");
    expect(url.port).toBe("3306");
    expect(decodeURIComponent(url.password)).toBe("p@ss");
    expect(url.pathname).toBe("/innoscale");
  });

  it("rejects a missing value", () => {
    expect(() => resolveDatabaseUrl(undefined)).toThrow(/DATABASE_URL is not set/);
    expect(() => resolveDatabaseUrl("  ")).toThrow(/DATABASE_URL is not set/);
  });

  it("rejects an old SQLite file path with a migration hint", () => {
    expect(() => resolveDatabaseUrl("./data/innoscale.db")).toThrow(/SQLite file paths are no longer supported/);
    expect(() => resolveDatabaseUrl("file:./data/innoscale.db")).toThrow(/mysql:\/\//);
  });

  it("requires a database name", () => {
    expect(() => resolveDatabaseUrl("mysql://app:pw@db.internal:3306/")).toThrow(/database name/);
  });
});

describe("isUniqueConstraintError", () => {
  it("detects a raw mysql2 duplicate-key error", () => {
    expect(isUniqueConstraintError(Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY", errno: 1062 }))).toBe(true);
  });

  it("detects a duplicate-key error wrapped by Drizzle", () => {
    const driverError = Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY", errno: 1062 });
    expect(isUniqueConstraintError(new Error("Failed query", { cause: driverError }))).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isUniqueConstraintError(Object.assign(new Error("fk"), { code: "ER_NO_REFERENCED_ROW_2", errno: 1452 }))).toBe(false);
    expect(isUniqueConstraintError(new Error("plain"))).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
  });
});

describe("isMissingTableError", () => {
  it("detects ER_NO_SUCH_TABLE through Drizzle's cause chain", async () => {
    const { isMissingTableError } = await import("./errors");
    const driverError = Object.assign(new Error("Table 'x.app_settings' doesn't exist"), { code: "ER_NO_SUCH_TABLE", errno: 1146 });
    expect(isMissingTableError(new Error("Failed query", { cause: driverError }))).toBe(true);
    expect(isMissingTableError(new Error("other"))).toBe(false);
  });
});
