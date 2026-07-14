import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  insertValues: vi.fn(),
  requireWorkspaceAccess: vi.fn(),
  selectLimit: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: mocks.generateText,
}));

vi.mock("@/lib/ai/provider", () => ({
  getConfiguredModel: vi.fn(async () => ({ modelId: "test-model" })),
  isAIAvailable: vi.fn(() => true),
}));

vi.mock("@/lib/ai/prompts", () => ({
  buildCompactSummaryPrompt: vi.fn(() => "compact prompt"),
  buildMemorySummarizationPrompt: vi.fn(() => "memory prompt"),
}));

vi.mock("@/lib/ai/models", () => ({
  getSummarizationLimitChars: vi.fn(() => 10_000),
}));

vi.mock("@/lib/auth/ownership", () => ({
  requireWorkspaceAccess: mocks.requireWorkspaceAccess,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mocks.selectLimit,
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: mocks.insertValues,
    })),
  },
}));

import { POST } from "./route";

function request(): NextRequest {
  return new NextRequest("http://localhost/api/agent/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: "workspace-b",
      messages: [
        {
          role: "user",
          parts: [{ type: "text", text: "private workspace content" }],
        },
      ],
      locale: "en",
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generateText.mockResolvedValue({ text: "summary" });
  mocks.insertValues.mockResolvedValue(undefined);
  mocks.selectLimit
    .mockResolvedValueOnce([{ value: "openai" }])
    .mockResolvedValueOnce([{ value: "gpt-5.6-sol" }])
    .mockResolvedValueOnce([{
      id: "note-id",
      workspaceId: "workspace-b",
      title: "summary",
      content: "summary",
      type: "memory",
    }]);
});

describe("POST /api/agent/summarize", () => {
  it("rejects an inaccessible workspace before generation or insertion", async () => {
    mocks.requireWorkspaceAccess.mockResolvedValue(
      NextResponse.json(
        { error: "Workspace access denied" },
        { status: 403 },
      ),
    );

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mocks.requireWorkspaceAccess).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "workspace-b",
    );
    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });
});

