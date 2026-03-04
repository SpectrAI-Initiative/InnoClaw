import useSWR from "swr";
import type { Skill } from "@/types";
import { fetcher } from "@/lib/fetcher";

export function useSkills(workspaceId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Skill[]>(
    workspaceId ? `/api/skills?workspaceId=${encodeURIComponent(workspaceId)}` : `/api/skills`,
    fetcher
  );

  return {
    skills: Array.isArray(data) ? data : [],
    isLoading,
    error,
    mutate,
  };
}

export function useSkill(skillId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Skill>(
    skillId ? `/api/skills/${skillId}` : null,
    fetcher
  );

  return {
    skill: data,
    isLoading,
    error,
    mutate,
  };
}
