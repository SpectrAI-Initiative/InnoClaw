import useSWR from "swr";
import type { PublicUser } from "@/types/auth";
import { fetcher } from "@/lib/fetcher";

export function useAuthUser() {
  const { data, error, isLoading, mutate } = useSWR<{ user: PublicUser }>(
    "/api/auth/me",
    fetcher,
  );

  return {
    user: data?.user ?? null,
    isLoading,
    error,
    mutate,
  };
}
