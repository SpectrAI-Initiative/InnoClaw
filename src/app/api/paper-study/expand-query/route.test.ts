import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generateText: vi.fn() }));

vi.mock("ai", () => ({ generateText: mocks.generateText }));
vi.mock("@/lib/ai/provider", () => ({
  isAIAvailable: () => true,
  getConfiguredModel: vi.fn(async () => ({ modelId: "test" })),
  getModelFromOverride: vi.fn(() => ({ model: { modelId: "test" } })),
}));

import { POST } from "./route";

function request(question: unknown) {
  return new NextRequest("http://localhost/api/paper-study/expand-query", {
    method: "POST",
    body: JSON.stringify({ question }),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/paper-study/expand-query", () => {
  it("caps the expanded keywords at four and trims them", async () => {
    mocks.generateText.mockResolvedValue({
      text: JSON.stringify({
        keywords: [" lithium-ion battery ", "lithium battery", "battery degradation", "state of health", "battery materials", "solid-state electrolyte"],
        query: "lithium-ion battery research",
      }),
    });

    const res = await POST(request("锂电池"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.keywords).toEqual(["lithium-ion battery", "lithium battery", "battery degradation", "state of health"]);
  });

  it("asks the model for 2-4 precise English keywords", async () => {
    mocks.generateText.mockResolvedValue({ text: '{"keywords":["x"],"query":"x"}' });

    await POST(request("锂电池"));

    const system = mocks.generateText.mock.calls[0][0].system as string;
    expect(system).toContain("2-4 concise English keyword phrases");
    expect(system).toContain("Do NOT add broad or tangential terms");
  });

  it("rejects an empty question", async () => {
    const res = await POST(request("  "));
    expect(res.status).toBe(400);
  });
});
