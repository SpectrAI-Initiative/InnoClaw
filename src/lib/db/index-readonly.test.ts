import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tempDir = path.join(os.tmpdir(), "innoclaw-db-index-readonly");
const dbPath = path.join(tempDir, "innoclaw.db");

vi.mock("better-sqlite3", () => {
  class FakeDatabase {
    constructor(public readonly filename: string) {}

    pragma(sql: string) {
      if (sql.includes("journal_mode")) {
        const error = Object.assign(
          new Error("attempt to write a readonly database"),
          { code: "SQLITE_READONLY" }
        );
        throw error;
      }
    }
  }

  return { default: FakeDatabase };
});

vi.mock("drizzle-orm/better-sqlite3", () => ({
  drizzle: vi.fn(() => ({ mocked: true })),
}));

vi.mock("../dev/project-filesystem", () => ({
  assessPathLocking: () => ({ disableLock: false }),
}));

describe("db startup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });
    process.env.DATABASE_URL = dbPath;
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("throws a startup error with guidance when the database is read-only", async () => {
    const error = (await import("./index").catch((err: unknown) => err)) as Error;

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain(
      "SQLite database is read-only during startup"
    );
    expect(error.message).toContain("DATABASE_URL");
    expect(error.message).toContain("writable local filesystem path");
    expect(error.message).toContain("/app/data");
    expect(error.message).toContain("shared filesystem");
  });
});
