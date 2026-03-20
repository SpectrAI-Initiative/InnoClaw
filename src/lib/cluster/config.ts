import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

/**
 * Full K8s cluster configuration resolved from the database first,
 * falling back to process.env, then to empty string.
 */
export interface K8sConfig {
  kubeconfigPath: string;
  submitter: string;
  imagePullSecret: string;
  mountUser: string;
  clusterContextMap: Record<string, string>;
  a3: {
    defaultImage: string;
    pvcAi4s: string;
    pvcUser: string;
    pvcAi4sA2: string;
  };
  muxi: {
    defaultImage: string;
    pvcAi4s: string;
    pvcUser: string;
    pvcAi4sA2: string;
  };
}

/**
 * Map from app_settings DB keys to the env-var names they correspond to.
 * This is the single source of truth for the key mapping.
 */
export const SETTINGS_TO_ENV: Record<string, string> = {
  kubeconfig_path: "KUBECONFIG_PATH",
  k8s_submitter: "K8S_SUBMITTER",
  k8s_image_pull_secret: "K8S_IMAGE_PULL_SECRET",
  k8s_mount_user: "K8S_MOUNT_USER",
  kubeconfig_context_a3: "KUBECONFIG_CONTEXT_A3",
  kubeconfig_context_muxi: "KUBECONFIG_CONTEXT_MUXI",
  k8s_pvc_ai4s: "K8S_PVC_AI4S",
  k8s_pvc_user: "K8S_PVC_USER",
  k8s_pvc_ai4s_a2: "K8S_PVC_AI4S_A2",
  k8s_muxi_default_image: "K8S_MUXI_DEFAULT_IMAGE",
  k8s_muxi_pvc_ai4s: "K8S_MUXI_PVC_AI4S",
  k8s_muxi_pvc_user: "K8S_MUXI_PVC_USER",
  k8s_muxi_pvc_ai4s_a2: "K8S_MUXI_PVC_AI4S_A2",
};

const ALL_SETTINGS_KEYS = Object.keys(SETTINGS_TO_ENV);

/**
 * Read a value: DB first, then process.env, then fallback.
 */
function resolve(
  dbMap: Record<string, string>,
  settingsKey: string,
  fallback = "",
): string {
  // DB value takes priority
  const dbVal = dbMap[settingsKey];
  if (dbVal !== undefined && dbVal !== "") return dbVal;
  // Then env var
  const envKey = SETTINGS_TO_ENV[settingsKey];
  const envVal = envKey ? process.env[envKey] : undefined;
  if (envVal !== undefined && envVal !== "") return envVal;
  return fallback;
}

/** Simple TTL cache for K8s config to avoid repeated DB queries within the same request cycle. */
let cachedConfig: K8sConfig | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 10_000; // 10 seconds

/**
 * Load K8s configuration from the database (primary) with process.env fallback.
 * Results are cached for 10s to avoid repeated DB hits on the same request.
 * This is the single entry point all cluster-related code should use.
 */
export async function getK8sConfig(): Promise<K8sConfig> {
  const now = Date.now();
  if (cachedConfig && now < cacheExpiry) return cachedConfig;

  // Batch-read all K8s-related keys from DB in one query
  const rows = await db
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, ALL_SETTINGS_KEYS));

  const dbMap: Record<string, string> = {};
  for (const r of rows) {
    dbMap[r.key] = r.value;
  }

  const submitter = resolve(dbMap, "k8s_submitter");

  const config: K8sConfig = {
    kubeconfigPath: resolve(dbMap, "kubeconfig_path"),
    submitter,
    imagePullSecret: resolve(dbMap, "k8s_image_pull_secret") || submitter,
    mountUser: resolve(dbMap, "k8s_mount_user") || submitter,
    clusterContextMap: {
      a3: resolve(dbMap, "kubeconfig_context_a3"),
      muxi: resolve(dbMap, "kubeconfig_context_muxi"),
    },
    a3: {
      defaultImage: "registry2.d.pjlab.org.cn/ccr-hw/910c:82rc2ipc",
      pvcAi4s: resolve(dbMap, "k8s_pvc_ai4s"),
      pvcUser: resolve(dbMap, "k8s_pvc_user"),
      pvcAi4sA2: resolve(dbMap, "k8s_pvc_ai4s_a2"),
    },
    muxi: {
      defaultImage: resolve(dbMap, "k8s_muxi_default_image")
        || "registry2.d.pjlab.org.cn/ccr-ailabdev/mace-maca:3.3.0.5-ubuntu22.04-amd64-driver",
      pvcAi4s: resolve(dbMap, "k8s_muxi_pvc_ai4s"),
      pvcUser: resolve(dbMap, "k8s_muxi_pvc_user"),
      pvcAi4sA2: resolve(dbMap, "k8s_muxi_pvc_ai4s_a2"),
    },
  };

  cachedConfig = config;
  cacheExpiry = now + CACHE_TTL_MS;
  return config;
}

/** Invalidate the cached config (call after settings are updated). */
export function invalidateK8sConfigCache(): void {
  cachedConfig = null;
  cacheExpiry = 0;
}
