import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runAgentStreamMock = vi.fn();
const ensureWorkspaceMock = vi.fn();

vi.mock("../../../plugins/innoclaw-cli/src/agent-client.mjs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../plugins/innoclaw-cli/src/agent-client.mjs")>();
  return {
    ...actual,
    runAgentStream: runAgentStreamMock,
  };
});

vi.mock("../../../plugins/innoclaw-cli/src/workspace-client.mjs", () => ({
  ensureWorkspace: ensureWorkspaceMock,
}));

describe("innoclaw-cli batch client", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "innoclaw-batch-test-"));
    runAgentStreamMock.mockReset();
    ensureWorkspaceMock.mockReset();
    ensureWorkspaceMock.mockResolvedValue({ id: "workspace-1", name: "Workspace" });
    runAgentStreamMock.mockImplementation(async (_apiClient, { messages }) => ({
      messages: [
        ...messages,
        {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "done" }],
        },
      ],
    }));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  async function writeBatch(entries: unknown[]) {
    const inputPath = path.join(tempDir, "batch.json");
    await writeFile(inputPath, JSON.stringify(entries), "utf-8");
    return inputPath;
  }

  it("uses the batch default mode unless an entry provides its own valid mode", async () => {
    const inputPath = await writeBatch([
      { id: "default-mode", prompt: "Use the default" },
      { id: "entry-mode", prompt: "Use the entry", mode: "ask" },
    ]);

    const { runBatch } = await import("../../../plugins/innoclaw-cli/src/batch-client.mjs");
    await runBatch({}, {
      inputPath,
      defaultCwd: tempDir,
      defaultMode: "plan",
      workers: 1,
      outputDir: path.join(tempDir, "runs"),
    });

    expect(runAgentStreamMock).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({
      mode: "plan",
    }));
    expect(runAgentStreamMock).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({
      mode: "ask",
    }));
  });

  it("rejects batch entries with an unsupported mode", async () => {
    const inputPath = await writeBatch([
      { id: "bad-mode", prompt: "Nope", mode: "review" },
    ]);

    const { runBatch } = await import("../../../plugins/innoclaw-cli/src/batch-client.mjs");

    await expect(runBatch({}, {
      inputPath,
      defaultCwd: tempDir,
      outputDir: path.join(tempDir, "runs"),
    })).rejects.toThrow("Batch item 1 has unsupported mode: review");
  });

  it("writes the selected mode to batch results", async () => {
    const inputPath = await writeBatch([
      { id: "long", prompt: "Run long", mode: "long-agent" },
    ]);

    const { runBatch } = await import("../../../plugins/innoclaw-cli/src/batch-client.mjs");
    const result = await runBatch({}, {
      inputPath,
      defaultCwd: tempDir,
      workers: 1,
      outputDir: path.join(tempDir, "runs"),
    });

    expect(result.results[0]).toEqual(expect.objectContaining({
      id: "long",
      mode: "long-agent",
    }));
    const persisted = JSON.parse(await readFile(result.resultsFile, "utf-8"));
    expect(persisted[0]).toEqual(expect.objectContaining({
      mode: "long-agent",
    }));
  });
});
