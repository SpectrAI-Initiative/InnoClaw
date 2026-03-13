import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { CapabilityFlags } from "@/lib/research-exec/types";
import { DEFAULT_CAPABILITIES } from "@/lib/research-exec/types";

export function useResearchCapabilities(workspaceId: string | undefined) {
  const url = workspaceId
    ? `/api/research-exec/capabilities?workspaceId=${encodeURIComponent(workspaceId)}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<CapabilityFlags>(url, fetcher);

  return {
    capabilities: data ?? DEFAULT_CAPABILITIES,
    isLoading,
    error,
    mutate,
  };
}
