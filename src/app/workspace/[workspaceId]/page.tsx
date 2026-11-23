"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useTranslations } from "next-intl";
import { WorkspaceScreen } from "@/components/shell/workspace-screen";
import { useWorkspace } from "@/lib/hooks/use-workspaces";
import { normalizeWorkspaceBrowseSettings, type WorkspaceBrowseSettingsResponse } from "@/lib/workspace-settings";

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const t = useTranslations("shell");
  const { workspace, isLoading } = useWorkspace(workspaceId);
  const [roots, setRoots] = useState<string[]>([]);

  useEffect(() => {
    let canceled = false;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data: WorkspaceBrowseSettingsResponse) => {
        if (!canceled) setRoots(normalizeWorkspaceBrowseSettings(data).workspaceRoots);
      })
      .catch(() => {
        if (!canceled) setRoots([]);
      });
    return () => {
      canceled = true;
    };
  }, []);

  if (isLoading) {
    return <main className="grid h-screen place-items-center text-sm text-[#8A8A92]">{t("loading")}</main>;
  }

  if (!workspace) {
    return <main className="grid h-screen place-items-center text-sm text-[#8A8A92]">{t("workspaceMissing")}</main>;
  }

  return <WorkspaceScreen workspace={workspace} workspaceRoots={roots} />;
}
