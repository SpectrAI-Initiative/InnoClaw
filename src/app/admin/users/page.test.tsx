import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import UserManagementPage from "./page";

const redirectMock = vi.hoisted(() => vi.fn((path: string) => {
  throw new Error(`redirect:${path}`);
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/components/layout/header", () => ({
  Header: () => <header />,
}));

const originalAuthMode = process.env.AUTH_MODE;

afterEach(() => {
  redirectMock.mockClear();
  if (originalAuthMode === undefined) {
    delete process.env.AUTH_MODE;
  } else {
    process.env.AUTH_MODE = originalAuthMode;
  }
});

describe("UserManagementPage", () => {
  it("redirects home when authentication is disabled", () => {
    process.env.AUTH_MODE = "disabled";

    expect(() => renderToString(<UserManagementPage />)).toThrow("redirect:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});
