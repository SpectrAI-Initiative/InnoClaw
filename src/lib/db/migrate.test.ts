import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  migrate: vi.fn(),
}));

vi.mock("drizzle-orm/mysql2/migrator", () => ({ migrate: mocks.migrate }));
vi.mock("./index", () => ({
  db: { kind: "db" },
  getPool: () => ({
    getConnection: async () => ({ query: mocks.query, release: mocks.release }),
  }),
}));

function lockResult(acquired: number | null) {
  return [[{ acquired }], []];
}

describe("runMigrations", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.query.mockReset();
    mocks.release.mockReset();
    mocks.migrate.mockReset();
    delete (globalThis as { __innoscaleMigrationPromise?: unknown }).__innoscaleMigrationPromise;
  });

  afterEach(() => {
    delete (globalThis as { __innoscaleMigrationPromise?: unknown }).__innoscaleMigrationPromise;
  });

  it("migrates while holding the advisory lock, then releases it", async () => {
    mocks.query.mockResolvedValueOnce(lockResult(1)).mockResolvedValueOnce([[], []]);
    mocks.migrate.mockResolvedValue(undefined);

    const { runMigrations, MIGRATION_LOCK_NAME } = await import("./migrate");
    await runMigrations();

    expect(mocks.query.mock.calls[0]).toEqual([
      "SELECT GET_LOCK(?, ?) AS acquired",
      [MIGRATION_LOCK_NAME, 120],
    ]);
    expect(mocks.migrate).toHaveBeenCalledWith(
      { kind: "db" },
      { migrationsFolder: expect.stringMatching(/drizzle$/) },
    );
    expect(mocks.query.mock.calls[1]).toEqual([
      "SELECT RELEASE_LOCK(?)",
      [MIGRATION_LOCK_NAME],
    ]);
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });

  it("runs only once per process", async () => {
    mocks.query.mockResolvedValueOnce(lockResult(1)).mockResolvedValueOnce([[], []]);
    mocks.migrate.mockResolvedValue(undefined);

    const { runMigrations } = await import("./migrate");
    await Promise.all([runMigrations(), runMigrations()]);
    await runMigrations();

    expect(mocks.migrate).toHaveBeenCalledTimes(1);
  });

  it("releases the lock and connection when a migration fails, and allows a retry", async () => {
    mocks.query
      .mockResolvedValueOnce(lockResult(1))
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce(lockResult(1))
      .mockResolvedValueOnce([[], []]);
    mocks.migrate
      .mockRejectedValueOnce(new Error("bad statement"))
      .mockResolvedValueOnce(undefined);

    const { runMigrations } = await import("./migrate");
    await expect(runMigrations()).rejects.toThrow("bad statement");
    expect(mocks.query.mock.calls[1][0]).toBe("SELECT RELEASE_LOCK(?)");
    expect(mocks.release).toHaveBeenCalledTimes(1);

    await expect(runMigrations()).resolves.toBeUndefined();
    expect(mocks.migrate).toHaveBeenCalledTimes(2);
  });

  it("fails clearly when another instance holds the lock too long", async () => {
    mocks.query.mockResolvedValueOnce(lockResult(0));

    const { runMigrations } = await import("./migrate");
    await expect(runMigrations()).rejects.toThrow(/waiting for another instance/);
    expect(mocks.migrate).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
});
