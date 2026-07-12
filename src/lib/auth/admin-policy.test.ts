import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  where: vi.fn(),
  eq: vi.fn(() => Symbol("eq")),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mocks.where,
      })),
    })),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  users: {
    id: "id",
    isActive: "isActive",
    role: "role",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: mocks.eq,
}));

import {
  classifyAdministrators,
  getSingleAdminState,
} from "./admin-policy";

const originalSingleAdmin = process.env.AUTH_SINGLE_ADMIN;

beforeEach(() => {
  mocks.where.mockReset();
  mocks.eq.mockClear();
});

afterEach(() => {
  if (originalSingleAdmin === undefined) {
    delete process.env.AUTH_SINGLE_ADMIN;
  } else {
    process.env.AUTH_SINGLE_ADMIN = originalSingleAdmin;
  }
});

describe("single administrator state", () => {
  it("classifies a missing administrator as invalid", () => {
    expect(classifyAdministrators([])).toEqual({
      status: "invalid",
      reason: "missing",
    });
  });

  it("classifies one active administrator as ready", () => {
    expect(
      classifyAdministrators([{ id: "admin-a", isActive: true }]),
    ).toEqual({ status: "ready", adminId: "admin-a" });
  });

  it("classifies the sole inactive administrator as invalid", () => {
    expect(
      classifyAdministrators([{ id: "admin-a", isActive: false }]),
    ).toEqual({ status: "invalid", reason: "inactive" });
  });

  it("classifies multiple administrator rows as invalid", () => {
    expect(
      classifyAdministrators([
        { id: "admin-a", isActive: true },
        { id: "admin-b", isActive: false },
      ]),
    ).toEqual({ status: "invalid", reason: "multiple" });
  });

  it("does not query the database when the policy is disabled", async () => {
    process.env.AUTH_SINGLE_ADMIN = "false";

    await expect(getSingleAdminState()).resolves.toEqual({
      status: "disabled",
    });
    expect(mocks.where).not.toHaveBeenCalled();
  });

  it("queries administrator rows when the policy is enabled", async () => {
    process.env.AUTH_SINGLE_ADMIN = "true";
    mocks.where.mockResolvedValue([{ id: "admin-a", isActive: true }]);

    await expect(getSingleAdminState()).resolves.toEqual({
      status: "ready",
      adminId: "admin-a",
    });
    expect(mocks.eq).toHaveBeenCalledWith("role", "admin");
  });
});
