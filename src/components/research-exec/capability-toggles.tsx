"use client";

import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { useResearchCapabilities } from "@/lib/hooks/use-research-capabilities";
import { CAPABILITY_KEYS, type CapabilityFlags } from "@/lib/research-exec/types";
import { toast } from "sonner";

interface CapabilityTogglesProps {
  workspaceId: string;
}

const CAPABILITY_META: Record<
  keyof CapabilityFlags,
  { labelKey: string; descKey: string; risk: "low" | "medium" | "high" }
> = {
  canReadCodebase: { labelKey: "capReadCodebase", descKey: "capReadCodebaseDesc", risk: "low" },
  canWriteCodebase: { labelKey: "capWriteCodebase", descKey: "capWriteCodebaseDesc", risk: "medium" },
  canUseLocalTerminal: { labelKey: "capLocalTerminal", descKey: "capLocalTerminalDesc", risk: "medium" },
  canUseSSH: { labelKey: "capSSH", descKey: "capSSHDesc", risk: "high" },
  canSyncRemote: { labelKey: "capSyncRemote", descKey: "capSyncRemoteDesc", risk: "medium" },
  canSubmitJobs: { labelKey: "capSubmitJobs", descKey: "capSubmitJobsDesc", risk: "high" },
  canCollectRemoteResults: { labelKey: "capCollectResults", descKey: "capCollectResultsDesc", risk: "medium" },
  canAutoApplyChanges: { labelKey: "capAutoApply", descKey: "capAutoApplyDesc", risk: "high" },
};

const riskColors = {
  low: "border-green-500/20 bg-green-500/15 text-green-700 dark:text-green-400",
  medium: "border-yellow-500/20 bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  high: "border-red-500/20 bg-red-500/15 text-red-700 dark:text-red-400",
};

export function CapabilityToggles({ workspaceId }: CapabilityTogglesProps) {
  const t = useTranslations("researchExec");
  const { capabilities, mutate } = useResearchCapabilities(workspaceId);

  const toggle = async (flag: keyof CapabilityFlags) => {
    const newValue = !capabilities[flag];
    try {
      await fetch("/api/research-exec/capabilities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, flag, value: newValue }),
      });
      mutate();
    } catch {
      toast.error("Failed to update capability");
    }
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <p className="text-xs text-muted-foreground">{t("capWarning")}</p>
      </div>
      {CAPABILITY_KEYS.map((key) => {
        const meta = CAPABILITY_META[key];
        return (
          <div
            key={key}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="flex-1 min-w-0 mr-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{t(meta.labelKey)}</span>
                <Badge className={`text-[10px] ${riskColors[meta.risk]}`}>
                  {meta.risk}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t(meta.descKey)}
              </p>
            </div>
            <Switch
              checked={capabilities[key]}
              onCheckedChange={() => toggle(key)}
            />
          </div>
        );
      })}
    </div>
  );
}
