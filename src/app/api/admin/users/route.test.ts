import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, GET, PATCH, POST } from "./route";

const originalAuthMode = process.env.AUTH_MODE;

function request(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/users", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  if (originalAuthMode === undefined) {
    delete process.env.AUTH_MODE;
  } else {
    process.env.AUTH_MODE = originalAuthMode;
  }
});

describe("/api/admin/users disabled auth", () => {
  it("rejects user listing when auth is disabled", async () => {
    process.env.AUTH_MODE = "disabled";

    const response = await GET(request("GET"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("User management is disabled when authentication is disabled");
  });

  it("rejects user creation when auth is disabled", async () => {
    process.env.AUTH_MODE = "disabled";

    const response = await POST(request("POST", {
      email: "user@example.com",
      password: "password123",
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("User management is disabled when authentication is disabled");
  });

  it("rejects user updates when auth is disabled", async () => {
    process.env.AUTH_MODE = "disabled";

    const response = await PATCH(request("PATCH", {
      userId: "user-id",
      role: "admin",
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("User management is disabled when authentication is disabled");
  });

  it("rejects user deletion when auth is disabled", async () => {
    process.env.AUTH_MODE = "disabled";

    const response = await DELETE(request("DELETE", {
      userId: "user-id",
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("User management is disabled when authentication is disabled");
  });
});
