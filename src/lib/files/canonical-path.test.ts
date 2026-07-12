import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PathAccessError,
  canonicalizePath,
  isPathWithinRoot,
  resolvePathWithinRoots,
} from "./canonical-path";

describe("canonical workspace path containment", () => {
  let sandbox: string;
  let userA: string;
  let userB: string;

  beforeEach(() => {
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "innoclaw-canonical-path-"));
    userA = path.join(sandbox, "user-a");
    userB = path.join(sandbox, "user-b");
    fs.mkdirSync(userA);
    fs.mkdirSync(userB);
  });

  afterEach(() => {
    fs.rmSync(sandbox, { recursive: true, force: true });
  });

  it("canonicalizes a missing leaf beneath an allowed root", () => {
    const prospective = path.join(userA, "notes", "draft.md");
    const canonicalProspective = path.join(
      fs.realpathSync(userA),
      "notes",
      "draft.md",
    );

    expect(canonicalizePath(prospective)).toBe(canonicalProspective);
    expect(resolvePathWithinRoots(prospective, [userA])).toBe(canonicalProspective);
  });

  it("rejects lexical traversal into a sibling root", () => {
    expect(() =>
      resolvePathWithinRoots(path.join(userA, "..", "user-b"), [userA]),
    ).toThrow(PathAccessError);
  });

  it("rejects a missing leaf reached through a symlink escape", (context) => {
    const escape = path.join(userA, "escape");
    try {
      fs.symlinkSync(userB, escape, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (process.platform === "win32" && (code === "EPERM" || code === "EACCES")) {
        context.skip();
        return;
      }
      throw error;
    }

    expect(() =>
      resolvePathWithinRoots(path.join(escape, "secret.md"), [userA]),
    ).toThrow(PathAccessError);
  });

  it("requires absolute paths", () => {
    expect(() => resolvePathWithinRoots("relative/path", [userA])).toThrow(
      /absolute/i,
    );
  });

  it("uses case-sensitive comparisons on Linux and case-insensitive comparisons on Windows", () => {
    expect(isPathWithinRoot("/Research/User-A", "/research/user-a", "linux")).toBe(
      false,
    );
    expect(isPathWithinRoot("/Research/User-A", "/research/user-a", "win32")).toBe(
      true,
    );
  });

  it("rejects null bytes before probing the filesystem", () => {
    expect(() => canonicalizePath(`${userA}\0secret`)).toThrow(PathAccessError);
  });
});
