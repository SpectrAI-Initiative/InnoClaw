import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fsListDirectory: vi.fn(),
  fsReadFile: vi.fn(),
  fsWriteFile: vi.fn(),
}));

vi.mock("@/lib/files/filesystem", () => ({
  validatePath: (target: string) => path.resolve(target),
  listDirectory: mocks.fsListDirectory,
  readFile: mocks.fsReadFile,
  writeFile: mocks.fsWriteFile,
}));

vi.mock("@/lib/cluster/config", () => ({
  getK8sConfig: vi.fn(async () => ({
    kubeconfigPath: "/tmp/kubeconfig",
    clusterContextMap: {},
  })),
}));

vi.mock("@/lib/cluster/job-profiles", () => ({
  getK8sJobConfig: vi.fn(async () => ({ clusters: {}, profiles: {} })),
}));

vi.mock("./shell-tools", () => ({
  createShellTools: () => ({ bash: { kind: "bash" }, grep: { kind: "grep" } }),
}));
vi.mock("./k8s-tools", () => ({
  createK8sTools: () => ({ kubectl: { kind: "kubectl" } }),
}));
vi.mock("./k8s-job-tools", () => ({
  createK8sJobTools: () => ({ submitK8sJob: { kind: "k8s-job" } }),
}));
vi.mock("./search-tools", () => ({
  createSearchTools: () => ({ searchArticles: { kind: "search" } }),
}));
vi.mock("./skill-tools", () => ({
  createSkillTools: () => ({ getSkillInstructions: { kind: "skill" } }),
}));
vi.mock("./mcp-tools", () => ({
  createMcpTools: () => ({ listMcpTools: { kind: "mcp" } }),
}));
vi.mock("./research-exec-tools", () => ({
  createResearchExecTools: () => ({ submitRemoteJob: { kind: "research" } }),
}));

import { createAgentTools } from "./index";

const temporaryDirectories: string[] = [];
let userRoot: string;
let otherUserRoot: string;

beforeEach(() => {
  vi.clearAllMocks();
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "innoclaw-agent-tools-"));
  temporaryDirectories.push(sandbox);
  userRoot = path.join(sandbox, "user-a");
  otherUserRoot = path.join(sandbox, "user-b");
  fs.mkdirSync(userRoot);
  fs.mkdirSync(otherUserRoot);
  mocks.fsReadFile.mockResolvedValue("content");
  mocks.fsListDirectory.mockResolvedValue([]);
  mocks.fsWriteFile.mockResolvedValue(undefined);
});

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    fs.rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe("createAgentTools privilege boundaries", () => {
  it("keeps safe tools and omits high-risk tools for an ordinary user", async () => {
    const tools = await createAgentTools(
      userRoot,
      undefined,
      "workspace-a",
      null,
      false,
      { workspaceRoot: userRoot, allowHighRisk: false },
    );

    expect(Object.keys(tools)).toEqual(expect.arrayContaining([
      "readFile",
      "writeFile",
      "listDirectory",
      "grep",
      "searchArticles",
      "getSkillInstructions",
    ]));
    expect(tools).not.toHaveProperty("bash");
    expect(tools).not.toHaveProperty("kubectl");
    expect(tools).not.toHaveProperty("submitK8sJob");
    expect(tools).not.toHaveProperty("listMcpTools");
    expect(tools).not.toHaveProperty("submitRemoteJob");
  });

  it("retains high-risk tools for an administrator", async () => {
    const tools = await createAgentTools(
      userRoot,
      undefined,
      "workspace-a",
      null,
      false,
      { workspaceRoot: userRoot, allowHighRisk: true },
    );

    expect(tools).toHaveProperty("bash");
    expect(tools).toHaveProperty("kubectl");
    expect(tools).toHaveProperty("submitK8sJob");
    expect(tools).toHaveProperty("listMcpTools");
    expect(tools).toHaveProperty("submitRemoteJob");
  });

  it("rejects an absolute file path outside the selected workspace", async () => {
    const tools = await createAgentTools(
      userRoot,
      undefined,
      "workspace-a",
      null,
      false,
      { workspaceRoot: userRoot, allowHighRisk: false },
    );
    const execute = (tools.readFile as unknown as {
      execute: (input: { filePath: string }, options: unknown) => Promise<unknown>;
    }).execute;

    await expect(
      execute(
        { filePath: path.join(otherUserRoot, "secret.md") },
        { toolCallId: "call-1", messages: [] },
      ),
    ).rejects.toThrow(/outside/i);
    expect(mocks.fsReadFile).not.toHaveBeenCalled();
  });
});
