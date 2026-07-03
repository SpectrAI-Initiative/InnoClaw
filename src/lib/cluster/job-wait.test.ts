import { describe, expect, it, vi } from "vitest";
import {
  collectK8sJobLogs,
  resolvePodFailure,
  waitForK8sJob,
} from "./job-wait";

describe("resolvePodFailure", () => {
  it("surfaces image pull failures", () => {
    expect(
      resolvePodFailure({
        metadata: { name: "job-abc" },
        status: {
          containerStatuses: [
            {
              state: {
                waiting: {
                  reason: "ImagePullBackOff",
                  message: "pull failed",
                },
              },
            },
          ],
        },
      }),
    ).toEqual({
      podName: "job-abc",
      failureReason: "ImagePullBackOff",
      failureMessage: "pull failed",
    });
  });
});

describe("waitForK8sJob", () => {
  it("returns complete when the Job has a Complete condition", async () => {
    const executor = {
      runJson: vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            metadata: { name: "smoke-test", namespace: "default" },
            status: {
              conditions: [{ type: "Complete", status: "True" }],
              succeeded: 1,
            },
          },
        })
        .mockResolvedValueOnce({ data: { items: [] } }),
    };

    await expect(
      waitForK8sJob({
        executor: executor as never,
        scope: {
          kubeconfigPath: "/tmp/kubeconfig",
          context: "ctx",
          namespace: "default",
        },
        jobName: "smoke-test",
        timeoutSeconds: 5,
        pollIntervalSeconds: 1,
        sleep: async () => undefined,
        now: () => 0,
      }),
    ).resolves.toMatchObject({
      status: "complete",
      job: { name: "smoke-test", succeeded: 1 },
    });
  });

  it("returns timeout when the Job does not become terminal", async () => {
    let currentTime = 0;
    const executor = {
      runJson: vi.fn().mockResolvedValue({
        data: {
          metadata: { name: "smoke-test" },
          status: { active: 1 },
        },
      }),
    };

    const result = await waitForK8sJob({
      executor: executor as never,
      scope: {
        kubeconfigPath: "/tmp/kubeconfig",
        context: "ctx",
        namespace: "default",
      },
      jobName: "smoke-test",
      timeoutSeconds: 2,
      pollIntervalSeconds: 1,
      sleep: async (ms) => {
        currentTime += ms;
      },
      now: () => currentTime,
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
            {
              metadata: {
                name: "old",
                creationTimestamp: "2026-01-01T00:00:00Z",
              },
            },
            {
              metadata: {
                name: "new",
                creationTimestamp: "2026-01-01T00:01:00Z",
              },
            },
          ],
        },
      }),
      runText: vi.fn().mockResolvedValue({ data: "hello\n" }),
    };

    await expect(
      collectK8sJobLogs({
        executor: executor as never,
        scope: {
          kubeconfigPath: "/tmp/kubeconfig",
          context: "ctx",
          namespace: "default",
        },
        jobName: "smoke-test",
        tailLines: 50,
      }),
    ).resolves.toMatchObject({
      podName: "new",
      logs: "hello\n",
    });
  });
});
