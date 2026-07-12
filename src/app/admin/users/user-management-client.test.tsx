import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  singleAdmin: true,
}));

vi.mock("swr", () => ({
  default: () => ({
    data: {
      singleAdmin: mocks.singleAdmin,
      users: [
        {
          id: "admin-id",
          email: "admin@innoclaw.local",
          name: "Administrator",
          role: "admin",
          isActive: true,
          lastLoginAt: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "user-id",
          email: "user@example.com",
          name: "User",
          role: "user",
          isActive: true,
          lastLoginAt: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
    mutate: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock("@/components/layout/header", () => ({
  Header: () => <header />,
}));

import { UserManagementClient } from "./user-management-client";

describe("UserManagementClient", () => {
  it("renders immutable role badges in single-admin mode", () => {
    mocks.singleAdmin = true;

    const html = renderToString(<UserManagementClient />);

    expect(html).not.toContain('role="combobox"');
    expect(html).toContain("Administrator");
    expect(html).toContain("Admin");
    expect(html).toContain("User");
  });

  it("keeps role controls when single-admin mode is disabled", () => {
    mocks.singleAdmin = false;

    const html = renderToString(<UserManagementClient />);

    expect(html).toContain('role="combobox"');
  });
});
