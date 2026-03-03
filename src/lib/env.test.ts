/**
 * Unit tests for cross-platform environment utilities.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import os from "os";

describe("buildSafeExecEnv", () => {
  const originalPlatform = process.platform;
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  async function loadModule() {
    const mod = await import("./env");
    return mod.buildSafeExecEnv;
  }

  it("should always include PATH, HOME, NODE_ENV, TERM, and LANG", async () => {
    const buildSafeExecEnv = await loadModule();
    const env = buildSafeExecEnv();
    expect(env.PATH).toBeDefined();
    expect(env.HOME).toBeDefined();
    expect(env.NODE_ENV).toBeDefined();
    expect(env.TERM).toBe("dumb");
    expect(env.LANG).toBeDefined();
  });

  it("should use os.homedir() when HOME and USERPROFILE are unset", async () => {
    delete process.env.HOME;
    delete process.env.USERPROFILE;
    const buildSafeExecEnv = await loadModule();
    const env = buildSafeExecEnv();
    expect(env.HOME).toBe(os.homedir());
  });

  it("should prefer process.env.HOME when available", async () => {
    process.env.HOME = "/custom/home";
    const buildSafeExecEnv = await loadModule();
    const env = buildSafeExecEnv();
    expect(env.HOME).toBe("/custom/home");
  });

  it("should provide Unix PATH fallback on non-Windows platforms", async () => {
    delete process.env.PATH;
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    const buildSafeExecEnv = await loadModule();
    const env = buildSafeExecEnv();
    expect(env.PATH).toBe("/usr/local/bin:/usr/bin:/bin");
  });

  it("should provide Windows PATH fallback on win32", async () => {
    delete process.env.PATH;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    const buildSafeExecEnv = await loadModule();
    const env = buildSafeExecEnv();
    expect(env.PATH).toBe("C:\\Windows\\system32;C:\\Windows");
  });

  it("should include Windows-specific env vars on win32", async () => {
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    process.env.SYSTEMROOT = "C:\\Windows";
    process.env.COMSPEC = "C:\\Windows\\system32\\cmd.exe";
    const buildSafeExecEnv = await loadModule();
    const env = buildSafeExecEnv();
    expect(env.SYSTEMROOT).toBe("C:\\Windows");
    expect(env.COMSPEC).toBe("C:\\Windows\\system32\\cmd.exe");
    expect(env.PATHEXT).toBeDefined();
    expect(env.TEMP).toBeDefined();
    expect(env.TMP).toBeDefined();
    expect(env.USERPROFILE).toBeDefined();
  });

  it("should NOT include Windows-specific env vars on Linux", async () => {
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    const buildSafeExecEnv = await loadModule();
    const env = buildSafeExecEnv();
    expect(env.SYSTEMROOT).toBeUndefined();
    expect(env.COMSPEC).toBeUndefined();
    expect(env.PATHEXT).toBeUndefined();
  });

  it("should merge extra env vars", async () => {
    const buildSafeExecEnv = await loadModule();
    const env = buildSafeExecEnv({ MY_VAR: "hello" });
    expect(env.MY_VAR).toBe("hello");
    expect(env.PATH).toBeDefined();
  });

  it("should provide hardcoded SYSTEMROOT and COMSPEC fallbacks on win32", async () => {
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    delete process.env.SYSTEMROOT;
    delete process.env.SystemRoot;
    delete process.env.COMSPEC;
    const buildSafeExecEnv = await loadModule();
    const env = buildSafeExecEnv();
    expect(env.SYSTEMROOT).toBe("C:\\Windows");
    expect(env.COMSPEC).toBe("C:\\Windows\\system32\\cmd.exe");
  });
});

describe("resolveHome", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  async function loadResolveHome() {
    const mod = await import("./env");
    return mod.resolveHome;
  }

  it("should return HOME when set", async () => {
    process.env.HOME = "/my/home";
    const resolveHome = await loadResolveHome();
    expect(resolveHome()).toBe("/my/home");
  });

  it("should fall back to USERPROFILE when HOME is unset", async () => {
    delete process.env.HOME;
    process.env.USERPROFILE = "C:\\Users\\test";
    const resolveHome = await loadResolveHome();
    expect(resolveHome()).toBe("C:\\Users\\test");
  });

  it("should fall back to os.homedir() when both are unset", async () => {
    delete process.env.HOME;
    delete process.env.USERPROFILE;
    const resolveHome = await loadResolveHome();
    expect(resolveHome()).toBe(os.homedir());
  });
});
