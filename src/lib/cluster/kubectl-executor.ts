import { spawn } from "child_process";
import { BUFFER, TRUNCATE } from "@/lib/constants";

export interface KubectlRunnerResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface KubectlRunnerOptions {
  stdin?: string;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
}

export type KubectlRunner = (
  args: string[],
  options: KubectlRunnerOptions,
) => Promise<KubectlRunnerResult>;

export interface KubectlRequest {
  kubeconfigPath: string;
  context: string;
  namespace?: string;
  args: string[];
  stdin?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

export interface KubectlExecResult<T = string> {
  command: string[];
  stdout: string;
  stderr: string;
  exitCode: number;
  data: T;
}

const SCOPE_OVERRIDE_FLAGS = [
  "--kubeconfig",
  "--context",
  "--cluster",
  "--server",
  "--token",
  "--namespace",
  "--as",
  "--as-group",
  "--certificate-authority",
  "--client-certificate",
  "--client-key",
  "--insecure-skip-tls-verify",
];

function hasForbiddenFlag(args: string[]): boolean {
  return args.some((arg) => {
    if (arg === "-n" || (arg.startsWith("-n") && arg.length > 2)) {
      return true;
    }
    return SCOPE_OVERRIDE_FLAGS.some(
      (flag) => arg === flag || arg.startsWith(`${flag}=`),
    );
  });
}

function buildArgs(request: KubectlRequest): string[] {
  if (hasForbiddenFlag(request.args)) {
    throw new Error("kubectl args must not override Kubernetes scope");
  }

  return [
    "--kubeconfig",
    request.kubeconfigPath,
    "--context",
    request.context,
    ...(request.namespace ? ["-n", request.namespace] : []),
    ...request.args,
  ];
}

const defaultRunner: KubectlRunner = async (args, options) =>
  new Promise((resolve, reject) => {
    const child = spawn("kubectl", args, {
      env: options.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error("kubectl command timed out"));
    }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < BUFFER.LARGE) {
        stdout += chunk.toString();
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < BUFFER.DEFAULT) {
        stderr += chunk.toString();
      }
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      });
    });

    if (options.stdin) {
      child.stdin.end(options.stdin);
    } else {
      child.stdin.end();
    }
  });

export function createKubectlExecutor(options?: {
  runner?: KubectlRunner;
  defaultTimeoutMs?: number;
  truncate?: { stdout: number; stderr: number };
}) {
  const runner = options?.runner ?? defaultRunner;
  const defaultTimeoutMs = options?.defaultTimeoutMs ?? 30_000;
  const truncate = options?.truncate ?? {
    stdout: TRUNCATE.STDOUT_LARGE,
    stderr: TRUNCATE.STDERR,
  };

  async function execute<T>(
    request: KubectlRequest,
    parseJson: boolean,
  ): Promise<KubectlExecResult<T>> {
    const args = buildArgs(request);
    const command = ["kubectl", ...args];
    const result = await runner(args, {
      stdin: request.stdin,
      timeoutMs: request.timeoutMs ?? defaultTimeoutMs,
      env: request.env,
    });
    const stdout = result.stdout.slice(0, truncate.stdout);
    const stderr = result.stderr.slice(0, truncate.stderr);

    if (result.exitCode !== 0) {
      throw new Error(stderr || `kubectl exited with code ${result.exitCode}`);
    }

    const data = parseJson ? JSON.parse(stdout) : stdout;
    return {
      command,
      stdout,
      stderr,
      exitCode: result.exitCode,
      data: data as T,
    };
  }

  return {
    runText(request: KubectlRequest) {
      return execute<string>(request, false);
    },
    async runJson<T>(request: KubectlRequest) {
      try {
        return await execute<T>(request, true);
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error("kubectl returned invalid JSON");
        }
        throw error;
      }
    },
  };
}
