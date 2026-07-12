import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import UserManagementPage from "./page";

const redirectMock = vi.hoisted(() => vi.fn((path: string) => {
  throw new Error(`redirect:${path}`);
}));
const getAuthContextMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth/server", () => ({
  getAuthContext: getAuthContextMock,
}));

vi.mock("./user-management-client", () => ({
  UserManagementClient: () => <h1>User management</h1>,
}));

const originalAuthMode = process.env.AUTH_MODE;

function authContext(role: "admin" | "user") {
  return {
    user: {
      id: `${role}-1`,
      email: `${role}@example.com`,
      name: role === "admin" ? "Administrator" : "User",
      role,
      isActive: true,
      lastLoginAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    session: {
      id: `session-${role}`,
      expiresAt: "2030-01-01T00:00:00.000Z",
    },
    token: `token-${role}`,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  if (originalAuthMode === undefined) {
    delete process.env.AUTH_MODE;
  } else {
    process.env.AUTH_MODE = originalAuthMode;
  }
});

describe("UserManagementPage", () => {
  it("redirects home when authentication is disabled", async () => {
    process.env.AUTH_MODE = "disabled";

    await expect(async () => UserManagementPage()).rejects.toThrow("redirect:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
    expect(getAuthContextMock).not.toHaveBeenCalled();
  });

  it("redirects home without an authenticated session", async () => {
    getAuthContextMock.mockResolvedValue(null);

    await expect(async () => UserManagementPage()).rejects.toThrow("redirect:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("redirects an ordinary user home", async () => {
    getAuthContextMock.mockResolvedValue(authContext("user"));

    await expect(async () => UserManagementPage()).rejects.toThrow("redirect:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("renders user management for an administrator", async () => {
    getAuthContextMock.mockResolvedValue(authContext("admin"));

    const html = renderToString(await UserManagementPage());

    expect(html).toContain("User management");
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
