import fsp from "fs/promises";
import path from "path";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";

const envVarSchema = z
  .object({
    name: z.string().min(1),
    value: z.string(),
  })
  .strict();

const resourceRequirementsSchema = z
  .object({
    requests: z.record(z.string().min(1), z.string().min(1)).optional(),
    limits: z.record(z.string().min(1), z.string().min(1)).optional(),
  })
  .strict();

export const k8sJobVolumeSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("emptyDir"),
      name: z.string().min(1),
      mountPath: z.string().min(1),
      medium: z.enum(["Memory"]).optional(),
      sizeLimit: z.string().min(1).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("persistentVolumeClaim"),
      name: z.string().min(1),
      mountPath: z.string().min(1),
      claimName: z.string().min(1),
      readOnly: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("configMap"),
      name: z.string().min(1),
      mountPath: z.string().min(1),
      configMapName: z.string().min(1),
      readOnly: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("secret"),
      name: z.string().min(1),
      mountPath: z.string().min(1),
      secretName: z.string().min(1),
      readOnly: z.boolean().optional(),
    })
    .strict(),
]);

export const genericK8sClusterSchema = z
  .object({
    id: z.string().min(1),
    kubeconfigPath: z.string().min(1),
    context: z.string().min(1),
    defaultNamespace: z.string().min(1),
    allowedNamespaces: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const k8sJobProfileSchema = z
  .object({
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
  })
  .strict();

export const k8sJobConfigSchema = z
  .object({
    clusters: z.array(genericK8sClusterSchema),
    profiles: z.array(k8sJobProfileSchema),
  })
  .strict();

export type GenericK8sCluster = z.infer<typeof genericK8sClusterSchema>;
export type K8sJobConfig = z.infer<typeof k8sJobConfigSchema>;
export type K8sJobProfile = z.infer<typeof k8sJobProfileSchema>;
export type K8sJobVolume = z.infer<typeof k8sJobVolumeSchema>;

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
  try {
    const rows = await db
      .select()
      .from(appSettings)
      .where(inArray(appSettings.key, [...SETTINGS_KEYS]));
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("no such table: app_settings")
    ) {
      return {};
    }
    throw error;
  }
}

function readJsonConfig(settings: Record<string, string>): K8sJobConfig | null {
  const raw = settings.k8s_job_profiles_json || process.env.K8S_JOB_PROFILES_JSON;
  if (!raw) return null;
  return k8sJobConfigSchema.parse(JSON.parse(raw));
}

function resolveConfigFilePath(
  settings: Record<string, string>,
): string | undefined {
  return (
    settings.k8s_job_profiles_file ||
    process.env.K8S_JOB_PROFILES_FILE ||
    undefined
  );
}

async function readFileConfig(
  settings: Record<string, string>,
): Promise<K8sJobConfig | null> {
  const configuredPath = resolveConfigFilePath(settings);
  if (!configuredPath) return null;
  const absolutePath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);
  const raw = await fsp.readFile(absolutePath, "utf8");
  return k8sJobConfigSchema.parse(JSON.parse(raw));
}

function readEnvConfig(): K8sJobConfig | null {
  const kubeconfigPath = process.env.KUBECONFIG_PATH;
  const context = process.env.K8S_CONTEXT;
  if (!kubeconfigPath || !context) return null;

  const clusterId = process.env.K8S_CLUSTER_ID || "default";
  const defaultNamespace = process.env.K8S_DEFAULT_NAMESPACE || "default";
  const allowedNamespaces = parseCsv(process.env.K8S_ALLOWED_NAMESPACES);
  const namespaceAllowList =
    allowedNamespaces.length > 0 ? allowedNamespaces : [defaultNamespace];

  return {
    clusters: [
      {
        id: clusterId,
        kubeconfigPath,
        context,
        defaultNamespace,
        allowedNamespaces: namespaceAllowList,
      },
    ],
    profiles: [
      {
        id: process.env.K8S_JOB_PROFILE_ID || "default",
        clusterId,
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
  if (!profile) {
    throw new Error(`K8s job profile not found: ${profileId}`);
  }

  const cluster = config.clusters.find((item) => item.id === profile.clusterId);
  if (!cluster) {
    throw new Error(
      `K8s job profile references missing cluster: ${profile.clusterId}`,
    );
  }

  const namespace =
    namespaceOverride ?? profile.namespace ?? cluster.defaultNamespace;
  if (!cluster.allowedNamespaces.includes(namespace)) {
    throw new Error(`Namespace is not allowed for profile ${profileId}: ${namespace}`);
  }

  return { cluster, profile, namespace };
}
