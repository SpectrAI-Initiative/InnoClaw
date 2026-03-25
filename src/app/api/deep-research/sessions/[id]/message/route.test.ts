import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAddMessage = vi.fn();
const mockCreateArtifact = vi.fn();
const mockGetArtifact = vi.fn();
const mockGetNode = vi.fn();
const mockUpdateSession = vi.fn();
const mockEnsureInterfaceShell = vi.fn();
const mockIsInterfaceOnlySession = vi.fn();
const mockStartRun = vi.fn();
const mockIsRunning = vi.fn();
const mockResumeAfterConfirmation = vi.fn();
const mockRequireSession = vi.fn();

vi.mock("@/lib/deep-research/event-store", () => ({
  addMessage: (...args: unknown[]) => mockAddMessage(...args),
  createArtifact: (...args: unknown[]) => mockCreateArtifact(...args),
  getArtifact: (...args: unknown[]) => mockGetArtifact(...args),
  getNode: (...args: unknown[]) => mockGetNode(...args),
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
}));

vi.mock("@/lib/deep-research/interface-shell", () => ({
  ensureInterfaceShell: (...args: unknown[]) => mockEnsureInterfaceShell(...args),
  isInterfaceOnlySession: (...args: unknown[]) => mockIsInterfaceOnlySession(...args),
}));

vi.mock("@/lib/deep-research/run-manager", () => ({
  runManager: {
    startRun: (...args: unknown[]) => mockStartRun(...args),
    isRunning: (...args: unknown[]) => mockIsRunning(...args),
    resumeAfterConfirmation: (...args: unknown[]) => mockResumeAfterConfirmation(...args),
  },
}));

vi.mock("@/lib/deep-research/collaboration-shell", () => ({
  buildHandoffMessage: vi.fn(),
  buildHandoffPacket: vi.fn(),
  buildResearchTaskBoard: vi.fn(),
  buildTaskBoardMessage: vi.fn(),
}));

vi.mock("@/lib/deep-research/role-registry", () => ({
  buildStructuredRoleReply: vi.fn(),
  getStructuredRoleDefinition: vi.fn(),
  RESEARCHER_ROLE_ID: "researcher",
}));

vi.mock("@/lib/deep-research/node-transcript", () => ({
  buildNodeTranscriptMetadata: vi.fn(),
}));

vi.mock("@/lib/deep-research/api-helpers", async () => {
  const { NextResponse } = await import("next/server");

  return {
    badRequest(message: string) {
      throw new Error(message);
    },
    handleDeepResearchRouteError(error: unknown, fallbackMessage: string) {
      const message = error instanceof Error ? error.message : fallbackMessage;
      return NextResponse.json({ error: message }, { status: 500 });
    },
    isRecord(value: unknown) {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    },
    parseOptionalRecord(value: unknown) {
      if (value === undefined || value === null) return undefined;
      if (typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid metadata");
      return value as Record<string, unknown>;
    },
    parseOptionalString(value: unknown) {
      if (value === undefined || value === null) return undefined;
      if (typeof value !== "string") throw new Error("Invalid string");
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : "";
    },
    parseOptionalStringArray(value: unknown) {
      if (value === undefined) return undefined;
      if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
        throw new Error("Invalid string array");
      }
      return value;
    },
    parseRequiredString(value: unknown, message: string) {
      if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(message);
      }
      return value.trim();
    },
    readSessionId: async (params: Promise<{ id: string }>) => (await params).id,
    requireSession: (...args: unknown[]) => mockRequireSession(...args),
  };
});

class FakeNextRequest {
  constructor(private readonly body: unknown) {}

  async json(): Promise<unknown> {
    return this.body;
  }
}

describe("/api/deep-research/sessions/[id]/message", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsInterfaceOnlySession.mockReturnValue(false);
    mockRequireSession.mockResolvedValue({
      id: "session-1",
      status: "awaiting_user_confirmation",
      pendingCheckpointId: "checkpoint-1",
      config: { interfaceOnly: false },
    });
    mockAddMessage.mockResolvedValue({
      id: "message-1",
      role: "user",
      content: "Here is my answer.",
    });
    mockIsRunning.mockReturnValue(false);
    mockStartRun.mockReturnValue(true);
    mockResumeAfterConfirmation.mockReturnValue(true);
  });

  it("auto-resumes when the pending checkpoint requires a clarification answer", async () => {
    mockGetArtifact.mockResolvedValue({
      id: "checkpoint-1",
      artifactType: "checkpoint",
      content: {
        interactionMode: "answer_required",
      },
    });

    const { POST } = await import("@/app/api/deep-research/sessions/[id]/message/route");
    const response = await POST(
      new FakeNextRequest({ content: "Need CPU only, no GPU." }) as never,
      { params: Promise.resolve({ id: "session-1" }) },
    );
    const body = await response.json();

    expect(mockAddMessage).toHaveBeenCalledWith(
      "session-1",
      "user",
      "Need CPU only, no GPU.",
      undefined,
      undefined,
      undefined,
    );
    expect(mockUpdateSession).toHaveBeenCalledWith("session-1", {
      status: "running",
      pendingCheckpointId: null,
    });
    expect(mockStartRun).toHaveBeenCalledWith("session-1");
    expect(body.autoAction).toEqual({
      mode: "resume_after_reply",
      started: true,
    });
  });

  it("does not auto-resume when the pending checkpoint is a normal confirmation gate", async () => {
    mockGetArtifact.mockResolvedValue({
      id: "checkpoint-1",
      artifactType: "checkpoint",
      content: {
        interactionMode: "confirmation",
      },
    });

    const { POST } = await import("@/app/api/deep-research/sessions/[id]/message/route");
    const response = await POST(
      new FakeNextRequest({ content: "I have a comment, but do not continue yet." }) as never,
      { params: Promise.resolve({ id: "session-1" }) },
    );
    const body = await response.json();

    expect(mockAddMessage).toHaveBeenCalledWith(
      "session-1",
      "user",
      "I have a comment, but do not continue yet.",
      undefined,
      undefined,
      undefined,
    );
    expect(mockUpdateSession).not.toHaveBeenCalled();
    expect(mockStartRun).not.toHaveBeenCalled();
    expect(body.autoAction).toEqual({
      mode: "none",
      started: false,
    });
  });

  it("auto-resumes as revision feedback when the user sends actionable instructions at a confirmation gate", async () => {
    mockGetArtifact.mockResolvedValue({
      id: "checkpoint-1",
      artifactType: "checkpoint",
      content: {
        interactionMode: "confirmation",
        nodeId: "node-7",
      },
    });

    const { POST } = await import("@/app/api/deep-research/sessions/[id]/message/route");
    const response = await POST(
      new FakeNextRequest({ content: "清理所有的进程，开始撰写阶段性综述报告，并验证异常年份。" }) as never,
      { params: Promise.resolve({ id: "session-1" }) },
    );
    const body = await response.json();

    expect(mockResumeAfterConfirmation).toHaveBeenCalledWith(
      "session-1",
      "node-7",
      "revision_requested",
      "清理所有的进程，开始撰写阶段性综述报告，并验证异常年份。",
    );
    expect(mockUpdateSession).not.toHaveBeenCalled();
    expect(body.autoAction).toEqual({
      mode: "resume_after_feedback",
      started: true,
    });
  });
});
