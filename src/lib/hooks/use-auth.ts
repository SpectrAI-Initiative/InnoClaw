import useSWR from "swr";
import type { AuthMeResponse } from "@/types/auth";
import { fetcher } from "@/lib/fetcher";

export function useAuthUser() {
  const { data, error, isLoading, mutate } = useSWR<AuthMeResponse>(
    "/api/auth/me",
    fetcher,
  );

  return {
    user: data?.user ?? null,
    authMode: data?.authMode ?? "local",
    isAuthDisabled: data?.isAuthDisabled ?? false,
    isLoading,
    error,
    mutate,
  };
}
