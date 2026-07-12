import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/server";

const mocks = vi.hoisted(() => ({
  canUseHighRiskExecution: vi.fn(),
  catalogRows: [] as unknown[],
  createAgentTools: vi.fn(),
  ensureProjectDefaultSkills: vi.fn(),
  requirePathAccess: vi.fn(),
  requireSkillAccess: vi.fn(),
  requireWorkspaceAccess: vi.fn(),
  skillRows: [] as unknown[],
}));

vi.mock("ai", () => ({
  convertToModelMessages: vi.fn(async () => []),
  stepCountIs: vi.fn(() => "stop-condition"),
  streamText: vi.fn(() => ({
    toUIMessageStreamResponse: () => new Response("ok"),
  })),
}));
vi.mock("@/lib/ai/provider", () => ({
  isAIAvailable: () => true,
  getConfiguredModelWithProvider: vi.fn(async () => ({
    providerId: "openai",
    model: { modelId: "test-model" },
  })),
  getModelFromOverride: vi.fn(() => ({
    providerId: "openai",
    model: { modelId: "test-model" },
  })),
}));
vi.mock("@/lib/ai/tools", () => ({
  createAgentTools: mocks.createAgentTools,
}));
vi.mock("@/lib/ai/prompts", () => ({
  buildAgentSystemPrompt: () => "agent prompt",
  buildAgentLongSystemPrompt: () => "long prompt",
  buildPlanSystemPrompt: () => "plan prompt",
  buildAskSystemPrompt: () => "ask prompt",
}));
vi.mock("@/lib/ai/skill-prompt", () => ({
  buildSkillSystemPrompt: () => "skill prompt",
}));
vi.mock("@/lib/ai/runtime-capabilities", () => ({
  runtimeProviderSupportsTools: () => true,
}));
vi.mock("@/lib/db/default-skills", () => ({
  ensureProjectDefaultSkills: mocks.ensureProjectDefaultSkills,
}));
vi.mock("@/lib/db/skills-utils", () => ({
  parseSkillRow: (row: unknown) => row,
}));
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Object.assign(
          Promise.resolve(mocks.catalogRows),
          { limit: vi.fn(() => Promise.resolve(mocks.skillRows)) },
        )),
      })),
    })),
  },
}));
vi.mock("@/lib/auth/ownership", () => ({
  requirePathAccess: mocks.requirePathAccess,
  requireSkillAccess: mocks.requireSkillAccess,
  requireWorkspaceAccess: mocks.requireWorkspaceAccess,
}));
vi.mock("@/lib/auth/privileges", () => ({
  canUseHighRiskExecution: mocks.canUseHighRiskExecution,
}));

import { POST } from "./route";

function userAuth(): AuthContext {
  return {
    user: {
      id: "user-a",
      email: "user-a@example.com",
      name: "User A",
      role: "user",
      isActive: true,
      lastLoginAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    session: {
      id: "session-a",
      expiresAt: "2027-01-01T00:00:00.000Z",
    },
    token: "token-a",
  };
}

function request(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/agent", {
    method: "POST",
    body: JSON.stringify({
      messages: [],
      workspaceId: "workspace-a",
      cwd: "/research/users/user-a/workspace/subdir",
      ...body,
    }),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  const auth = userAuth();
  mocks.canUseHighRiskExecution.mockReturnValue(false);
  mocks.createAgentTools.mockResolvedValue({});
  mocks.ensureProjectDefaultSkills.mockResolvedValue(undefined);
  mocks.requireWorkspaceAccess.mockResolvedValue({
    auth,
    workspace: {
      id: "workspace-a",
      folderPath: "/research/users/user-a/workspace",
    },
  });
  mocks.requirePathAccess.mockResolvedValue({ auth, canonicalPaths: [] });
  mocks.requireSkillAccess.mockResolvedValue({ auth, skill: { id: "skill-a" } });
  mocks.catalogRows = [];
  mocks.skillRows = [{
    id: "skill-a",
    isEnabled: true,
    workspaceId: "workspace-a",
    allowedTools: ["readFile"],
  }];
});

describe("POST /api/agent tool access context", () => {
  it.each([
    ["default", {}, undefined],
    ["plan", { mode: "plan" }, ["readFile", "listDirectory", "grep"]],
    ["ask", { mode: "ask" }, ["readFile", "listDirectory", "grep"]],
    ["skill", { skillId: "skill-a" }, ["readFile"]],
  ] as Array<[string, Record<string, unknown>, string[] | undefined]>)(
    "passes the selected workspace boundary in %s mode",
    async (_name, body, expectedAllowedTools) => {
      const response = await POST(request(body));

      expect(response.status).toBe(200);
      expect(mocks.canUseHighRiskExecution).toHaveBeenCalledWith(userAuth());
      expect(mocks.createAgentTools).toHaveBeenCalledWith(
        "/research/users/user-a/workspace/subdir",
        expectedAllowedTools,
        "workspace-a",
        undefined,
        false,
        {
          workspaceRoot: "/research/users/user-a/workspace",
          allowHighRisk: false,
        },
      );
    },
  );
});
