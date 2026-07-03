# Generic Kubernetes Job Scheduler Design

## Summary

Add a generic Kubernetes `batch/v1 Job` scheduling path for InnoClaw agents. The open-source implementation must not assume any specific cluster topology, GPU vendor, scheduler, PVC, image registry, namespace, context, or CRD. Institution-specific behavior is supplied only through local private profiles that are ignored by git and used for real smoke testing.

The first version supports structured Job specs plus private profile validation. It does not expose raw manifest submission as the primary agent path.

## Goals

- Let agents prepare, submit, wait for, collect logs from, and clean up standard Kubernetes Jobs.
- Keep the default open-source path based only on standard Kubernetes primitives: `batch/v1 Job`, Pods, logs, events, and status reads.
- Support real validation on the local institution cluster through private profiles without committing private values.
- Keep cluster operations gated as high-risk tools and recorded in `cluster_operations`.
- Preserve existing legacy K8s tools while steering new agent behavior toward the generic Job workflow.

## Non-Goals

- Do not implement raw Kubernetes manifest submission in the first version.
- Do not add first-class custom scheduler, batch framework, CRD, or GPU-vendor-specific adapters in the first version.
- Do not commit institution-specific context names, namespaces, images, imagePullSecrets, PVC names, resource keys, node labels, or scheduler names.
- Do not migrate the full settings UI in the first implementation unless needed for tool usability.

## Chosen Approach

Use a generic Job core plus a profile layer:

- Open-source code defines a structured Job spec and generates a vanilla `batch/v1 Job`.
- Profiles provide defaults such as cluster selection, namespace, image, resources, env, labels, annotations, imagePullSecrets, and optional volume mounts.
- Public examples use anonymous CPU-only values.
- Local private profiles supply institution-specific values for real smoke tests and are excluded from git.

This keeps the open-source behavior portable while still proving the workflow works on the local real cluster.

## Configuration Model

### Cluster

A cluster describes how to scope kubectl access:

```ts
interface GenericK8sCluster {
  id: string;
  kubeconfigPath: string;
  context: string;
  defaultNamespace: string;
  allowedNamespaces: string[];
}
```

### Job Profile

A profile describes defaults for a class of Jobs:

```ts
interface K8sJobProfile {
  id: string;
  clusterId: string;
  namespace?: string;
  defaultImage?: string;
  imagePullSecrets?: string[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  env?: Array<{ name: string; value: string }>;
  resources?: {
    requests?: Record<string, string>;
    limits?: Record<string, string>;
  };
  volumes?: K8sJobVolume[];
  ttlSecondsAfterFinished?: number;
  backoffLimit?: number;
}
```

The initial config loader should support database and environment-backed values, plus an optional local private file such as `config/k8s-job-profiles.local.json`. The local private file must be ignored by git. The repository may include `config/k8s-job-profiles.example.json` with only generic placeholder values.

Existing legacy cluster-specific settings remain available for legacy tools, but new generic tools read the new model.

## Structured Job Spec

The agent-facing input is a restricted structure:

```ts
interface PrepareK8sJobInput {
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
```

The tool merges user input with profile defaults, validates the result, and generates a standard `batch/v1 Job`. The manifest builder owns the final Kubernetes object shape; the agent does not directly write arbitrary YAML.

## Tools

Add a new tool module under `src/lib/ai/tools/k8s-job-tools.ts`.

### `prepareK8sJob`

- Resolves the selected profile and cluster.
- Merges profile defaults and user input.
- Builds a vanilla `batch/v1 Job` manifest.
- Runs `kubectl apply --dry-run=client -f -`.
- Returns a manifest preview, review summary, and `jobSpecHash`.
- Records a cluster operation with status `success`, `error`, or `blocked`.

### `runK8sJob`

- Requires the same structured spec and the `jobSpecHash` returned by `prepareK8sJob`.
- Rebuilds the manifest server-side and rejects the request if the hash differs.
- Creates or applies the Job after explicit user confirmation.
- Records the submitted job name, namespace, status, and summarized output.

### `waitForK8sJob`

- Reads the Job as JSON.
- Lists Pods by `job-name=<jobName>`.
- Returns `complete`, `failed`, or `timeout`.
- Surfaces common Pod failure reasons such as image pull errors, container config errors, failed Pods, and unschedulable Pods.

### `collectK8sJobLogs`

- Finds the newest related Pod.
- Returns bounded log tail output.
- Optionally includes a short events summary for scheduling or image-pull failures.

### `cleanupK8sJob`

- Deletes only Jobs created by the generic InnoClaw tool path.
- Requires ownership labels to match before deletion.
- Records cleanup attempts and results.

All new tools belong in `K8S_TOOLS` and remain high-privilege opt-in capabilities.

## Executor Architecture

Create `src/lib/cluster/kubectl-executor.ts` as a shared wrapper around `kubectl`.

Responsibilities:

- Accept structured requests with `context`, `namespace`, `args`, `stdin`, and optional timeout.
- Inject `--kubeconfig`, `--context`, and `-n` based on resolved config.
- Reject scope override flags in user-controlled args, including `--kubeconfig`, `--context`, `--cluster`, `--server`, `--token`, `--namespace`, and `-n`.
- Provide `runText` and `runJson`.
- Normalize timeout, not-found, JSON parse, and generic execution failures.
- Truncate stdout and stderr to existing InnoClaw limits before returning to the agent.

This avoids ad hoc string-based kubectl construction in the agent tools.

## Manifest Builder

Create `src/lib/cluster/job-manifest.ts`.

The builder may generate:

- `apiVersion: batch/v1`
- `kind: Job`
- metadata name or generateName
- namespace
- safe labels and annotations
- `spec.ttlSecondsAfterFinished`
- `spec.backoffLimit`
- Pod template labels
- `restartPolicy: Never`
- one primary container
- image, command, args, env, resources
- imagePullSecrets from profile
- optional profile-defined volumes and volumeMounts

The builder must not generate cluster-specific scheduling fields in the first version:

- `schedulerName`
- `nodeSelector`
- `affinity`
- `tolerations`
- `priorityClassName`
- custom CRDs

The builder must never generate high-risk Pod settings:

- `privileged: true`
- `hostNetwork: true`
- `hostPID: true`
- `hostIPC: true`
- `hostPath` volumes

If future versions need these fields, they should be added as explicitly gated profile extensions with tests and documentation.

## Safety Model

### Scope Control

- Context comes from the resolved cluster config.
- Namespace comes from the request or profile, then must be in `allowedNamespaces`.
- Tool inputs cannot override kubeconfig, context, namespace, token, server, or impersonation settings through kubectl args.

### Confirmation Binding

`prepareK8sJob` returns a `jobSpecHash` computed from the normalized manifest and resolved execution scope. `runK8sJob` recomputes the hash and rejects submission when it does not match.

This prevents a user from approving one preview while the agent submits a different Job.

### Ownership

Generated Jobs include stable ownership labels:

```text
app.kubernetes.io/managed-by=innoclaw
innoclaw.ai/workspace-id=<workspaceId>
innoclaw.ai/job-hash=<jobSpecHash>
```

Cleanup and same-name replacement require these labels. Existing same-name Jobs without matching labels are treated as not owned and must not be modified or deleted.

### Auditing

Reuse `recordClusterOp` and the existing `cluster_operations` table. Record:

- tool name
- workspace id
- namespace
- job name
- status
- short summary
- sanitized input summary
- output metadata such as exit code, stdout length, status, and failure reason

Do not store kubeconfig contents, tokens, secrets, full private images, or raw large logs in audit records.

## Agent Workflow

The agent should use this sequence:

1. Determine whether the user's request is a Kubernetes Job scheduling request.
2. Select a profile or ask the user to choose one.
3. Ask for missing required fields such as image or command when neither the profile nor request provides them.
4. Call `prepareK8sJob`.
5. Show the preview summary and ask for explicit confirmation.
6. Call `runK8sJob` with the matching hash.
7. Call `waitForK8sJob`.
8. Call `collectK8sJobLogs` when the Job reaches a terminal state or fails early.
9. Offer cleanup when appropriate.

Prompt updates should describe the generic flow first. Legacy cluster-specific submit tools should be documented as legacy or environment-specific paths.

## Testing Strategy

Open-source CI must not require a real Kubernetes cluster.

Unit tests with mock executors should cover:

- profile loading and default merge behavior
- namespace allow-list enforcement
- image, job name, env, and resource validation
- manifest generation for CPU-only vanilla Jobs
- imagePullSecrets and resource defaults from profiles
- absence of forbidden Pod fields
- kubectl scope injection
- rejection of scope override flags
- prepare hash generation
- run hash mismatch rejection
- wait complete, failed, timeout, image-pull failure, config error, and unschedulable cases
- cleanup ownership checks
- audit record shape for prepare, run, wait, logs, and cleanup

Repository validation remains:

```bash
npm run lint
npm test
NEXT_TELEMETRY_DISABLED=1 npm run build
```

## Local Institution Smoke Test

The real cluster smoke test is local-only and uses a private profile.

Expected flow:

1. Configure `config/k8s-job-profiles.local.json` or equivalent local DB/env settings.
2. Run `prepareK8sJob` for a minimal command such as a Python or shell print command.
3. Confirm the dry-run succeeds.
4. Submit the Job with `runK8sJob`.
5. Wait for `complete`.
6. Collect logs and verify the expected output appears.
7. Clean up the Job or verify the configured TTL behavior.

The smoke test summary may record:

- profile id
- job name
- namespace
- terminal status
- bounded log tail
- cleanup result

The smoke test summary must not record:

- kubeconfig contents
- tokens
- secret values
- internal node names
- private cluster topology
- full private image paths unless explicitly redacted

## Migration Plan

First implementation:

- Add generic config/profile loader.
- Add executor, manifest builder, policy helpers, and generic Job tools.
- Register new tools in `K8S_TOOLS`.
- Update agent prompt text to prefer the generic workflow.
- Add tests and docs for the generic path.
- Add `.gitignore` coverage for local private profile files.

Legacy behavior:

- Keep existing `kubectl`, legacy `submitK8sJob`, and legacy `collectJobResults`.
- Do not break existing legacy cluster-specific users.
- Do not promote legacy cluster-specific defaults in open-source docs as the recommended path.

Later implementation:

- Migrate settings UI from hard-coded cluster sections to generic clusters/profiles.
- Consider a gated advanced raw manifest path only after the structured Job path is stable.
- Consider scheduler-specific adapters only as explicit optional extensions.

## Acceptance Criteria

- The open-source code path can generate and validate a vanilla `batch/v1 Job` without private assumptions.
- The agent can prepare, submit, wait for, collect logs from, and clean up a Job using structured inputs.
- Mutating actions are high-privilege, previewed, confirmation-bound, and audited.
- Unit tests prove scope controls, manifest safety, wait behavior, hash binding, and ownership checks.
- The feature can be real-tested on the local institution cluster using a gitignored private profile.
- No institution-specific cluster values are committed to code, docs, tests, examples, or audit fixtures.
