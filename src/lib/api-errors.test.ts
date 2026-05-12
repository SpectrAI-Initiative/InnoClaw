import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import {
  jsonException,
  requiredSearchParam,
  requiredStringFields,
} from "./api-errors";

function requestWithUrl(url: string): NextRequest {
  return { nextUrl: new URL(url) } as NextRequest;
}

describe("api error helpers", () => {
  it("maps access-denied exceptions to 403 JSON errors", async () => {
    const response = jsonException(new Error("Access denied"), "fallback");

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Access denied" });
  });

  it("uses the fallback message for unknown exceptions", async () => {
    const response = jsonException("boom", "Failed to handle request");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to handle request",
    });
  });

  it("returns required search params or a 400 response", async () => {
    expect(
      requiredSearchParam(
        requestWithUrl("http://localhost/api/test?workspaceId=abc"),
        "workspaceId",
      ),
    ).toBe("abc");

    const missing = requiredSearchParam(
      requestWithUrl("http://localhost/api/test"),
      "workspaceId",
    );

    expect(typeof missing).not.toBe("string");
    if (typeof missing !== "string") {
      expect(missing.status).toBe(400);
      await expect(missing.json()).resolves.toEqual({
        error: "Missing workspaceId",
      });
    }
  });

  it("validates required string fields without changing message text", async () => {
    expect(
      requiredStringFields(
        { name: "Report", schedule: "0 9 * * *" },
        ["name", "schedule"],
        "Missing required fields",
      ),
    ).toBeNull();

    const response = requiredStringFields(
      { name: "Report", schedule: "" },
      ["name", "schedule"],
      "Missing required fields",
    );

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toEqual({
      error: "Missing required fields",
    });
  });
});
