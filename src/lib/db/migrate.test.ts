import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalNodeEnv = process.env.NODE_ENV;
const temporaryDirectories: string[] = [];
let appDatabaseLoaded = false;

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

afterEach(async () => {
  if (appDatabaseLoaded) {
    const databaseModule = await import("./index");
    if (databaseModule.sqlite.open) {
      databaseModule.sqlite.close();
    }
  }
  appDatabaseLoaded = false;
  restoreEnv("DATABASE_URL", originalDatabaseUrl);
  restoreEnv("NODE_ENV", originalNodeEnv);
  delete (globalThis as typeof globalThis & {
    __innoclawMigrationPromise?: Promise<void>;
  }).__innoclawMigrationPromise;
  vi.resetModules();
  while (temporaryDirectories.length > 0) {
    fs.rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe("database migration fallback", () => {
  it("does not seed the new workspace-path index before it exists", async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "innoclaw-migrate-fallback-"),
    );
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "legacy.db");
    const legacy = new Database(databasePath);
    legacy.exec(`
      CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        folder_path TEXT NOT NULL
      );
    `);
    legacy.close();

    process.env.DATABASE_URL = databasePath;
    Reflect.set(process.env, "NODE_ENV", "production");
    vi.resetModules();
    const { runMigrations } = await import("./migrate");
    appDatabaseLoaded = true;

    await runMigrations();

    const inspected = new Database(databasePath, { readonly: true });
    expect(
      inspected
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?",
        )
        .get("workspaces_folder_path_unique_idx"),
    ).toEqual({ name: "workspaces_folder_path_unique_idx" });
    inspected.close();
  });
});
