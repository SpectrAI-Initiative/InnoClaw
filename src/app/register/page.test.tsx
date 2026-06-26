import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import RegisterPage from "./page";

const replaceMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());
const completeCliBrowserHandoffMock = vi.hoisted(() => vi.fn().mockResolvedValue(true));
const capturedButtonClicks = vi.hoisted(() => new Map<string, () => unknown>());

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: (effect: () => void | (() => void)) => effect(),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock,
  }),
  useSearchParams: () =>
    new URLSearchParams({
      cliCallback: "http://127.0.0.1:43123/callback",
      cliNonce: "nonce-123",
      next: "/workspace",
    }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("lucide-react", () => ({
  UserPlus: () => <span />,
}));

vi.mock("@/lib/hooks/use-auth", () => ({
  useAuthUser: () => ({
    user: {
      id: "user-1",
      email: "user@example.com",
      name: "User",
      role: "user",
      isActive: true,
    },
    isAuthDisabled: false,
  }),
}));

vi.mock("@/lib/auth/cli-handoff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/cli-handoff")>();
  return {
    ...actual,
    completeCliBrowserHandoff: completeCliBrowserHandoffMock,
  };
});

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => unknown;
    type?: "button" | "submit";
  }) => {
    if (props.type === "button" && onClick) {
      capturedButtonClicks.set(String(children), onClick);
    }
    return <button {...props}>{children}</button>;
  },
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

afterEach(() => {
  replaceMock.mockClear();
  refreshMock.mockClear();
  completeCliBrowserHandoffMock.mockClear();
  capturedButtonClicks.clear();
});

describe("RegisterPage", () => {
  it("waits for explicit action before completing an authenticated CLI handoff", async () => {
    const html = renderToString(<RegisterPage />);

    expect(html).toContain("Complete CLI sign-in");
    expect(completeCliBrowserHandoffMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();

    const click = [...capturedButtonClicks.values()][0];
    expect(click).toBeDefined();
    await click();

    expect(completeCliBrowserHandoffMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/workspace");
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
