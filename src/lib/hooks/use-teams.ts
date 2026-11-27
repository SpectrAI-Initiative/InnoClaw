import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { Team, TeamDetail } from "@/types";

export function useTeams() {
  const { data, error, isLoading, mutate } = useSWR<Team[]>("/api/teams", fetcher);
  return {
    teams: Array.isArray(data) ? data : [],
    isLoading,
    error,
    mutate,
  };
}

export function useTeamDetail(teamId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<TeamDetail>(
    teamId ? `/api/teams/${teamId}` : null,
    fetcher
  );
  return { team: data, isLoading, error, mutate };
}
