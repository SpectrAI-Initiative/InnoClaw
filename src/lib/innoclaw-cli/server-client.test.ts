import { EventEmitter } from "node:events";
import { chmod, copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();
const delayMock = vi.fn(() => Promise.resolve());

function jsonResponse(status: number, body: unknown) {
  return {
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  };
}

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

vi.mock("node:timers/promises", () => ({
  setTimeout: delayMock,
}));

describe("innoclaw-cli ensureServerReady", () => {
  beforeEach(() => {
    spawnMock.mockReset();
    delayMock.mockClear();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("keeps polling when dev-start exits non-zero but the server becomes reachable", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("booting"))
      .mockResolvedValueOnce(jsonResponse(
        200,
        {
          user: { id: "user-1" },
          authMode: "disabled",
        },
      ));
    vi.stubGlobal("fetch", fetchMock);

    spawnMock.mockImplementation(() => {
      const child = new EventEmitter();
      queueMicrotask(() => {
        child.emit("exit", 1);
      });
      return child;
    });

    const { ensureServerReady } = await import("../../../plugins/innoclaw-cli/src/server-client.mjs");

    await expect(ensureServerReady({
      appRoot: "/tmp/innoclaw-app",
      baseUrl: "http://localhost:3000",
      waitTimeoutMs: 5_000,
    })).resolves.toBeUndefined();

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not treat an arbitrary login page as a reachable InnoClaw server", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      json: async () => {
        throw new SyntaxError("Unexpected token '<'");
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { ensureServerReady } = await import("../../../plugins/innoclaw-cli/src/server-client.mjs");

    await expect(ensureServerReady({
      appRoot: "/tmp/innoclaw-app",
      baseUrl: "https://example.com",
      autoStart: false,
      waitTimeoutMs: 1_000,
    })).rejects.toThrow("InnoClaw is not reachable at https://example.com");

    expect(spawnMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/api/auth/me", expect.any(Object));
  });

  it("rejects text responses even when the body looks like a valid auth probe", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ "content-type": "text/plain" }),
      json: async () => ({
        user: { id: "user-1" },
        authMode: "disabled",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { ensureServerReady } = await import("../../../plugins/innoclaw-cli/src/server-client.mjs");

    await expect(ensureServerReady({
      appRoot: "/tmp/innoclaw-app",
      baseUrl: "https://example.com",
      autoStart: false,
      waitTimeoutMs: 1_000,
    })).rejects.toThrow("InnoClaw is not reachable at https://example.com");

    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("accepts an authenticated InnoClaw auth probe", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      200,
      {
        user: { id: "user-1", email: "dev@example.com" },
        authMode: "oauth",
      },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const { ensureServerReady } = await import("../../../plugins/innoclaw-cli/src/server-client.mjs");

    await expect(ensureServerReady({
      appRoot: "/tmp/innoclaw-app",
      baseUrl: "http://localhost:3000",
      waitTimeoutMs: 1_000,
    })).resolves.toBeUndefined();

    expect(spawnMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000/api/auth/me", expect.any(Object));
  });

  it("accepts an unauthenticated InnoClaw auth probe", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: "Unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);

    const { ensureServerReady } = await import("../../../plugins/innoclaw-cli/src/server-client.mjs");

    await expect(ensureServerReady({
      appRoot: "/tmp/innoclaw-app",
      baseUrl: "http://localhost:3000",
      waitTimeoutMs: 1_000,
    })).resolves.toBeUndefined();

    expect(spawnMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000/api/auth/me", expect.any(Object));
  });

  it("accepts a local server that is reachable on 127.0.0.1 when localhost fetch fails", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("localhost unavailable"))
      .mockResolvedValueOnce(jsonResponse(
        200,
        {
          user: { id: "user-1" },
          authMode: "disabled",
        },
      ));
    vi.stubGlobal("fetch", fetchMock);

    const { ensureServerReady } = await import("../../../plugins/innoclaw-cli/src/server-client.mjs");

    await expect(ensureServerReady({
      appRoot: "/tmp/innoclaw-app",
      baseUrl: "http://localhost:3000",
      waitTimeoutMs: 1_000,
    })).resolves.toBeUndefined();

    expect(spawnMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:3000/api/auth/me", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://127.0.0.1:3000/api/auth/me", expect.any(Object));
  });
});

describe("dev-start.sh", () => {
  function toBashPath(windowsPath: string) {
    const normalized = windowsPath.replace(/\\/g, "/");
    return normalized.replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`);
  }

  async function runDevStart(
    args: string[],
    options: { cwd?: string; env?: Partial<NodeJS.ProcessEnv> } = {},
  ) {
    const { execFile } = await vi.importActual<typeof import("node:child_process")>("node:child_process");
    const bashPath = "C:\\Program Files\\Git\\bin\\bash.exe";

    return new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve) => {
      execFile(
        bashPath,
        ["dev-start.sh", ...args],
        {
          cwd: options.cwd ?? process.cwd(),
          env: {
            ...process.env,
            ...options.env,
          },
        },
        (error, stdout, stderr) => {
          resolve({
            stdout,
            stderr,
            code: typeof error?.code === "number" ? error.code : 0,
          });
        },
      );
    });
  }

  async function withStubPath(
    stubs: Record<string, string>,
    run: (stubDir: string) => Promise<void>,
  ) {
    const stubDir = await mkdtemp(path.join(tmpdir(), "innoclaw-dev-start-"));
    try {
      await Promise.all(Object.entries(stubs).map(async ([name, contents]) => {
        const stubPath = path.join(stubDir, name);
        await writeFile(stubPath, contents);
        await chmod(stubPath, 0o755);
      }));
      await run(stubDir);
    } finally {
      await rm(stubDir, { recursive: true, force: true });
    }
  }

  async function withDevStartCopy(run: (scriptDir: string) => Promise<void>) {
    const scriptDir = await mkdtemp(path.join(tmpdir(), "innoclaw-dev-start-script-"));
    try {
      const scriptPath = path.join(scriptDir, "dev-start.sh");
      await copyFile(path.join(process.cwd(), "dev-start.sh"), scriptPath);
      await chmod(scriptPath, 0o755);
      await run(scriptDir);
    } finally {
      await rm(scriptDir, { recursive: true, force: true });
    }
  }

  it("accepts a 401 JSON Unauthorized auth probe", async () => {
    await withStubPath({
      "curl": `#!/bin/sh
body_file=""
fail_on_http_error=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    -*f*) fail_on_http_error=1 ;;
  esac
  if [ "$1" = "-o" ]; then
    body_file="$2"
    shift 2
    continue
  fi
  shift
done
printf '{"error":"Unauthorized"}' > "$body_file"
printf '401\\napplication/json'
if [ "$fail_on_http_error" -eq 1 ]; then
  exit 22
fi
`,
    }, async (stubDir) => {
      await withDevStartCopy(async (scriptDir) => {
        const result = await runDevStart(["server_responding"], {
          cwd: scriptDir,
          env: {
            INNOCLAW_DEV_START_TEST_HOOK: "1",
            INNOCLAW_DEV_START_TEST_PATH: toBashPath(stubDir),
          },
        });

        expect(result).toMatchObject({ code: 0 });
      });
    });
  });

  it("rejects text/plain even when the body looks like a valid auth probe", async () => {
    await withStubPath({
      "curl": `#!/bin/sh
body_file=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then
    body_file="$2"
    shift 2
    continue
  fi
  shift
done
printf '{"user":{"id":"user-1"},"authMode":"disabled"}' > "$body_file"
printf '200\\ntext/plain'
`,
    }, async (stubDir) => {
      await withDevStartCopy(async (scriptDir) => {
        const result = await runDevStart(["server_responding"], {
          cwd: scriptDir,
          env: {
            INNOCLAW_DEV_START_TEST_HOOK: "1",
            INNOCLAW_DEV_START_TEST_PATH: toBashPath(stubDir),
          },
        });

        expect(result).toMatchObject({ code: 1 });
      });
    });
  });

  it("exits on an unrelated occupied port without invoking kill", async () => {
    await withStubPath({
      "lsof": `#!/bin/sh
printf '4242\\n'
`,
      "ps": `#!/bin/sh
case "$*" in
  *"-o comm="*) printf 'node\\n' ;;
  *"-o args="*) printf 'node unrelated-server.js\\n' ;;
  *) exit 0 ;;
esac
`,
      "kill": `#!/bin/sh
printf 'kill should not be called\\n' > "$KILL_MARKER"
exit 1
`,
    }, async (stubDir) => {
      const killMarker = path.join(stubDir, "kill-called");
      await withDevStartCopy(async (scriptDir) => {
        const result = await runDevStart([], {
          cwd: scriptDir,
          env: {
            INNOCLAW_DEV_START_TEST_PATH: toBashPath(stubDir),
            KILL_MARKER: killMarker,
          },
        });

        await expect(rm(killMarker, { force: false })).rejects.toThrow();
        expect(result.code).toBe(1);
        expect(result.stdout).toContain("Port 3000 is occupied");
        expect(result.stdout).toContain("not managed by this repo's .dev.pid");
      });
    });
  });
});
