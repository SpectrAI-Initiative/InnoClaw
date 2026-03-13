"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Server, FlaskConical, History } from "lucide-react";
import { CapabilityToggles } from "./capability-toggles";
import { RemoteProfileForm } from "./remote-profile-form";
import { RemoteProfileList } from "./remote-profile-list";
import { ExperimentWorkflow } from "./experiment-workflow";
import { RunHistory } from "./run-history";
import { useRemoteProfiles } from "@/lib/hooks/use-remote-profiles";

interface ResearchExecPanelProps {
  workspaceId: string;
}

export function ResearchExecPanel({ workspaceId }: ResearchExecPanelProps) {
  const t = useTranslations("researchExec");
  const [activeTab, setActiveTab] = useState("workflow");
  const { mutate: refreshProfiles } = useRemoteProfiles(workspaceId);

  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      {/* Tab bar */}
      <div className="flex items-center border-b px-4 py-2">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList variant="line">
            <TabsTrigger value="workflow" className="text-sm">
              <FlaskConical className="mr-1 h-3.5 w-3.5" />
              {t("tabWorkflow")}
            </TabsTrigger>
            <TabsTrigger value="profiles" className="text-sm">
              <Server className="mr-1 h-3.5 w-3.5" />
              {t("tabProfiles")}
            </TabsTrigger>
            <TabsTrigger value="capabilities" className="text-sm">
              <Shield className="mr-1 h-3.5 w-3.5" />
              {t("tabCapabilities")}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-sm">
              <History className="mr-1 h-3.5 w-3.5" />
              {t("tabHistory")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "workflow" && (
          <ExperimentWorkflow currentStageIndex={0} status="idle" />
        )}

        {activeTab === "profiles" && (
          <ScrollArea className="h-full">
            <RemoteProfileList workspaceId={workspaceId} />
            <div className="px-4 pb-4">
              <RemoteProfileForm
                workspaceId={workspaceId}
                onCreated={() => refreshProfiles()}
              />
            </div>
          </ScrollArea>
        )}

        {activeTab === "capabilities" && (
          <ScrollArea className="h-full">
            <CapabilityToggles workspaceId={workspaceId} />
          </ScrollArea>
        )}

        {activeTab === "history" && (
          <RunHistory workspaceId={workspaceId} />
        )}
      </div>
    </div>
  );
}
