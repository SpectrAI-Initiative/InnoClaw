"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Server, Trash2 } from "lucide-react";
import { useRemoteProfiles } from "@/lib/hooks/use-remote-profiles";
import { toast } from "sonner";

interface RemoteProfileListProps {
  workspaceId: string;
}

export function RemoteProfileList({ workspaceId }: RemoteProfileListProps) {
  const t = useTranslations("researchExec");
  const { profiles, isLoading, mutate } = useRemoteProfiles(workspaceId);

  const handleDelete = async (id: string) => {
    try {
      await fetch(
        `/api/research-exec/profiles?id=${encodeURIComponent(id)}&workspaceId=${encodeURIComponent(workspaceId)}`,
        { method: "DELETE" },
      );
      mutate();
      toast.success(t("profileDeleted"));
    } catch {
      toast.error("Failed to delete profile");
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground p-4">{t("loading")}</p>;
  }

  if (profiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
        <Server className="h-8 w-8" />
        <p className="text-sm">{t("noProfiles")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {profiles.map((profile) => (
        <div
          key={profile.id}
          className="flex items-center gap-3 rounded-lg border p-3"
        >
          <Server className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{profile.name}</span>
              <Badge variant="outline" className="text-[10px]">
                {profile.schedulerType}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {profile.username}@{profile.host}:{profile.port} → {profile.remotePath}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive"
            onClick={() => handleDelete(profile.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
