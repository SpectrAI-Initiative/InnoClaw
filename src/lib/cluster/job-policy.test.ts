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
        args: ["print('hello')"],
      }),
    ).not.toThrow();
  });

  it("rejects both jobName and generateName", () => {
    expect(() =>
      validateK8sJobInput({
        profileId: "cpu-smoke",
        jobName: "smoke-test",
        generateName: "smoke-",
        image: "python:3.12",
      }),
    ).toThrow(/Only one of jobName or generateName/);
  });
});

describe("computeK8sJobSpecHash", () => {
  it("is stable for equivalent normalized objects", () => {
    const left = computeK8sJobSpecHash({
      scope: { context: "ctx", namespace: "default" },
      manifest: { b: 2, a: 1 },
    });
    const right = computeK8sJobSpecHash({
      manifest: { a: 1, b: 2 },
      scope: { namespace: "default", context: "ctx" },
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
              "innoclaw.ai/job-hash": "hash-1".slice(0, 63),
            },
            annotations: {
              "innoclaw.ai/job-spec-hash": "hash-1",
            },
          },
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

  it("rejects resources without a matching full hash annotation", () => {
    expect(() =>
      ensureOwnedK8sJob(
        {
          metadata: {
            labels: {
              "app.kubernetes.io/managed-by": "innoclaw",
              "innoclaw.ai/job-hash": "a".repeat(63),
            },
            annotations: {
              "innoclaw.ai/job-spec-hash": "b".repeat(64),
            },
          },
        },
        "a".repeat(64),
      ),
    ).toThrow(/hash does not match/);
  });
});

describe("normalizeK8sJobInput", () => {
  it("removes undefined fields before hashing", () => {
    expect(
      normalizeK8sJobInput({
        profileId: "cpu-smoke",
        jobName: "smoke-test",
        image: undefined,
        env: [],
      }),
    ).toEqual({
      profileId: "cpu-smoke",
      jobName: "smoke-test",
      env: [],
    });
  });
});
