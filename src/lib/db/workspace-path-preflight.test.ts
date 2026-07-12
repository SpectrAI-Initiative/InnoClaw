import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { canonicalizePath } from "@/lib/files/canonical-path";
import { preflightWorkspacePaths } from "./workspace-path-preflight";

const sandboxes: string[] = [];

function temporaryDirectory(): string {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "innoclaw-workspace-preflight-"),
  );
  sandboxes.push(directory);
  return directory;
}

function databaseWithWorkspaces(): Database.Database {
  const sqlite = new Database(":memory:");
  sqlite.exec("CREATE TABLE workspaces (id TEXT PRIMARY KEY, folder_path TEXT NOT NULL)");
  return sqlite;
}

afterEach(() => {
  while (sandboxes.length > 0) {
    fs.rmSync(sandboxes.pop()!, { recursive: true, force: true });
  }
});

describe("workspace folder-path migration preflight", () => {
  it("rewrites legacy rows to canonical absolute paths", () => {
    const sqlite = databaseWithWorkspaces();
    const root = temporaryDirectory();
    fs.mkdirSync(path.join(root, "workspace"));
    fs.mkdirSync(path.join(root, "unused"));
    const legacyPath = `${root}${path.sep}unused${path.sep}..${path.sep}workspace`;
    sqlite
      .prepare("INSERT INTO workspaces (id, folder_path) VALUES (?, ?)")
      .run("workspace-a", legacyPath);

    expect(preflightWorkspacePaths(sqlite)).toEqual({ rewritten: 1 });
    expect(
      sqlite
        .prepare("SELECT folder_path AS folderPath FROM workspaces WHERE id = ?")
        .get("workspace-a"),
    ).toEqual({ folderPath: canonicalizePath(legacyPath) });

    sqlite.close();
  });

  it("reports every colliding id without modifying any row", () => {
    const sqlite = databaseWithWorkspaces();
    const root = temporaryDirectory();
    const workspacePath = path.join(root, "workspace");
    fs.mkdirSync(workspacePath);
    fs.mkdirSync(path.join(root, "unused"));
    const legacyAlias = `${root}${path.sep}unused${path.sep}..${path.sep}workspace`;
    const insert = sqlite.prepare(
      "INSERT INTO workspaces (id, folder_path) VALUES (?, ?)",
    );
    insert.run("workspace-a", workspacePath);
    insert.run("workspace-b", legacyAlias);

    expect(() => preflightWorkspacePaths(sqlite)).toThrow(
      /workspace-a.*workspace-b|workspace-b.*workspace-a/,
    );
    expect(
      sqlite
        .prepare("SELECT id, folder_path AS folderPath FROM workspaces ORDER BY id")
        .all(),
    ).toEqual([
      { id: "workspace-a", folderPath: workspacePath },
      { id: "workspace-b", folderPath: legacyAlias },
    ]);

    sqlite.close();
  });

  it("is a no-op when the workspaces table does not exist", () => {
    const sqlite = new Database(":memory:");

    expect(preflightWorkspacePaths(sqlite)).toEqual({ rewritten: 0 });

    sqlite.close();
  });

  it("is a no-op after the unique index already exists", () => {
    const sqlite = databaseWithWorkspaces();
    const root = temporaryDirectory();
    fs.mkdirSync(path.join(root, "workspace"));
    fs.mkdirSync(path.join(root, "unused"));
    const legacyPath = `${root}${path.sep}unused${path.sep}..${path.sep}workspace`;
    sqlite
      .prepare("INSERT INTO workspaces (id, folder_path) VALUES (?, ?)")
      .run("workspace-a", legacyPath);
    sqlite.exec(
      "CREATE UNIQUE INDEX workspaces_folder_path_unique_idx ON workspaces(folder_path)",
    );

    expect(preflightWorkspacePaths(sqlite)).toEqual({ rewritten: 0 });
    expect(
      sqlite
        .prepare("SELECT folder_path AS folderPath FROM workspaces WHERE id = ?")
        .get("workspace-a"),
    ).toEqual({ folderPath: legacyPath });

    sqlite.close();
  });

  it("does not write rows that are already canonical", () => {
    const sqlite = databaseWithWorkspaces();
    const workspacePath = temporaryDirectory();
    const canonicalPath = canonicalizePath(workspacePath);
    sqlite
      .prepare("INSERT INTO workspaces (id, folder_path) VALUES (?, ?)")
      .run("workspace-a", canonicalPath);

    expect(preflightWorkspacePaths(sqlite)).toEqual({ rewritten: 0 });

    sqlite.close();
  });
});
