"use client";

import { useEffect, useState } from "react";
import { WelcomeScreen } from "@/components/shell/welcome-screen";
import { normalizeWorkspaceBrowseSettings, type WorkspaceBrowseSettingsResponse } from "@/lib/workspace-settings";

export default function HomePage() {
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

  return <WelcomeScreen workspaceRoots={roots} />;
}
