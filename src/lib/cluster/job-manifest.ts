import type { K8sJobProfile, K8sJobVolume } from "./job-profiles";
import {
  INNOCLAW_JOB_HASH_ANNOTATION,
  INNOCLAW_JOB_HASH_LABEL,
  INNOCLAW_MANAGED_BY_LABEL,
  INNOCLAW_WORKSPACE_LABEL,
  toK8sLabelValue,
  type K8sJobToolInput,
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
    return {
      name: volume.name,
      configMap: { name: volume.configMapName },
    };
  }
  return {
    name: volume.name,
    secret: { secretName: volume.secretName },
  };
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
  if (!image) {
    throw new Error("image is required by input or profile");
  }

  const labels = {
    ...(options.profile.labels ?? {}),
    [INNOCLAW_MANAGED_BY_LABEL]: "innoclaw",
    ...(options.workspaceId
      ? { [INNOCLAW_WORKSPACE_LABEL]: options.workspaceId }
      : {}),
    [INNOCLAW_JOB_HASH_LABEL]: toK8sLabelValue(options.jobSpecHash),
  };
  const annotations = {
    ...(options.profile.annotations ?? {}),
    [INNOCLAW_JOB_HASH_ANNOTATION]: options.jobSpecHash,
  };
  const env = [...(options.profile.env ?? []), ...(options.input.env ?? [])];
  const volumes = options.profile.volumes ?? [];
  const ttlSecondsAfterFinished =
    options.input.ttlSecondsAfterFinished ??
    options.profile.ttlSecondsAfterFinished;
  const backoffLimit = options.input.backoffLimit ?? options.profile.backoffLimit;
  const resources = options.input.resources ?? options.profile.resources;

  return {
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: {
      ...(options.input.jobName ? { name: options.input.jobName } : {}),
      ...(options.input.generateName ? { generateName: options.input.generateName } : {}),
      namespace: options.namespace,
      labels,
      annotations,
    },
    spec: {
      ...(ttlSecondsAfterFinished !== undefined
        ? { ttlSecondsAfterFinished }
        : {}),
      ...(backoffLimit !== undefined ? { backoffLimit } : {}),
      template: {
        metadata: {
          labels,
          annotations: { [INNOCLAW_JOB_HASH_ANNOTATION]: options.jobSpecHash },
        },
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
              ...(env.length ? { env } : {}),
              ...(resources ? { resources } : {}),
              ...(volumes.length
                ? { volumeMounts: volumes.map(buildVolumeMount) }
                : {}),
            },
          ],
        },
      },
    },
  };
}

export function summarizeK8sJobManifest(
  manifest: ReturnType<typeof buildK8sJobManifest>,
) {
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
      manifest.spec.template.spec.imagePullSecrets?.map((item) => item.name) ??
      [],
  };
}
