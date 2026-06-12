import { afterEach, describe, expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireAdmin, requireAuth } from "./server";

const originalAuthMode = process.env.AUTH_MODE;

function requestFor(path: string) {
  return new NextRequest(new URL(path, "http://localhost"));
}

afterEach(() => {
  if (originalAuthMode === undefined) {
    delete process.env.AUTH_MODE;
  } else {
    process.env.AUTH_MODE = originalAuthMode;
  }
});

describe("server auth disabled mode", () => {
  it("returns anonymous admin auth without cookies", async () => {
    process.env.AUTH_MODE = "disabled";

    const auth = await getAuthContext(requestFor("/api/workspaces"));

    expect(auth?.user).toMatchObject({
      id: "anonymous-admin",
      email: "anonymous@local",
      role: "admin",
      isActive: true,
    });
    expect(auth?.session.id).toBe("anonymous-disabled-auth");
  });

  it("makes requireAuth succeed without cookies", async () => {
    process.env.AUTH_MODE = "disabled";

    const auth = await requireAuth(requestFor("/api/workspaces"));

    expect(auth).not.toBeInstanceOf(NextResponse);
    if (!(auth instanceof NextResponse)) {
      expect(auth.user.id).toBe("anonymous-admin");
    }
  });

  it("makes requireAdmin succeed without cookies", async () => {
    process.env.AUTH_MODE = "disabled";

    const auth = await requireAdmin(requestFor("/api/settings"));

    expect(auth).not.toBeInstanceOf(NextResponse);
    if (!(auth instanceof NextResponse)) {
      expect(auth.user.role).toBe("admin");
    }
  });
});
