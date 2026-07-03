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
            allowedNamespaces: ["default", "experiments"],
          },
        ],
        profiles: [
          {
            id: "cpu-smoke",
            clusterId: "local",
            namespace: "experiments",
            defaultImage: "python:3.12",
            resources: {
              requests: { cpu: "1", memory: "256Mi" },
              limits: { cpu: "1", memory: "256Mi" },
            },
            ttlSecondsAfterFinished: 3600,
          },
        ],
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
          allowedNamespaces: ["default", "experiments"],
        },
      ],
      profiles: [
        {
          id: "cpu-smoke",
          clusterId: "local",
          namespace: "experiments",
          defaultImage: "python:3.12",
        },
      ],
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
          allowedNamespaces: ["default", "experiments"],
        },
      ],
      profiles: [
        {
          id: "default",
          clusterId: "default",
          namespace: "default",
          defaultImage: "python:3.12",
        },
      ],
    });
  });

  it("returns empty config when generic K8s job settings are absent", async () => {
    await expect(getK8sJobConfig()).resolves.toEqual({
      clusters: [],
      profiles: [],
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
        allowedNamespaces: ["default", "experiments"],
      },
    ],
    profiles: [
      {
        id: "cpu-smoke",
        clusterId: "local",
        namespace: "experiments",
        defaultImage: "python:3.12",
      },
    ],
  };

  it("resolves cluster, profile, and namespace", () => {
    expect(resolveK8sJobProfile(config, "cpu-smoke")).toMatchObject({
      cluster: { id: "local", context: "kind-local" },
      profile: { id: "cpu-smoke" },
      namespace: "experiments",
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
