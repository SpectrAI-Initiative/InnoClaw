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
          limits: { cpu: "1", memory: "256Mi" },
        },
        ttlSecondsAfterFinished: 3600,
        backoffLimit: 0,
      },
      input: {
        profileId: "cpu-smoke",
        jobName: "smoke-test",
        command: ["python", "-c"],
        args: ["print('hello')"],
      },
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
          "innoclaw.ai/job-hash": "hash-1",
        },
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
                  limits: { cpu: "1", memory: "256Mi" },
                },
              },
            ],
          },
        },
      },
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
        defaultImage: "python:3.12",
      },
      input: {
        profileId: "cpu-smoke",
        generateName: "smoke-",
        command: ["python", "-c"],
        args: ["print('hello')"],
      },
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

  it("keeps the full job hash in annotations and a label-safe prefix in labels", () => {
    const fullHash = "a".repeat(64);
    const manifest = buildK8sJobManifest({
      workspaceId: null,
      jobSpecHash: fullHash,
      namespace: "default",
      profile: {
        id: "cpu-smoke",
        clusterId: "default",
        defaultImage: "python:3.12",
      },
      input: {
        profileId: "cpu-smoke",
        jobName: "smoke-test",
      },
    });

    expect(manifest.metadata.labels["innoclaw.ai/job-hash"]).toHaveLength(63);
    expect(manifest.metadata.annotations).toMatchObject({
      "innoclaw.ai/job-spec-hash": fullHash,
    });
    expect(manifest.spec.template.metadata.annotations).toMatchObject({
      "innoclaw.ai/job-spec-hash": fullHash,
    });
  });
});
