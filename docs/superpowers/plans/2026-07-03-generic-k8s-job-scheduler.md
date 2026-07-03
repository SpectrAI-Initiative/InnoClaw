# Generic Kubernetes Job Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a generic, open-source-safe Kubernetes `batch/v1 Job` scheduler for InnoClaw agents, with private local profile support for real institution-cluster smoke testing.

**Architecture:** Add a generic profile loader, scoped kubectl executor, Job manifest builder, policy helpers, wait/log utilities, and high-privilege agent tools. Keep existing legacy cluster-specific tools working, but update prompts and docs so the new default path is structured `prepareK8sJob` -> `runK8sJob` -> `waitForK8sJob` -> `collectK8sJobLogs` -> optional `cleanupK8sJob`.

**Tech Stack:** Next.js 16, TypeScript 6, Vitest, Drizzle/SQLite app settings, AI SDK tool definitions, Kubernetes `kubectl`, Node `child_process.execFile`, Node `crypto`.

---

## Scope And File Structure

This implementation is one feature, but it should land in small commits. It does not migrate the full settings UI. It does update open-source env/docs text that currently promotes legacy cluster-specific settings.

Create:

- `src/lib/cluster/job-profiles.ts`: generic cluster/profile schemas, env/DB/local-file loader, profile resolution.
- `src/lib/cluster/job-profiles.test.ts`: profile loader and resolution tests.
- `src/lib/cluster/kubectl-executor.ts`: safe kubectl wrapper with scoped context/namespace injection.
- `src/lib/cluster/kubectl-executor.test.ts`: executor unit tests with fake runner.
- `src/lib/cluster/job-manifest.ts`: vanilla `batch/v1 Job` manifest builder and review summary.
- `src/lib/cluster/job-manifest.test.ts`: manifest generation tests.
- `src/lib/cluster/job-policy.ts`: hash binding, ownership labels, input validation, wait status helpers.
- `src/lib/cluster/job-policy.test.ts`: policy and hash tests.
- `src/lib/cluster/job-wait.ts`: Job/Pod wait and log collection helpers.
- `src/lib/cluster/job-wait.test.ts`: complete, failed, timeout, and Pod failure tests.
- `src/lib/ai/tools/k8s-job-tools.ts`: `prepareK8sJob`, `runK8sJob`, `waitForK8sJob`, `collectK8sJobLogs`, `cleanupK8sJob`.
- `src/lib/ai/tools/k8s-job-tools.test.ts`: tool contract tests using injected fakes.
- `config/k8s-job-profiles.example.json`: anonymous generic profile example.
- `docs/development/generic-k8s-job-scheduler.md`: contributor and local smoke-test guide.

Modify:

- `.gitignore`: ignore `config/k8s-job-profiles.local.json`.
- `.env.example`: replace legacy-specific K8s comments with generic profile variables and point legacy users to docs.
- `docs/getting-started/environment-variables.md`: document generic K8s profile variables.
- `docs/development/agent-development.md`: document the generic Job tool flow and safety gates.
- `docs/usage/features.md`: update Kubernetes feature text.
- `docs/usage/api-reference.md`: update cluster integration notes if they reference legacy submit defaults.
- `src/lib/cluster/config.ts`: keep legacy config intact; optionally expose generic env key constants only if shared with settings.
- `src/lib/ai/tools/types.ts`: add `k8sJobConfig` to `ToolContext`.
- `src/lib/ai/tools/index.ts`: load generic job config and register new tools.
- `src/lib/ai/tool-names.ts`: add new high-privilege tool names.
- `src/lib/ai/agent-prompts.ts`: instruct agents to prefer generic Job workflow.
- `src/components/agent/tool-call-block.tsx`: render new tool summaries and results.
- `src/lib/report/extract-report.ts`: add labels for new tools.
- `src/components/report/process-timeline.tsx`: add icon mappings for new tools if it has a fixed map.
- `src/lib/bot/feishu/cards.ts`: add concise cards for new cluster tools if it has fixed switch cases.

Before editing `.gitignore` or `package-lock.json`, check `git status --short` and preserve unrelated local changes.

---

### Task 1: Generic Cluster/Profile Loader

**Files:**

- Create: `src/lib/cluster/job-profiles.ts`
- Create: `src/lib/cluster/job-profiles.test.ts`
- Create: `config/k8s-job-profiles.example.json`
- Modify: `.gitignore`

- [ ] **Step 1: Write failing profile loader tests**

Create `src/lib/cluster/job-profiles.test.ts`:

```ts
import { mkdtemp, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearK8sJobConfigCache,
  getK8sJobConfig,
  resolveK8sJobProfile,
  type K8sJobConfig,
} from "./job-profiles";

afterEach(() => {
  vi.unstubAllEnvs();
  clearK8sJobConfigCache();
});

describe("getK8sJobConfig", () => {
  it("loads generic clusters and profiles from a local JSON file", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "k8s-job-profiles-"));
    const file = path.join(dir, "profiles.local.json");
    await writeFile(
      file,
      JSON.stringify({
        clusters: [
          {
            id: "local",
            kubeconfigPath: "/tmp/kubeconfig",
            context: "kind-local",
            defaultNamespace: "default",
            allowedNamespaces: ["default", "experiments"]
          }
        ],
        profiles: [
          {
            id: "cpu-smoke",
            clusterId: "local",
            namespace: "experiments",
            defaultImage: "python:3.12",
            resources: {
              requests: { cpu: "1", memory: "256Mi" },
              limits: { cpu: "1", memory: "256Mi" }
            },
            ttlSecondsAfterFinished: 3600
          }
        ]
      }),
      "utf8",
    );
    vi.stubEnv("K8S_JOB_PROFILES_FILE", file);

    await expect(getK8sJobConfig()).resolves.toMatchObject({
      clusters: [
        {
          id: "local",
          context: "kind-local",
          defaultNamespace: "default",
          allowedNamespaces: ["default", "experiments"]
        }
      ],
      profiles: [
        {
          id: "cpu-smoke",
          clusterId: "local",
          namespace: "experiments",
          defaultImage: "python:3.12"
        }
      ]
    });
  });

  it("builds a default profile from generic env vars", async () => {
    vi.stubEnv("KUBECONFIG_PATH", "/tmp/kubeconfig");
    vi.stubEnv("K8S_CONTEXT", "kind-local");
    vi.stubEnv("K8S_DEFAULT_NAMESPACE", "default");
    vi.stubEnv("K8S_ALLOWED_NAMESPACES", "default,experiments");
    vi.stubEnv("K8S_JOB_DEFAULT_IMAGE", "python:3.12");

    await expect(getK8sJobConfig()).resolves.toMatchObject({
      clusters: [
        {
          id: "default",
          kubeconfigPath: "/tmp/kubeconfig",
          context: "kind-local",
          defaultNamespace: "default",
          allowedNamespaces: ["default", "experiments"]
        }
      ],
      profiles: [
        {
          id: "default",
          clusterId: "default",
          namespace: "default",
          defaultImage: "python:3.12"
        }
      ]
    });
  });

  it("returns empty config when generic K8s job settings are absent", async () => {
    await expect(getK8sJobConfig()).resolves.toEqual({
      clusters: [],
      profiles: []
    });
  });
});

describe("resolveK8sJobProfile", () => {
  const config: K8sJobConfig = {
    clusters: [
      {
        id: "local",
        kubeconfigPath: "/tmp/kubeconfig",
        context: "kind-local",
        defaultNamespace: "default",
        allowedNamespaces: ["default", "experiments"]
      }
    ],
    profiles: [
      {
        id: "cpu-smoke",
        clusterId: "local",
        namespace: "experiments",
        defaultImage: "python:3.12"
      }
    ]
  };

  it("resolves cluster, profile, and namespace", () => {
    expect(resolveK8sJobProfile(config, "cpu-smoke")).toMatchObject({
      cluster: { id: "local", context: "kind-local" },
      profile: { id: "cpu-smoke" },
      namespace: "experiments"
    });
  });

  it("rejects unknown profiles", () => {
    expect(() => resolveK8sJobProfile(config, "missing")).toThrow(
      /K8s job profile not found/,
    );
  });

  it("rejects namespaces outside the allow-list", () => {
    expect(() =>
      resolveK8sJobProfile(config, "cpu-smoke", "kube-system"),
    ).toThrow(/Namespace is not allowed/);
  });
});
```

- [ ] **Step 2: Run the profile tests and confirm they fail**

Run:

```bash
npm test -- src/lib/cluster/job-profiles.test.ts
```

Expected: fail because `src/lib/cluster/job-profiles.ts` does not exist.

- [ ] **Step 3: Implement the profile loader**

Create `src/lib/cluster/job-profiles.ts` with these exported names and behavior:

```ts
import fsp from "fs/promises";
import path from "path";
import { z } from "zod";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

const envVarSchema = z.object({ name: z.string().min(1), value: z.string() }).strict();

const resourceRequirementsSchema = z
  .object({
    requests: z.record(z.string().min(1), z.string().min(1)).optional(),
    limits: z.record(z.string().min(1), z.string().min(1)).optional(),
  })
  .strict();

export const k8sJobVolumeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("emptyDir"),
    name: z.string().min(1),
    mountPath: z.string().min(1),
    medium: z.enum(["Memory"]).optional(),
    sizeLimit: z.string().min(1).optional(),
  }).strict(),
  z.object({
    type: z.literal("persistentVolumeClaim"),
    name: z.string().min(1),
    mountPath: z.string().min(1),
    claimName: z.string().min(1),
    readOnly: z.boolean().optional(),
  }).strict(),
  z.object({
    type: z.literal("configMap"),
    name: z.string().min(1),
    mountPath: z.string().min(1),
    configMapName: z.string().min(1),
    readOnly: z.boolean().optional(),
  }).strict(),
  z.object({
    type: z.literal("secret"),
    name: z.string().min(1),
    mountPath: z.string().min(1),
    secretName: z.string().min(1),
    readOnly: z.boolean().optional(),
  }).strict(),
]);

export const genericK8sClusterSchema = z.object({
  id: z.string().min(1),
  kubeconfigPath: z.string().min(1),
  context: z.string().min(1),
  defaultNamespace: z.string().min(1),
  allowedNamespaces: z.array(z.string().min(1)).min(1),
}).strict();

export const k8sJobProfileSchema = z.object({
  id: z.string().min(1),
  clusterId: z.string().min(1),
  namespace: z.string().min(1).optional(),
  defaultImage: z.string().min(1).optional(),
  imagePullSecrets: z.array(z.string().min(1)).optional(),
  labels: z.record(z.string().min(1), z.string().min(1)).optional(),
  annotations: z.record(z.string().min(1), z.string().min(1)).optional(),
  env: z.array(envVarSchema).optional(),
  resources: resourceRequirementsSchema.optional(),
  volumes: z.array(k8sJobVolumeSchema).optional(),
  ttlSecondsAfterFinished: z.number().int().nonnegative().optional(),
  backoffLimit: z.number().int().nonnegative().optional(),
}).strict();

export const k8sJobConfigSchema = z.object({
  clusters: z.array(genericK8sClusterSchema),
  profiles: z.array(k8sJobProfileSchema),
}).strict();

export type GenericK8sCluster = z.infer<typeof genericK8sClusterSchema>;
export type K8sJobProfile = z.infer<typeof k8sJobProfileSchema>;
export type K8sJobVolume = z.infer<typeof k8sJobVolumeSchema>;
export type K8sJobConfig = z.infer<typeof k8sJobConfigSchema>;

export interface ResolvedK8sJobProfile {
  cluster: GenericK8sCluster;
  profile: K8sJobProfile;
  namespace: string;
}

const SETTINGS_KEYS = [
  "k8s_job_profiles_json",
  "k8s_job_profiles_file",
] as const;

let cachedConfig: K8sJobConfig | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 10_000;

function parseCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readSettingsMap(): Promise<Record<string, string>> {
  const rows = await db
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, [...SETTINGS_KEYS]));
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

function resolveConfigFilePath(settings: Record<string, string>): string | undefined {
  return (
    settings.k8s_job_profiles_file ||
    process.env.K8S_JOB_PROFILES_FILE ||
    undefined
  );
}

async function readFileConfig(settings: Record<string, string>): Promise<K8sJobConfig | null> {
  const configuredPath = resolveConfigFilePath(settings);
  if (!configuredPath) return null;
  const absolutePath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);
  const raw = await fsp.readFile(absolutePath, "utf8");
  return k8sJobConfigSchema.parse(JSON.parse(raw));
}

function readJsonConfig(settings: Record<string, string>): K8sJobConfig | null {
  const raw = settings.k8s_job_profiles_json || process.env.K8S_JOB_PROFILES_JSON;
  if (!raw) return null;
  return k8sJobConfigSchema.parse(JSON.parse(raw));
}

function readEnvConfig(): K8sJobConfig | null {
  const kubeconfigPath = process.env.KUBECONFIG_PATH;
  const context = process.env.K8S_CONTEXT;
  if (!kubeconfigPath || !context) return null;
  const defaultNamespace = process.env.K8S_DEFAULT_NAMESPACE || "default";
  const allowedNamespaces = parseCsv(process.env.K8S_ALLOWED_NAMESPACES);
  const namespaceAllowList =
    allowedNamespaces.length > 0 ? allowedNamespaces : [defaultNamespace];
  return {
    clusters: [
      {
        id: process.env.K8S_CLUSTER_ID || "default",
        kubeconfigPath,
        context,
        defaultNamespace,
        allowedNamespaces: namespaceAllowList,
      },
    ],
    profiles: [
      {
        id: process.env.K8S_JOB_PROFILE_ID || "default",
        clusterId: process.env.K8S_CLUSTER_ID || "default",
        namespace: process.env.K8S_JOB_NAMESPACE || defaultNamespace,
        defaultImage: process.env.K8S_JOB_DEFAULT_IMAGE,
      },
    ],
  };
}

export async function getK8sJobConfig(): Promise<K8sJobConfig> {
  const now = Date.now();
  if (cachedConfig && now < cacheExpiry) return cachedConfig;

  const settings = await readSettingsMap();
  const config =
    readJsonConfig(settings) ??
    (await readFileConfig(settings)) ??
    readEnvConfig() ??
    { clusters: [], profiles: [] };

  cachedConfig = config;
  cacheExpiry = now + CACHE_TTL_MS;
  return config;
}

export function clearK8sJobConfigCache(): void {
  cachedConfig = null;
  cacheExpiry = 0;
}

export function resolveK8sJobProfile(
  config: K8sJobConfig,
  profileId: string,
  namespaceOverride?: string,
): ResolvedK8sJobProfile {
  const profile = config.profiles.find((item) => item.id === profileId);
  if (!profile) throw new Error(`K8s job profile not found: ${profileId}`);
  const cluster = config.clusters.find((item) => item.id === profile.clusterId);
  if (!cluster) {
    throw new Error(`K8s job profile references missing cluster: ${profile.clusterId}`);
  }
  const namespace = namespaceOverride ?? profile.namespace ?? cluster.defaultNamespace;
  if (!cluster.allowedNamespaces.includes(namespace)) {
    throw new Error(`Namespace is not allowed for profile ${profileId}: ${namespace}`);
  }
  return { cluster, profile, namespace };
}
```

- [ ] **Step 4: Add the public example config**

Create `config/k8s-job-profiles.example.json`:

```json
{
  "clusters": [
    {
      "id": "default",
      "kubeconfigPath": "/path/to/kubeconfig",
      "context": "local-context",
      "defaultNamespace": "default",
      "allowedNamespaces": ["default"]
    }
  ],
  "profiles": [
    {
      "id": "cpu-smoke",
      "clusterId": "default",
      "namespace": "default",
      "defaultImage": "python:3.12",
      "resources": {
        "requests": {
          "cpu": "1",
          "memory": "256Mi"
        },
        "limits": {
          "cpu": "1",
          "memory": "256Mi"
        }
      },
      "ttlSecondsAfterFinished": 3600,
      "backoffLimit": 0
    }
  ]
}
```

- [ ] **Step 5: Ignore the private local profile**

Before editing, run:

```bash
git diff -- .gitignore
```

Then add this line without removing unrelated local changes:

```gitignore
config/k8s-job-profiles.local.json
```

- [ ] **Step 6: Run profile tests**

Run:

```bash
npm test -- src/lib/cluster/job-profiles.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit Task 1**

Run:

```bash
git add src/lib/cluster/job-profiles.ts src/lib/cluster/job-profiles.test.ts config/k8s-job-profiles.example.json .gitignore
git commit -m "feat(cluster): add generic k8s job profiles"
```

---

### Task 2: Scoped Kubectl Executor

**Files:**

- Create: `src/lib/cluster/kubectl-executor.ts`
- Create: `src/lib/cluster/kubectl-executor.test.ts`

- [ ] **Step 1: Write failing executor tests**

Create `src/lib/cluster/kubectl-executor.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createKubectlExecutor } from "./kubectl-executor";

describe("createKubectlExecutor", () => {
  it("injects kubeconfig, context, and namespace before user args", async () => {
    const runner = vi.fn(async () => ({
      stdout: "{\"items\":[]}",
      stderr: "",
      exitCode: 0,
    }));
    const executor = createKubectlExecutor({ runner, defaultTimeoutMs: 30_000 });

    await executor.runJson({
      kubeconfigPath: "/tmp/kubeconfig",
      context: "kind-local",
      namespace: "default",
      args: ["get", "pods", "-o", "json"],
    });

    expect(runner).toHaveBeenCalledWith(
      [
        "--kubeconfig",
        "/tmp/kubeconfig",
        "--context",
        "kind-local",
        "-n",
        "default",
        "get",
        "pods",
        "-o",
        "json",
      ],
      expect.objectContaining({ timeoutMs: 30_000 }),
    );
  });

  it.each([
    ["--kubeconfig", ["--kubeconfig", "/tmp/other", "get", "pods"]],
    ["--context", ["--context", "prod", "get", "pods"]],
    ["--namespace", ["--namespace", "prod", "get", "pods"]],
    ["--namespace=prod", ["--namespace=prod", "get", "pods"]],
    ["-n", ["-n", "prod", "get", "pods"]],
    ["-nprod", ["-nprod", "get", "pods"]],
    ["--token", ["--token", "secret", "get", "pods"]],
  ])("rejects scope override flag %s", async (_label, args) => {
    const runner = vi.fn();
    const executor = createKubectlExecutor({ runner, defaultTimeoutMs: 30_000 });

    await expect(
      executor.runText({
        kubeconfigPath: "/tmp/kubeconfig",
        context: "kind-local",
        namespace: "default",
        args,
      }),
    ).rejects.toThrow(/must not override Kubernetes scope/);
    expect(runner).not.toHaveBeenCalled();
  });

  it("maps invalid JSON output to an execution error", async () => {
    const runner = vi.fn(async () => ({
      stdout: "{",
      stderr: "",
      exitCode: 0,
    }));
    const executor = createKubectlExecutor({ runner, defaultTimeoutMs: 30_000 });

    await expect(
      executor.runJson({
        kubeconfigPath: "/tmp/kubeconfig",
        context: "kind-local",
        args: ["get", "jobs", "-o", "json"],
      }),
    ).rejects.toThrow(/invalid JSON/);
  });

  it("returns bounded text output", async () => {
    const runner = vi.fn(async () => ({
      stdout: "x".repeat(50_000),
      stderr: "y".repeat(10_000),
      exitCode: 0,
    }));
    const executor = createKubectlExecutor({
      runner,
      defaultTimeoutMs: 30_000,
      truncate: { stdout: 100, stderr: 50 },
    });

    await expect(
      executor.runText({
        kubeconfigPath: "/tmp/kubeconfig",
        context: "kind-local",
        args: ["get", "jobs"],
      }),
    ).resolves.toMatchObject({
      stdout: "x".repeat(100),
      stderr: "y".repeat(50),
      exitCode: 0,
    });
  });
});
```

- [ ] **Step 2: Run the executor tests and confirm they fail**

Run:

```bash
npm test -- src/lib/cluster/kubectl-executor.test.ts
```

Expected: fail because `src/lib/cluster/kubectl-executor.ts` does not exist.

- [ ] **Step 3: Implement the executor**

Create `src/lib/cluster/kubectl-executor.ts`:

```ts
import { execFile } from "child_process";
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
    if (arg === "-n" || (arg.startsWith("-n") && arg.length > 2)) return true;
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

const defaultRunner: KubectlRunner = (args, options) =>
  new Promise((resolve) => {
    execFile(
      "kubectl",
      args,
      {
        input: options.stdin,
        timeout: options.timeoutMs,
        maxBuffer: BUFFER.DEFAULT,
        env: options.env,
      },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout || "",
          stderr: stderr || "",
          exitCode: error ? Number((error as NodeJS.ErrnoException).code) || 1 : 0,
        });
      },
    );
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
```

- [ ] **Step 4: Run executor tests**

Run:

```bash
npm test -- src/lib/cluster/kubectl-executor.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add src/lib/cluster/kubectl-executor.ts src/lib/cluster/kubectl-executor.test.ts
git commit -m "feat(cluster): add scoped kubectl executor"
```

---

### Task 3: Job Manifest Builder And Policy Helpers

**Files:**

- Create: `src/lib/cluster/job-manifest.ts`
- Create: `src/lib/cluster/job-manifest.test.ts`
- Create: `src/lib/cluster/job-policy.ts`
- Create: `src/lib/cluster/job-policy.test.ts`

- [ ] **Step 1: Write failing manifest tests**

Create `src/lib/cluster/job-manifest.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildK8sJobManifest } from "./job-manifest";

describe("buildK8sJobManifest", () => {
  it("builds a vanilla batch/v1 Job with profile defaults", () => {
    const manifest = buildK8sJobManifest({
      workspaceId: "ws-1",
      jobSpecHash: "hash-1",
      namespace: "default",
      profile: {
        id: "cpu-smoke",
        clusterId: "default",
        defaultImage: "python:3.12",
        imagePullSecrets: ["pull-secret"],
        resources: {
          requests: { cpu: "1", memory: "256Mi" },
          limits: { cpu: "1", memory: "256Mi" }
        },
        ttlSecondsAfterFinished: 3600,
        backoffLimit: 0
      },
      input: {
        profileId: "cpu-smoke",
        jobName: "smoke-test",
        command: ["python", "-c"],
        args: ["print('hello')"]
      }
    });

    expect(manifest).toMatchObject({
      apiVersion: "batch/v1",
      kind: "Job",
      metadata: {
        name: "smoke-test",
        namespace: "default",
        labels: {
          "app.kubernetes.io/managed-by": "innoclaw",
          "innoclaw.ai/workspace-id": "ws-1",
          "innoclaw.ai/job-hash": "hash-1"
        }
      },
      spec: {
        ttlSecondsAfterFinished: 3600,
        backoffLimit: 0,
        template: {
          spec: {
            restartPolicy: "Never",
            imagePullSecrets: [{ name: "pull-secret" }],
            containers: [
              {
                name: "job",
                image: "python:3.12",
                command: ["python", "-c"],
                args: ["print('hello')"],
                resources: {
                  requests: { cpu: "1", memory: "256Mi" },
                  limits: { cpu: "1", memory: "256Mi" }
                }
              }
            ]
          }
        }
      }
    });
  });

  it("does not generate forbidden pod fields", () => {
    const manifest = buildK8sJobManifest({
      workspaceId: null,
      jobSpecHash: "hash-1",
      namespace: "default",
      profile: {
        id: "cpu-smoke",
        clusterId: "default",
        defaultImage: "python:3.12"
      },
      input: {
        profileId: "cpu-smoke",
        generateName: "smoke-",
        command: ["python", "-c"],
        args: ["print('hello')"]
      }
    });
    const serialized = JSON.stringify(manifest);
    expect(serialized).not.toContain("hostPath");
    expect(serialized).not.toContain("hostNetwork");
    expect(serialized).not.toContain("hostPID");
    expect(serialized).not.toContain("hostIPC");
    expect(serialized).not.toContain("privileged");
    expect(serialized).not.toContain("schedulerName");
    expect(serialized).not.toContain("nodeSelector");
    expect(serialized).not.toContain("affinity");
  });
});
```

- [ ] **Step 2: Write failing policy tests**

Create `src/lib/cluster/job-policy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  computeK8sJobSpecHash,
  ensureOwnedK8sJob,
  normalizeK8sJobInput,
  validateK8sJobInput,
} from "./job-policy";

describe("validateK8sJobInput", () => {
  it("accepts one name strategy and a valid image", () => {
    expect(() =>
      validateK8sJobInput({
        profileId: "cpu-smoke",
        jobName: "smoke-test",
        image: "python:3.12",
        command: ["python", "-c"],
        args: ["print('hello')"]
      }),
    ).not.toThrow();
  });

  it("rejects both jobName and generateName", () => {
    expect(() =>
      validateK8sJobInput({
        profileId: "cpu-smoke",
        jobName: "smoke-test",
        generateName: "smoke-",
        image: "python:3.12"
      }),
    ).toThrow(/Only one of jobName or generateName/);
  });
});

describe("computeK8sJobSpecHash", () => {
  it("is stable for equivalent normalized objects", () => {
    const left = computeK8sJobSpecHash({
      scope: { context: "ctx", namespace: "default" },
      manifest: { b: 2, a: 1 }
    });
    const right = computeK8sJobSpecHash({
      manifest: { a: 1, b: 2 },
      scope: { namespace: "default", context: "ctx" }
    });
    expect(left).toBe(right);
  });
});

describe("ensureOwnedK8sJob", () => {
  it("accepts matching InnoClaw labels", () => {
    expect(() =>
      ensureOwnedK8sJob(
        {
          metadata: {
            labels: {
              "app.kubernetes.io/managed-by": "innoclaw",
              "innoclaw.ai/job-hash": "hash-1"
            }
          }
        },
        "hash-1",
      ),
    ).not.toThrow();
  });

  it("rejects resources without matching ownership", () => {
    expect(() =>
      ensureOwnedK8sJob({ metadata: { labels: {} } }, "hash-1"),
    ).toThrow(/not owned by InnoClaw/);
  });
});

describe("normalizeK8sJobInput", () => {
  it("removes undefined fields before hashing", () => {
    expect(
      normalizeK8sJobInput({
        profileId: "cpu-smoke",
        jobName: "smoke-test",
        image: undefined,
        env: []
      }),
    ).toEqual({
      profileId: "cpu-smoke",
      jobName: "smoke-test",
      env: []
    });
  });
});
```

- [ ] **Step 3: Run tests and confirm they fail**

Run:

```bash
npm test -- src/lib/cluster/job-manifest.test.ts src/lib/cluster/job-policy.test.ts
```

Expected: fail because implementation files do not exist.

- [ ] **Step 4: Implement policy helpers**

Create `src/lib/cluster/job-policy.ts` with these exports:

```ts
import crypto from "crypto";
import { isValidDnsLabel, isValidImageRef } from "@/lib/utils/validators";

export interface K8sJobToolInput {
  profileId: string;
  jobName?: string;
  generateName?: string;
  namespace?: string;
  image?: string;
  command?: string[];
  args?: string[];
  env?: Array<{ name: string; value: string }>;
  resources?: {
    requests?: Record<string, string>;
    limits?: Record<string, string>;
  };
  ttlSecondsAfterFinished?: number;
  backoffLimit?: number;
}

export const INNOCLAW_MANAGED_BY_LABEL = "app.kubernetes.io/managed-by";
export const INNOCLAW_WORKSPACE_LABEL = "innoclaw.ai/workspace-id";
export const INNOCLAW_JOB_HASH_LABEL = "innoclaw.ai/job-hash";

export function validateK8sJobInput(input: K8sJobToolInput): void {
  if (!input.profileId) throw new Error("profileId is required");
  if (input.jobName && input.generateName) {
    throw new Error("Only one of jobName or generateName may be set");
  }
  if (input.jobName && !isValidDnsLabel(input.jobName)) {
    throw new Error("jobName must be a valid DNS label");
  }
  if (input.generateName && input.generateName.length > 63) {
    throw new Error("generateName must be at most 63 characters");
  }
  if (input.namespace && !isValidDnsLabel(input.namespace)) {
    throw new Error("namespace must be a valid DNS label");
  }
  if (input.image && !isValidImageRef(input.image)) {
    throw new Error("image must be a valid OCI image reference");
  }
}

export function normalizeK8sJobInput(input: K8sJobToolInput): K8sJobToolInput {
  return JSON.parse(JSON.stringify(input));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeK8sJobSpecHash(value: unknown): string {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function ensureOwnedK8sJob(resource: unknown, expectedHash?: string): void {
  const labels =
    resource &&
    typeof resource === "object" &&
    "metadata" in resource &&
    typeof (resource as { metadata?: unknown }).metadata === "object"
      ? ((resource as { metadata?: { labels?: Record<string, string> } }).metadata
          ?.labels ?? {})
      : {};
  if (labels[INNOCLAW_MANAGED_BY_LABEL] !== "innoclaw") {
    throw new Error("Kubernetes Job is not owned by InnoClaw");
  }
  if (expectedHash && labels[INNOCLAW_JOB_HASH_LABEL] !== expectedHash) {
    throw new Error("Kubernetes Job hash does not match the requested operation");
  }
}
```

- [ ] **Step 5: Implement manifest builder**

Create `src/lib/cluster/job-manifest.ts`:

```ts
import type { K8sJobProfile, K8sJobVolume } from "./job-profiles";
import type { K8sJobToolInput } from "./job-policy";
import {
  INNOCLAW_JOB_HASH_LABEL,
  INNOCLAW_MANAGED_BY_LABEL,
  INNOCLAW_WORKSPACE_LABEL,
} from "./job-policy";

export interface BuildK8sJobManifestInput {
  workspaceId?: string | null;
  jobSpecHash: string;
  namespace: string;
  profile: K8sJobProfile;
  input: K8sJobToolInput;
}

function buildVolume(volume: K8sJobVolume) {
  if (volume.type === "emptyDir") {
    return {
      name: volume.name,
      emptyDir: {
        ...(volume.medium ? { medium: volume.medium } : {}),
        ...(volume.sizeLimit ? { sizeLimit: volume.sizeLimit } : {}),
      },
    };
  }
  if (volume.type === "persistentVolumeClaim") {
    return {
      name: volume.name,
      persistentVolumeClaim: {
        claimName: volume.claimName,
        ...(volume.readOnly !== undefined ? { readOnly: volume.readOnly } : {}),
      },
    };
  }
  if (volume.type === "configMap") {
    return { name: volume.name, configMap: { name: volume.configMapName } };
  }
  return { name: volume.name, secret: { secretName: volume.secretName } };
}

function buildVolumeMount(volume: K8sJobVolume) {
  return {
    name: volume.name,
    mountPath: volume.mountPath,
    ...(volume.type !== "emptyDir" && volume.readOnly !== undefined
      ? { readOnly: volume.readOnly }
      : {}),
  };
}

export function buildK8sJobManifest(options: BuildK8sJobManifestInput) {
  const image = options.input.image ?? options.profile.defaultImage;
  if (!image) throw new Error("image is required by input or profile");
  const labels = {
    ...(options.profile.labels ?? {}),
    [INNOCLAW_MANAGED_BY_LABEL]: "innoclaw",
    ...(options.workspaceId ? { [INNOCLAW_WORKSPACE_LABEL]: options.workspaceId } : {}),
    [INNOCLAW_JOB_HASH_LABEL]: options.jobSpecHash,
  };
  const volumes = options.profile.volumes ?? [];
  return {
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: {
      ...(options.input.jobName ? { name: options.input.jobName } : {}),
      ...(options.input.generateName ? { generateName: options.input.generateName } : {}),
      namespace: options.namespace,
      labels,
      ...(options.profile.annotations ? { annotations: options.profile.annotations } : {}),
    },
    spec: {
      ...(options.input.ttlSecondsAfterFinished ?? options.profile.ttlSecondsAfterFinished !== undefined
        ? {
            ttlSecondsAfterFinished:
              options.input.ttlSecondsAfterFinished ??
              options.profile.ttlSecondsAfterFinished,
          }
        : {}),
      ...(options.input.backoffLimit ?? options.profile.backoffLimit !== undefined
        ? { backoffLimit: options.input.backoffLimit ?? options.profile.backoffLimit }
        : {}),
      template: {
        metadata: { labels },
        spec: {
          restartPolicy: "Never",
          ...(options.profile.imagePullSecrets?.length
            ? {
                imagePullSecrets: options.profile.imagePullSecrets.map((name) => ({
                  name,
                })),
              }
            : {}),
          ...(volumes.length ? { volumes: volumes.map(buildVolume) } : {}),
          containers: [
            {
              name: "job",
              image,
              ...(options.input.command ? { command: options.input.command } : {}),
              ...(options.input.args ? { args: options.input.args } : {}),
              ...(options.profile.env || options.input.env
                ? { env: [...(options.profile.env ?? []), ...(options.input.env ?? [])] }
                : {}),
              ...(options.input.resources ?? options.profile.resources
                ? { resources: options.input.resources ?? options.profile.resources }
                : {}),
              ...(volumes.length ? { volumeMounts: volumes.map(buildVolumeMount) } : {}),
            },
          ],
        },
      },
    },
  };
}

export function summarizeK8sJobManifest(manifest: ReturnType<typeof buildK8sJobManifest>) {
  const container = manifest.spec.template.spec.containers[0];
  return {
    name: manifest.metadata.name ?? null,
    generateName: manifest.metadata.generateName ?? null,
    namespace: manifest.metadata.namespace,
    image: container.image,
    command: container.command ?? [],
    args: container.args ?? [],
    resources: container.resources ?? {},
    imagePullSecrets:
      manifest.spec.template.spec.imagePullSecrets?.map((item) => item.name) ?? [],
  };
}
```

- [ ] **Step 6: Run manifest and policy tests**

Run:

```bash
npm test -- src/lib/cluster/job-manifest.test.ts src/lib/cluster/job-policy.test.ts
```

Expected: pass after minor TypeScript corrections for precedence or inferred object types.

- [ ] **Step 7: Commit Task 3**

Run:

```bash
git add src/lib/cluster/job-manifest.ts src/lib/cluster/job-manifest.test.ts src/lib/cluster/job-policy.ts src/lib/cluster/job-policy.test.ts
git commit -m "feat(cluster): build safe k8s job manifests"
```

---

### Task 4: Job Wait And Log Helpers

**Files:**

- Create: `src/lib/cluster/job-wait.ts`
- Create: `src/lib/cluster/job-wait.test.ts`

- [ ] **Step 1: Write failing wait tests**

Create `src/lib/cluster/job-wait.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  collectK8sJobLogs,
  waitForK8sJob,
  resolvePodFailure,
} from "./job-wait";

describe("resolvePodFailure", () => {
  it("surfaces image pull failures", () => {
    expect(
      resolvePodFailure({
        metadata: { name: "job-abc" },
        status: {
          containerStatuses: [
            { state: { waiting: { reason: "ImagePullBackOff", message: "pull failed" } } }
          ]
        }
      }),
    ).toEqual({
      podName: "job-abc",
      failureReason: "ImagePullBackOff",
      failureMessage: "pull failed"
    });
  });
});

describe("waitForK8sJob", () => {
  it("returns complete when the Job has a Complete condition", async () => {
    const executor = {
      runJson: vi.fn()
        .mockResolvedValueOnce({
          data: {
            metadata: { name: "smoke-test", namespace: "default" },
            status: { conditions: [{ type: "Complete", status: "True" }], succeeded: 1 }
          }
        })
        .mockResolvedValueOnce({ data: { items: [] } })
    };

    await expect(
      waitForK8sJob({
        executor: executor as never,
        scope: {
          kubeconfigPath: "/tmp/kubeconfig",
          context: "ctx",
          namespace: "default"
        },
        jobName: "smoke-test",
        timeoutSeconds: 5,
        pollIntervalSeconds: 1,
        sleep: async () => undefined,
        now: () => 0
      }),
    ).resolves.toMatchObject({
      status: "complete",
      job: { name: "smoke-test", succeeded: 1 }
    });
  });

  it("returns timeout when the Job does not become terminal", async () => {
    let currentTime = 0;
    const executor = {
      runJson: vi.fn()
        .mockResolvedValue({ data: { metadata: { name: "smoke-test" }, status: { active: 1 } } })
    };

    const result = await waitForK8sJob({
      executor: executor as never,
      scope: {
        kubeconfigPath: "/tmp/kubeconfig",
        context: "ctx",
        namespace: "default"
      },
      jobName: "smoke-test",
      timeoutSeconds: 2,
      pollIntervalSeconds: 1,
      sleep: async (ms) => {
        currentTime += ms;
      },
      now: () => currentTime
    });

    expect(result.status).toBe("timeout");
  });
});

describe("collectK8sJobLogs", () => {
  it("fetches logs from the newest related pod", async () => {
    const executor = {
      runJson: vi.fn().mockResolvedValue({
        data: {
          items: [
            { metadata: { name: "old", creationTimestamp: "2026-01-01T00:00:00Z" } },
            { metadata: { name: "new", creationTimestamp: "2026-01-01T00:01:00Z" } }
          ]
        }
      }),
      runText: vi.fn().mockResolvedValue({ data: "hello\n" })
    };

    await expect(
      collectK8sJobLogs({
        executor: executor as never,
        scope: {
          kubeconfigPath: "/tmp/kubeconfig",
          context: "ctx",
          namespace: "default"
        },
        jobName: "smoke-test",
        tailLines: 50
      }),
    ).resolves.toMatchObject({
      podName: "new",
      logs: "hello\n"
    });
  });
});
```

- [ ] **Step 2: Run wait tests and confirm they fail**

Run:

```bash
npm test -- src/lib/cluster/job-wait.test.ts
```

Expected: fail because `src/lib/cluster/job-wait.ts` does not exist.

- [ ] **Step 3: Implement wait and log helpers**

Create `src/lib/cluster/job-wait.ts` with these exports:

```ts
import type { KubectlRequest, createKubectlExecutor } from "./kubectl-executor";

type KubectlExecutor = ReturnType<typeof createKubectlExecutor>;

export interface K8sJobResource {
  metadata?: { name?: string; namespace?: string };
  status?: {
    active?: number;
    succeeded?: number;
    failed?: number;
    completionTime?: string;
    conditions?: Array<{ type?: string; status?: string; reason?: string; message?: string }>;
  };
}

export interface K8sPodItem {
  metadata?: { name?: string; creationTimestamp?: string };
  status?: {
    phase?: string;
    reason?: string;
    message?: string;
    conditions?: Array<{ type?: string; status?: string; reason?: string; message?: string }>;
    containerStatuses?: Array<{
      state?: {
        waiting?: { reason?: string; message?: string };
        terminated?: { reason?: string; message?: string };
      };
    }>;
  };
}

export function summarizeK8sJob(job: K8sJobResource) {
  return {
    name: job.metadata?.name ?? "unknown",
    namespace: job.metadata?.namespace ?? null,
    active: job.status?.active ?? 0,
    succeeded: job.status?.succeeded ?? 0,
    failed: job.status?.failed ?? 0,
    completionTime: job.status?.completionTime,
    conditions: job.status?.conditions ?? [],
  };
}

function resolveTerminalStatus(job: K8sJobResource): "complete" | "failed" | null {
  const conditions = job.status?.conditions ?? [];
  if (conditions.some((item) => item.type === "Failed" && item.status === "True")) {
    return "failed";
  }
  if (conditions.some((item) => item.type === "Complete" && item.status === "True")) {
    return "complete";
  }
  return null;
}

export function pickNewestPod(items: K8sPodItem[]): K8sPodItem | undefined {
  return [...items].sort((left, right) =>
    (right.metadata?.creationTimestamp ?? "").localeCompare(
      left.metadata?.creationTimestamp ?? "",
    ),
  )[0];
}

export function resolvePodFailure(item?: K8sPodItem) {
  if (!item) return null;
  const podName = item.metadata?.name;
  const waiting = item.status?.containerStatuses
    ?.map((status) => status.state?.waiting)
    .find(Boolean);
  const terminalWaitingReasons = new Set([
    "ImagePullBackOff",
    "ErrImagePull",
    "CreateContainerConfigError",
    "CreateContainerError",
    "InvalidImageName",
    "RunContainerError",
  ]);
  if (waiting?.reason && terminalWaitingReasons.has(waiting.reason)) {
    return { podName, failureReason: waiting.reason, failureMessage: waiting.message };
  }
  const unschedulable = item.status?.conditions?.find(
    (condition) =>
      condition.type === "PodScheduled" &&
      condition.status === "False" &&
      condition.reason === "Unschedulable",
  );
  if (unschedulable) {
    return {
      podName,
      failureReason: unschedulable.reason,
      failureMessage: unschedulable.message,
    };
  }
  if (item.status?.phase === "Failed") {
    return {
      podName,
      failureReason: item.status.reason ?? "Failed",
      failureMessage: item.status.message,
    };
  }
  return null;
}

async function fetchPods(
  executor: KubectlExecutor,
  scope: Pick<KubectlRequest, "kubeconfigPath" | "context" | "namespace" | "env">,
  jobName: string,
): Promise<K8sPodItem[]> {
  const result = await executor.runJson<{ items: K8sPodItem[] }>({
    ...scope,
    args: ["get", "pods", "-l", `job-name=${jobName}`, "-o", "json"],
  });
  return result.data.items ?? [];
}

export async function waitForK8sJob(options: {
  executor: KubectlExecutor;
  scope: Pick<KubectlRequest, "kubeconfigPath" | "context" | "namespace" | "env">;
  jobName: string;
  timeoutSeconds: number;
  pollIntervalSeconds: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}) {
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const deadline = now() + options.timeoutSeconds * 1000;
  let polls = 0;
  while (true) {
    polls += 1;
    const jobResult = await options.executor.runJson<K8sJobResource>({
      ...options.scope,
      args: ["get", "job", options.jobName, "-o", "json"],
    });
    const terminal = resolveTerminalStatus(jobResult.data);
    const job = summarizeK8sJob(jobResult.data);
    if (terminal) return { status: terminal, polls, job };
    const pods = await fetchPods(options.executor, options.scope, options.jobName);
    const podFailure = resolvePodFailure(pickNewestPod(pods));
    if (podFailure) return { status: "failed" as const, polls, job, ...podFailure };
    if (now() >= deadline) return { status: "timeout" as const, polls, job };
    await sleep(options.pollIntervalSeconds * 1000);
  }
}

export async function collectK8sJobLogs(options: {
  executor: KubectlExecutor;
  scope: Pick<KubectlRequest, "kubeconfigPath" | "context" | "namespace" | "env">;
  jobName: string;
  tailLines: number;
}) {
  const pods = await fetchPods(options.executor, options.scope, options.jobName);
  const pod = pickNewestPod(pods);
  const podName = pod?.metadata?.name;
  if (!podName) return { podName: null, logs: "", logsError: "No pod found for job" };
  const logs = await options.executor.runText({
    ...options.scope,
    args: ["logs", podName, "--tail", String(options.tailLines)],
  });
  return { podName, logs: logs.data };
}
```

- [ ] **Step 4: Run wait tests**

Run:

```bash
npm test -- src/lib/cluster/job-wait.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
git add src/lib/cluster/job-wait.ts src/lib/cluster/job-wait.test.ts
git commit -m "feat(cluster): add generic k8s job wait helpers"
```

---

### Task 5: Agent Tool Implementations

**Files:**

- Create: `src/lib/ai/tools/k8s-job-tools.ts`
- Create: `src/lib/ai/tools/k8s-job-tools.test.ts`
- Modify: `src/lib/ai/tools/types.ts`
- Modify: `src/lib/ai/tools/index.ts`

- [ ] **Step 1: Extend `ToolContext`**

Modify `src/lib/ai/tools/types.ts`:

```ts
import type { K8sConfig } from "@/lib/cluster/config";
import type { K8sJobConfig } from "@/lib/cluster/job-profiles";

export interface ToolContext {
  validatedCwd: string;
  resolvePath: (filePath: string) => string;
  kubeconfigPath: string;
  k8sConfig: K8sConfig;
  k8sJobConfig: K8sJobConfig;
  baseExecEnv: NodeJS.ProcessEnv;
  workspaceId?: string | null;
  researchHistoryDir?: string;
  isLongAgent?: boolean;
}
```

- [ ] **Step 2: Load generic job config in the tool registry**

Modify `src/lib/ai/tools/index.ts`:

```ts
import { getK8sJobConfig } from "@/lib/cluster/job-profiles";
import { createK8sJobTools } from "./k8s-job-tools";
```

Inside `createAgentTools`, after `const k8sConfig = await getK8sConfig();`, add:

```ts
const k8sJobConfig = await getK8sJobConfig();
```

Inside `ctx`, add:

```ts
k8sJobConfig,
```

Inside `allTools`, after `...createK8sTools(ctx),`, add:

```ts
...createK8sJobTools(ctx),
```

- [ ] **Step 3: Write failing tool tests**

Create `src/lib/ai/tools/k8s-job-tools.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createK8sJobTools } from "./k8s-job-tools";
import type { ToolContext } from "./types";

function createCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    validatedCwd: "/tmp/workspace",
    resolvePath: (filePath) => filePath,
    kubeconfigPath: "/tmp/legacy-kubeconfig",
    k8sConfig: {} as never,
    k8sJobConfig: {
      clusters: [
        {
          id: "default",
          kubeconfigPath: "/tmp/kubeconfig",
          context: "kind-local",
          defaultNamespace: "default",
          allowedNamespaces: ["default"]
        }
      ],
      profiles: [
        {
          id: "cpu-smoke",
          clusterId: "default",
          namespace: "default",
          defaultImage: "python:3.12"
        }
      ]
    },
    baseExecEnv: {},
    workspaceId: "ws-1",
    ...overrides,
  };
}

describe("createK8sJobTools", () => {
  it("prepares a job and returns a review hash", async () => {
    const executor = {
      runText: vi.fn().mockResolvedValue({ data: "job.batch/smoke-test dry-run", stdout: "", stderr: "", exitCode: 0 }),
      runJson: vi.fn()
    };
    const recordClusterOp = vi.fn().mockResolvedValue("op-1");
    const tools = createK8sJobTools(createCtx(), { executor: executor as never, recordClusterOp });

    const result = await tools.prepareK8sJob.execute({
      profileId: "cpu-smoke",
      jobName: "smoke-test",
      command: ["python", "-c"],
      args: ["print('hello')"]
    });

    expect(result.success).toBe(true);
    expect(result.jobSpecHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.review).toMatchObject({
      namespace: "default",
      image: "python:3.12"
    });
    expect(executor.runText).toHaveBeenCalledWith(
      expect.objectContaining({
        args: ["apply", "--dry-run=client", "-f", "-"],
        namespace: "default"
      }),
    );
    expect(recordClusterOp).toHaveBeenCalledWith(expect.objectContaining({
      toolName: "prepareK8sJob",
      status: "success"
    }));
  });

  it("rejects run when the supplied hash does not match the rebuilt manifest", async () => {
    const tools = createK8sJobTools(createCtx(), {
      executor: { runText: vi.fn(), runJson: vi.fn() } as never,
      recordClusterOp: vi.fn().mockResolvedValue("op-1")
    });

    const result = await tools.runK8sJob.execute({
      profileId: "cpu-smoke",
      jobName: "smoke-test",
      command: ["python", "-c"],
      args: ["print('hello')"],
      jobSpecHash: "bad-hash",
      confirmSubmit: true
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/hash does not match/);
  });
});
```

- [ ] **Step 4: Run tool tests and confirm they fail**

Run:

```bash
npm test -- src/lib/ai/tools/k8s-job-tools.test.ts
```

Expected: fail because `createK8sJobTools` does not exist.

- [ ] **Step 5: Implement `createK8sJobTools`**

Create `src/lib/ai/tools/k8s-job-tools.ts` with injected dependencies for testing:

```ts
import { tool } from "ai";
import { z } from "zod";
import { recordClusterOp as defaultRecordClusterOp } from "@/lib/cluster/operations";
import { createKubectlExecutor } from "@/lib/cluster/kubectl-executor";
import { buildK8sJobManifest, summarizeK8sJobManifest } from "@/lib/cluster/job-manifest";
import {
  computeK8sJobSpecHash,
  ensureOwnedK8sJob,
  normalizeK8sJobInput,
  validateK8sJobInput,
} from "@/lib/cluster/job-policy";
import { collectK8sJobLogs, waitForK8sJob } from "@/lib/cluster/job-wait";
import { resolveK8sJobProfile } from "@/lib/cluster/job-profiles";
import { logAndIgnore } from "@/lib/utils/log";
import type { ToolContext } from "./types";

const envVarSchema = z.object({ name: z.string().min(1), value: z.string() }).strict();
const resourceSchema = z.object({
  requests: z.record(z.string().min(1), z.string().min(1)).optional(),
  limits: z.record(z.string().min(1), z.string().min(1)).optional(),
}).strict();

const baseJobInputSchema = z.object({
  profileId: z.string().min(1),
  jobName: z.string().min(1).optional(),
  generateName: z.string().min(1).optional(),
  namespace: z.string().min(1).optional(),
  image: z.string().min(1).optional(),
  command: z.array(z.string().min(1)).optional(),
  args: z.array(z.string().min(1)).optional(),
  env: z.array(envVarSchema).optional(),
  resources: resourceSchema.optional(),
  ttlSecondsAfterFinished: z.number().int().nonnegative().optional(),
  backoffLimit: z.number().int().nonnegative().optional(),
});

type BaseJobInput = z.infer<typeof baseJobInputSchema>;
type Executor = ReturnType<typeof createKubectlExecutor>;

export function createK8sJobTools(
  ctx: ToolContext,
  deps?: {
    executor?: Executor;
    recordClusterOp?: typeof defaultRecordClusterOp;
  },
) {
  const executor = deps?.executor ?? createKubectlExecutor();
  const recordClusterOp = deps?.recordClusterOp ?? defaultRecordClusterOp;

  function buildPrepared(input: BaseJobInput) {
    validateK8sJobInput(input);
    const resolved = resolveK8sJobProfile(
      ctx.k8sJobConfig,
      input.profileId,
      input.namespace,
    );
    const normalized = normalizeK8sJobInput(input);
    const provisionalHash = computeK8sJobSpecHash({
      scope: {
        context: resolved.cluster.context,
        namespace: resolved.namespace,
      },
      input: normalized,
    });
    const manifest = buildK8sJobManifest({
      workspaceId: ctx.workspaceId,
      jobSpecHash: provisionalHash,
      namespace: resolved.namespace,
      profile: resolved.profile,
      input,
    });
    const jobSpecHash = computeK8sJobSpecHash({
      scope: {
        context: resolved.cluster.context,
        namespace: resolved.namespace,
      },
      manifest,
    });
    const finalManifest = buildK8sJobManifest({
      workspaceId: ctx.workspaceId,
      jobSpecHash,
      namespace: resolved.namespace,
      profile: resolved.profile,
      input,
    });
    return { resolved, manifest: finalManifest, jobSpecHash };
  }

  function scopeFor(resolved: ReturnType<typeof resolveK8sJobProfile>) {
    return {
      kubeconfigPath: resolved.cluster.kubeconfigPath,
      context: resolved.cluster.context,
      namespace: resolved.namespace,
      env: { ...ctx.baseExecEnv, KUBECONFIG: resolved.cluster.kubeconfigPath } as NodeJS.ProcessEnv,
    };
  }

  return {
    prepareK8sJob: tool({
      description: "Prepare and dry-run a generic Kubernetes batch/v1 Job from structured inputs. Returns a review summary and jobSpecHash for confirmation-bound submission.",
      inputSchema: baseJobInputSchema,
      execute: async (input) => {
        try {
          const prepared = buildPrepared(input);
          await executor.runText({
            ...scopeFor(prepared.resolved),
            args: ["apply", "--dry-run=client", "-f", "-"],
            stdin: JSON.stringify(prepared.manifest),
          });
          const review = summarizeK8sJobManifest(prepared.manifest);
          const result = {
            success: true,
            profileId: input.profileId,
            jobName: review.name,
            generateName: review.generateName,
            namespace: review.namespace,
            jobSpecHash: prepared.jobSpecHash,
            review,
            manifest: prepared.manifest,
          };
          recordClusterOp({
            workspaceId: ctx.workspaceId,
            toolName: "prepareK8sJob",
            jobName: review.name ?? undefined,
            namespace: review.namespace,
            status: "success",
            summary: `Prepared generic K8s Job ${review.name ?? review.generateName ?? "generated"}`,
            input: { profileId: input.profileId, namespace: review.namespace },
            output: { jobSpecHash: prepared.jobSpecHash, image: review.image },
          }).catch(logAndIgnore("recordClusterOp"));
          return result;
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to prepare K8s job",
          };
        }
      },
    }),
    runK8sJob: tool({
      description: "Submit a previously prepared generic Kubernetes batch/v1 Job. Requires confirmSubmit=true and the matching jobSpecHash returned by prepareK8sJob.",
      inputSchema: baseJobInputSchema.extend({
        jobSpecHash: z.string().min(1),
        confirmSubmit: z.boolean().optional(),
      }),
      execute: async (input) => {
        try {
          if (!input.confirmSubmit) {
            return { success: false, error: "confirmSubmit=true is required" };
          }
          const { jobSpecHash: suppliedHash, confirmSubmit: _confirmSubmit, ...baseInput } = input;
          const prepared = buildPrepared(baseInput);
          if (prepared.jobSpecHash !== suppliedHash) {
            return {
              success: false,
              error: "jobSpecHash does not match the rebuilt manifest",
            };
          }
          const created = await executor.runJson<{ metadata?: { name?: string } }>({
            ...scopeFor(prepared.resolved),
            args: ["create", "-f", "-", "-o", "json"],
            stdin: JSON.stringify(prepared.manifest),
          });
          const jobName = created.data.metadata?.name ?? baseInput.jobName ?? null;
          recordClusterOp({
            workspaceId: ctx.workspaceId,
            toolName: "runK8sJob",
            jobName: jobName ?? undefined,
            namespace: prepared.resolved.namespace,
            status: "success",
            exitCode: 0,
            summary: `Submitted generic K8s Job ${jobName ?? "generated"}`,
            input: { profileId: baseInput.profileId, namespace: prepared.resolved.namespace },
            output: { jobName, jobSpecHash: suppliedHash },
          }).catch(logAndIgnore("recordClusterOp"));
          return { success: true, jobName, namespace: prepared.resolved.namespace };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to submit K8s job",
          };
        }
      },
    }),
    waitForK8sJob: tool({
      description: "Poll a generic Kubernetes Job until it completes, fails, or times out.",
      inputSchema: z.object({
        profileId: z.string().min(1),
        namespace: z.string().min(1).optional(),
        jobName: z.string().min(1),
        timeoutSeconds: z.number().int().positive().optional(),
        pollIntervalSeconds: z.number().int().positive().optional(),
      }),
      execute: async (input) => {
        const resolved = resolveK8sJobProfile(ctx.k8sJobConfig, input.profileId, input.namespace);
        return waitForK8sJob({
          executor,
          scope: scopeFor(resolved),
          jobName: input.jobName,
          timeoutSeconds: input.timeoutSeconds ?? 600,
          pollIntervalSeconds: input.pollIntervalSeconds ?? 5,
        });
      },
    }),
    collectK8sJobLogs: tool({
      description: "Collect bounded logs from the newest Pod associated with a generic Kubernetes Job.",
      inputSchema: z.object({
        profileId: z.string().min(1),
        namespace: z.string().min(1).optional(),
        jobName: z.string().min(1),
        tailLines: z.number().int().positive().optional(),
      }),
      execute: async (input) => {
        const resolved = resolveK8sJobProfile(ctx.k8sJobConfig, input.profileId, input.namespace);
        return collectK8sJobLogs({
          executor,
          scope: scopeFor(resolved),
          jobName: input.jobName,
          tailLines: Math.min(input.tailLines ?? 200, 2000),
        });
      },
    }),
    cleanupK8sJob: tool({
      description: "Delete a generic Kubernetes Job only after verifying it is managed by InnoClaw and matches the expected jobSpecHash.",
      inputSchema: z.object({
        profileId: z.string().min(1),
        namespace: z.string().min(1).optional(),
        jobName: z.string().min(1),
        jobSpecHash: z.string().min(1).optional(),
        confirmDelete: z.boolean().optional(),
      }),
      execute: async (input) => {
        if (!input.confirmDelete) return { success: false, error: "confirmDelete=true is required" };
        const resolved = resolveK8sJobProfile(ctx.k8sJobConfig, input.profileId, input.namespace);
        const job = await executor.runJson<unknown>({
          ...scopeFor(resolved),
          args: ["get", "job", input.jobName, "-o", "json"],
        });
        ensureOwnedK8sJob(job.data, input.jobSpecHash);
        const deleted = await executor.runText({
          ...scopeFor(resolved),
          args: ["delete", "job", input.jobName],
        });
        return { success: true, jobName: input.jobName, output: deleted.data };
      },
    }),
  };
}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- src/lib/ai/tools/k8s-job-tools.test.ts src/lib/cluster/job-profiles.test.ts src/lib/cluster/job-manifest.test.ts src/lib/cluster/job-policy.test.ts src/lib/cluster/job-wait.test.ts
```

Expected: pass after aligning inferred tool execute types with AI SDK v6.

- [ ] **Step 7: Commit Task 5**

Run:

```bash
git add src/lib/ai/tools/types.ts src/lib/ai/tools/index.ts src/lib/ai/tools/k8s-job-tools.ts src/lib/ai/tools/k8s-job-tools.test.ts
git commit -m "feat(agent): add generic k8s job tools"
```

---

### Task 6: Tool Contracts, Prompting, And UI Rendering

**Files:**

- Modify: `src/lib/ai/tool-names.ts`
- Modify: `src/lib/ai/agent-prompts.ts`
- Modify: `src/components/agent/tool-call-block.tsx`
- Modify: `src/lib/report/extract-report.ts`
- Modify: `src/components/report/process-timeline.tsx`
- Modify: `src/lib/bot/feishu/cards.ts`

- [ ] **Step 1: Add new high-privilege tool names**

Modify `src/lib/ai/tool-names.ts`:

```ts
export const K8S_TOOLS = [
  "kubectl",
  "submitK8sJob",
  "prepareK8sJob",
  "runK8sJob",
  "waitForK8sJob",
  "collectK8sJobLogs",
  "cleanupK8sJob",
] as const;
```

- [ ] **Step 2: Update agent prompt tool descriptions**

In `src/lib/ai/agent-prompts.ts`, add generic tool descriptions before legacy submit text:

```ts
- **prepareK8sJob**: Prepare and dry-run a generic Kubernetes batch/v1 Job from structured inputs and a configured profile. Use this before submitting any generic Kubernetes Job.
- **runK8sJob**: Submit a prepared generic Kubernetes Job only after the user confirms the preview and the jobSpecHash matches.
- **waitForK8sJob**: Poll a submitted generic Kubernetes Job until complete, failed, or timeout.
- **collectK8sJobLogs**: Collect bounded logs from the newest Pod associated with a generic Kubernetes Job.
- **cleanupK8sJob**: Delete only InnoClaw-managed generic Kubernetes Jobs after explicit confirmation.
```

Replace the old K8s job guideline with:

```ts
10. For generic Kubernetes Jobs, prefer prepareK8sJob first. Show the profile, namespace, image, command, resources, and jobSpecHash to the user. Call runK8sJob only after explicit confirmation, then use waitForK8sJob and collectK8sJobLogs. Use legacy cluster-specific submit tools only when the workspace or user explicitly asks for that legacy path.
```

- [ ] **Step 3: Render new tool summaries in the agent panel**

In `src/components/agent/tool-call-block.tsx`, extend `TOOL_ICONS`:

```tsx
prepareK8sJob: <Terminal className="h-3.5 w-3.5" />,
runK8sJob: <Terminal className="h-3.5 w-3.5" />,
waitForK8sJob: <Terminal className="h-3.5 w-3.5" />,
collectK8sJobLogs: <Terminal className="h-3.5 w-3.5" />,
cleanupK8sJob: <Terminal className="h-3.5 w-3.5" />,
```

Extend `getToolSummary`:

```ts
case "prepareK8sJob":
  return `prepare ${args.jobName || args.generateName || args.profileId || ""}`;
case "runK8sJob":
  return `run ${args.jobName || args.generateName || args.profileId || ""}`;
case "waitForK8sJob":
  return `wait ${args.jobName || ""}`;
case "collectK8sJobLogs":
  return `logs ${args.jobName || ""}`;
case "cleanupK8sJob":
  return `cleanup ${args.jobName || ""}`;
```

Add result rendering cases that show `success`, `jobName`, `namespace`, `status`, `podName`, `logs`, and `error` without printing full private profile config.

- [ ] **Step 4: Update report labels**

In `src/lib/report/extract-report.ts`, extend `TOOL_LABEL_MAP`:

```ts
prepareK8sJob: "Prepared K8s job",
runK8sJob: "Submitted K8s job",
waitForK8sJob: "Waited for K8s job",
collectK8sJobLogs: "Collected K8s job logs",
cleanupK8sJob: "Cleaned up K8s job",
```

- [ ] **Step 5: Update fixed UI maps**

Search for fixed tool maps:

```bash
rg -n "submitK8sJob|collectJobResults|kubectl|TOOL_LABEL_MAP|TOOL_ICONS" src/components src/lib
```

For each fixed map in `src/components/report/process-timeline.tsx` and `src/lib/bot/feishu/cards.ts`, add the same five new tool names with generic labels. Use `Terminal`, `Server`, or the existing cluster icon already used for `kubectl`.

- [ ] **Step 6: Run focused static checks**

Run:

```bash
npm test -- src/lib/ai/tools/k8s-job-tools.test.ts
npx tsc --noEmit
```

Expected: tests pass and TypeScript catches no missing tool-name union references. If `npx tsc --noEmit` reveals unrelated existing errors, record them and still fix all errors introduced by this task.

- [ ] **Step 7: Commit Task 6**

Run:

```bash
git add src/lib/ai/tool-names.ts src/lib/ai/agent-prompts.ts src/components/agent/tool-call-block.tsx src/lib/report/extract-report.ts src/components/report/process-timeline.tsx src/lib/bot/feishu/cards.ts
git commit -m "feat(agent): expose generic k8s job workflow"
```

---

### Task 7: Documentation And Environment Cleanup

**Files:**

- Modify: `.env.example`
- Modify: `docs/getting-started/environment-variables.md`
- Modify: `docs/development/agent-development.md`
- Modify: `docs/usage/features.md`
- Modify: `docs/usage/api-reference.md`
- Create: `docs/development/generic-k8s-job-scheduler.md`

- [ ] **Step 1: Update `.env.example`**

Replace the current legacy-specific K8s block with this generic block:

```env
# Generic Kubernetes Job scheduling for Agent mode
# Install kubectl first: https://kubernetes.io/docs/tasks/tools/
# KUBECONFIG_PATH=/path/to/your/kubeconfig
# K8S_CONTEXT=your-kubeconfig-context
# K8S_DEFAULT_NAMESPACE=default
# K8S_ALLOWED_NAMESPACES=default,experiments
# K8S_JOB_DEFAULT_IMAGE=python:3.12
# K8S_JOB_PROFILE_ID=default
#
# Optional: load full cluster/profile defaults from JSON.
# The local file is ignored by git and may contain private cluster details.
# K8S_JOB_PROFILES_FILE=config/k8s-job-profiles.local.json
#
# Legacy cluster-specific settings may still be used by existing legacy tools.
# Prefer the generic profile-based Job tools for new installations.
```

- [ ] **Step 2: Update environment variable docs**

In `docs/getting-started/environment-variables.md`, replace the Kubernetes table with:

```md
| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `KUBECONFIG_PATH` | `string` | No | - | Path to the kubeconfig file used by generic Kubernetes Job tools. |
| `K8S_CONTEXT` | `string` | No | - | Kubeconfig context used by the generic Job profile fallback. |
| `K8S_DEFAULT_NAMESPACE` | `string` | No | `default` | Default namespace for the generic Job profile fallback. |
| `K8S_ALLOWED_NAMESPACES` | `string` | No | `K8S_DEFAULT_NAMESPACE` | Comma-separated namespace allow-list for generic Job tools. |
| `K8S_JOB_DEFAULT_IMAGE` | `string` | No | - | Default image for the generic Job profile fallback. |
| `K8S_JOB_PROFILE_ID` | `string` | No | `default` | Profile id used when env vars create the fallback profile. |
| `K8S_JOB_PROFILES_FILE` | `string` | No | - | Path to a private local JSON file containing generic clusters and Job profiles. |
| `K8S_JOB_PROFILES_JSON` | `string` | No | - | Inline JSON config for generic clusters and Job profiles. Use a file for private local values. |
```

- [ ] **Step 3: Create the generic scheduler development doc**

Create `docs/development/generic-k8s-job-scheduler.md`:

```md
# Generic Kubernetes Job Scheduler

The generic scheduler lets agents create standard Kubernetes `batch/v1 Job` resources from structured inputs. It does not assume a GPU vendor, custom scheduler, PVC layout, registry, namespace, or CRD.

## Configuration

Use environment variables for a simple single-profile setup:

```bash
KUBECONFIG_PATH=/path/to/kubeconfig
K8S_CONTEXT=local-context
K8S_DEFAULT_NAMESPACE=default
K8S_ALLOWED_NAMESPACES=default
K8S_JOB_DEFAULT_IMAGE=python:3.12
```

Use `config/k8s-job-profiles.local.json` for private local profiles. Do not commit that file.

## Agent Flow

1. `prepareK8sJob` builds and dry-runs the Job.
2. The user reviews profile, namespace, image, command, resources, and `jobSpecHash`.
3. `runK8sJob` submits only when the hash matches and the user confirms.
4. `waitForK8sJob` waits for a terminal state.
5. `collectK8sJobLogs` collects bounded logs.
6. `cleanupK8sJob` deletes only InnoClaw-managed Jobs after confirmation.

## Local Smoke Test

Use a private profile and run a minimal command such as:

```json
{
  "profileId": "cpu-smoke",
  "jobName": "innoclaw-smoke-test",
  "command": ["python", "-c"],
  "args": ["print('innoclaw-k8s-smoke-ok')"]
}
```

The smoke report may include profile id, job name, namespace, terminal status, log tail, and cleanup result. It must not include kubeconfig contents, tokens, secret values, internal node names, private topology, or unredacted private image paths.
```

- [ ] **Step 4: Update agent development docs**

In `docs/development/agent-development.md`, add a bullet under Tooling And Privilege Boundaries:

```md
- Generic Kubernetes Job scheduling must use the structured `prepareK8sJob` -> `runK8sJob` -> `waitForK8sJob` flow. Do not add raw manifest submission or cluster-specific scheduler defaults without explicit policy gates, tests, and docs.
```

- [ ] **Step 5: Update usage docs**

In `docs/usage/features.md`, replace legacy-specific Kubernetes bullets with:

```md
- **prepareK8sJob / runK8sJob** - Prepare and submit standard Kubernetes `batch/v1 Job` resources from structured inputs and configured profiles.
- **waitForK8sJob / collectK8sJobLogs** - Monitor generic Jobs and collect bounded logs.
- **kubectl** - Read cluster status and run approved scoped commands when configured.
```

In `docs/usage/api-reference.md`, update cluster integration text so it says generic K8s Job tools require `KUBECONFIG_PATH` plus either generic env vars or a private profile file.

- [ ] **Step 6: Run documentation scans**

Run:

```bash
printf '%s\n' \
  '<legacy-cluster-name-1>' \
  '<legacy-cluster-name-2>' \
  '<private-registry-domain>' \
  '<private-org-domain>' \
  '<private-accelerator-name>' \
  > /tmp/innoclaw-k8s-private-terms.txt
rg -ni -f /tmp/innoclaw-k8s-private-terms.txt .env.example docs/getting-started/environment-variables.md docs/development/generic-k8s-job-scheduler.md docs/development/agent-development.md docs/usage/features.md docs/usage/api-reference.md
rm /tmp/innoclaw-k8s-private-terms.txt
```

Expected: no output in the generic docs and env example. If legacy docs still intentionally mention legacy paths outside the edited generic sections, keep those mentions only when clearly labeled legacy.

- [ ] **Step 7: Commit Task 7**

Run:

```bash
git add .env.example docs/getting-started/environment-variables.md docs/development/agent-development.md docs/development/generic-k8s-job-scheduler.md docs/usage/features.md docs/usage/api-reference.md
git commit -m "docs(cluster): document generic k8s job profiles"
```

---

### Task 8: Full Verification And Local Smoke Handoff

**Files:**

- No required code files.
- Optional local-only file: `config/k8s-job-profiles.local.json` stays untracked.

- [ ] **Step 1: Run the focused cluster and agent tests**

Run:

```bash
npm test -- src/lib/cluster/job-profiles.test.ts src/lib/cluster/kubectl-executor.test.ts src/lib/cluster/job-manifest.test.ts src/lib/cluster/job-policy.test.ts src/lib/cluster/job-wait.test.ts src/lib/ai/tools/k8s-job-tools.test.ts
```

Expected: all listed test files pass.

- [ ] **Step 2: Run the repository validation matrix**

Run:

```bash
npm run lint
npm test
NEXT_TELEMETRY_DISABLED=1 npm run build
```

Expected: all commands pass. If a command fails because of an unrelated pre-existing issue, capture the exact failing output and separate it from this feature's introduced failures.

- [ ] **Step 3: Confirm private profile files are ignored**

Run:

```bash
printf '%s\n' '{"clusters":[],"profiles":[]}' > config/k8s-job-profiles.local.json
git status --short --ignored config/k8s-job-profiles.local.json
rm config/k8s-job-profiles.local.json
```

Expected: the status output marks the file as ignored and the file is removed after the check.

- [ ] **Step 4: Prepare the local institution smoke test**

Create `config/k8s-job-profiles.local.json` locally with real private values. Use this shape and keep private values out of commits and handoff text:

```json
{
  "clusters": [
    {
      "id": "private-smoke",
      "kubeconfigPath": "/absolute/path/to/private/kubeconfig",
      "context": "private-context",
      "defaultNamespace": "private-namespace",
      "allowedNamespaces": ["private-namespace"]
    }
  ],
  "profiles": [
    {
      "id": "private-smoke",
      "clusterId": "private-smoke",
      "namespace": "private-namespace",
      "defaultImage": "private-image-redacted",
      "resources": {
        "requests": {
          "cpu": "1",
          "memory": "1Gi"
        },
        "limits": {
          "cpu": "1",
          "memory": "1Gi"
        }
      },
      "ttlSecondsAfterFinished": 3600,
      "backoffLimit": 0
    }
  ]
}
```

For GPU or private storage validation, add resource keys, imagePullSecrets, and volume entries only in the local file. Do not paste those values into issue comments, docs, commits, or chat summaries.

- [ ] **Step 5: Run the app and submit a smoke request through Agent mode**

Run:

```bash
npm run dev:no-auth
```

In the app, ask the agent to run a generic Kubernetes Job using the private smoke profile with this command:

```text
使用 prepareK8sJob 先预览一个 Job：profileId=private-smoke，jobName=innoclaw-smoke-test，command=["python","-c"]，args=["print('innoclaw-k8s-smoke-ok')"]。展示 preview 和 jobSpecHash 后等我确认。
```

After preview, confirm submission. The agent should call `runK8sJob`, then `waitForK8sJob`, then `collectK8sJobLogs`.

- [ ] **Step 6: Record a redacted smoke summary**

Use this summary format in the handoff:

```text
Local smoke:
- profile id: private-smoke
- job name: innoclaw-smoke-test
- namespace: redacted or approved namespace alias
- terminal status: complete
- expected log marker: innoclaw-k8s-smoke-ok
- cleanup: deleted or ttl configured
```

Do not include kubeconfig contents, tokens, secret values, internal node names, private cluster topology, or unredacted private image paths.

- [ ] **Step 7: Commit final verification docs if they changed**

If Task 8 produced tracked documentation adjustments, commit them:

```bash
git add docs/development/generic-k8s-job-scheduler.md
git commit -m "docs(cluster): clarify generic k8s smoke test"
```

If no tracked files changed, do not create an empty commit.

---

## Final Review Checklist

- [ ] `prepareK8sJob`, `runK8sJob`, `waitForK8sJob`, `collectK8sJobLogs`, and `cleanupK8sJob` are registered in `K8S_TOOLS`.
- [ ] The open-source path generates only standard `batch/v1 Job` resources.
- [ ] No raw manifest submission path was added.
- [ ] No private cluster names, internal image paths, PVC names, secret names, node labels, or custom scheduler defaults were committed.
- [ ] Mutating actions require explicit confirmation and are bound to a reviewed hash.
- [ ] Cleanup refuses Jobs without matching InnoClaw ownership labels.
- [ ] Unit tests cover profile resolution, executor scope control, manifest safety, hash binding, wait states, log collection, and tool contracts.
- [ ] Documentation explains generic profiles and local private smoke testing.
- [ ] The local smoke test was run or explicitly deferred with the reason.

## Self-Review

Spec coverage:

- Generic profile model: Task 1.
- Scoped kubectl executor: Task 2.
- Structured Job manifest builder and safety policy: Task 3.
- Wait and logs: Task 4.
- Agent tools and audit-compatible outputs: Task 5.
- Tool registration, prompt, UI, and report surfaces: Task 6.
- Docs and env cleanup: Task 7.
- Open-source validation and private real-cluster smoke test: Task 8.

Type consistency:

- Tool input type is `K8sJobToolInput`.
- Confirmation hash is consistently named `jobSpecHash`.
- Profile id is consistently named `profileId`.
- New tool names are consistently `prepareK8sJob`, `runK8sJob`, `waitForK8sJob`, `collectK8sJobLogs`, and `cleanupK8sJob`.
