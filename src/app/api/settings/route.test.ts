import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/server";

const mocks = vi.hoisted(() => ({
  ensureEffectiveWorkspaceRoots: vi.fn(),
  getCurrentEnv: vi.fn(),
  getK8sConfig: vi.fn(),
  requireAdmin: vi.fn(),
  requireAuth: vi.fn(),
  settingsRows: [] as Array<{ key: string; value: string }>,
}));

vi.mock("@/lib/auth/server", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/server")>(),
  requireAdmin: mocks.requireAdmin,
  requireAuth: mocks.requireAuth,
}));

vi.mock("@/lib/auth/workspace-roots", () => ({
  ensureEffectiveWorkspaceRoots: mocks.ensureEffectiveWorkspaceRoots,
}));

vi.mock("@/lib/ai/provider-env", () => ({
  getCurrentEnv: mocks.getCurrentEnv,
}));

vi.mock("@/lib/cluster/config", () => ({
  getK8sConfig: mocks.getK8sConfig,
  invalidateK8sConfigCache: vi.fn(),
  SETTINGS_TO_ENV: {},
}));

vi.mock("@/lib/env-file", () => ({
  updateEnvLocal: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => Promise.resolve(mocks.settingsRows)),
    })),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

import { GET, PATCH } from "./route";

function authContext(role: "admin" | "user"): AuthContext {
  const id = role === "admin" ? "admin-id" : "user-a";
  return {
    user: {
      id,
      email: `${id}@example.com`,
      name: id,
      role,
      isActive: true,
      lastLoginAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    session: {
      id: `session-${id}`,
      expiresAt: "2027-01-01T00:00:00.000Z",
    },
    token: `token-${id}`,
  };
}

function request(method = "GET", body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/settings", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.settingsRows = [
    { key: "context_mode", value: "normal" },
    { key: "max_mode", value: "true" },
    { key: "style_theme", value: "default" },
  ];
  mocks.getCurrentEnv.mockReturnValue({
    LLM_PROVIDER: "openai",
    LLM_MODEL: "gpt-5.6-sol",
    OPENAI_API_KEY: "configured-not-returned",
    OPENAI_BASE_URL: "http://provider.internal/v1",
    GITHUB_TOKEN: "configured-not-returned",
    HF_TOKEN: "configured-not-returned",
  });
  mocks.getK8sConfig.mockResolvedValue({ apiUrl: "https://cluster.internal" });
});

describe("GET /api/settings", () => {
  it("returns only the safe role-aware contract to an ordinary user", async () => {
    const user = authContext("user");
    mocks.requireAuth.mockResolvedValue(user);
    mocks.ensureEffectiveWorkspaceRoots.mockReturnValue([
      "/research/users/user-a",
    ]);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      llmProvider: "openai",
      llmModel: "gpt-5.6-sol",
      contextMode: "normal",
      maxMode: true,
      workspaceRoots: ["/research/users/user-a"],
      defaultBrowsePath: "/research/users/user-a",
      hasAIKey: true,
      configuredProviders: ["openai"],
    });
    expect(body).not.toHaveProperty("providerBaseUrls");
    expect(body).not.toHaveProperty("k8sConfig");
    expect(body).not.toHaveProperty("hasGithubToken");
    expect(mocks.getK8sConfig).not.toHaveBeenCalled();
  });

  it("retains privileged settings for an administrator", async () => {
    const admin = authContext("admin");
    mocks.requireAuth.mockResolvedValue(admin);
    mocks.ensureEffectiveWorkspaceRoots.mockReturnValue(["/research"]);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      workspaceRoots: ["/research"],
      defaultBrowsePath: "/research",
      hasGithubToken: true,
      hasHfToken: true,
      providerBaseUrls: {
        openai: "http://provider.internal/v1",
      },
      k8sConfig: { apiUrl: "https://cluster.internal" },
    });
    expect(mocks.getK8sConfig).toHaveBeenCalledOnce();
  });
});

describe("PATCH /api/settings", () => {
  it("continues to reject ordinary users", async () => {
    mocks.requireAdmin.mockResolvedValue(
      NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    );

    const response = await PATCH(
      request("PATCH", { llm_model: "another-model" }),
    );

    expect(response.status).toBe(403);
  });
});
