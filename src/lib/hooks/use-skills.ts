import useSWR from "swr";
import type { Skill } from "@/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useSkills(workspaceId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Skill[]>(
    workspaceId ? `/api/skills?workspaceId=${encodeURIComponent(workspaceId)}` : `/api/skills`,
    fetcher
  );

  return {
    skills: data || [],
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
