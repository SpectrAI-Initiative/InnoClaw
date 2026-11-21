import { readEnvLocal } from "@/lib/env-file";
import type { ProviderId } from "./models";

const PER_MODEL_BASE_URL_PROVIDERS = new Set<ProviderId>(["deepseek"]);

export function isPerModelBaseUrlProvider(
  providerId: string,
): providerId is ProviderId {
  return PER_MODEL_BASE_URL_PROVIDERS.has(providerId as ProviderId);
}

export function getApiKeyEnvKey(providerId: string): string {
  return `${providerId.toUpperCase()}_API_KEY`;
}

export function getVendorBaseUrlEnvKey(providerId: string): string {
  return `${providerId.toUpperCase()}_BASE_URL`;
}

export function toModelEnvSegment(modelId: string): string {
  return modelId
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getPerModelBaseUrlEnvKey(
  providerId: string,
  modelId: string,
): string {
  return `${providerId.toUpperCase()}_${toModelEnvSegment(modelId)}_BASE_URL`;
}

/**
 * Merge the current process environment with the latest `.env.local` contents.
 * `.env.local` wins so manual edits are visible without restarting the server.
 */
export function getCurrentEnv(): Record<string, string | undefined> {
  return {
    ...process.env,
    ...readEnvLocal(),
  };
}

export function getDiscoveredPerModelBaseUrls(
  providerId: string,
  env: Record<string, string | undefined> = getCurrentEnv(),
): Array<{ envKey: string; baseUrl: string }> {
  if (!isPerModelBaseUrlProvider(providerId)) {
    return [];
  }

  const prefix = `${providerId.toUpperCase()}_`;
  const vendorKey = getVendorBaseUrlEnvKey(providerId);

  return Object.entries(env)
    .filter(([key, value]) => {
      return (
        key.startsWith(prefix) &&
        key.endsWith("_BASE_URL") &&
        key !== vendorKey &&
        typeof value === "string" &&
        value.trim().length > 0
      );
    })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([envKey, baseUrl]) => ({
      envKey,
      baseUrl: (baseUrl ?? "").trim(),
    }));
}
