"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useScheduledTasks } from "@/lib/hooks/use-scheduled-tasks";
import { useWorkspaces } from "@/lib/hooks/use-workspaces";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ScheduledTask } from "@/types";

const TASK_TYPES = [
  "daily_report",
  "weekly_report",
  "git_sync",
  "source_sync",
  "custom",
] as const;

export function ScheduledTasksCard() {
  const t = useTranslations("scheduledTasks");
  const tCommon = useTranslations("common");
  const { tasks, mutate } = useScheduledTasks();
  const { workspaces } = useWorkspaces();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [taskType, setTaskType] = useState<string>("daily_report");
  const [schedule, setSchedule] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string>("__all__");
  const [isEnabled, setIsEnabled] = useState(true);

  function openCreateDialog() {
    setEditingTask(null);
    setName("");
    setTaskType("daily_report");
    setSchedule("");
    setWorkspaceId("__all__");
    setIsEnabled(true);
    setDialogOpen(true);
  }

  function openEditDialog(task: ScheduledTask) {
    setEditingTask(task);
    setName(task.name);
    setTaskType(task.taskType);
    setSchedule(task.schedule);
    setWorkspaceId(task.workspaceId || "__all__");
    setIsEnabled(task.isEnabled);
    setDialogOpen(true);
  }

  async function handleSave() {
    const payload = {
      name,
      taskType,
      schedule,
      workspaceId: workspaceId === "__all__" ? null : workspaceId,
      isEnabled,
    };

    try {
      if (editingTask) {
        const res = await fetch(`/api/scheduled-tasks/${editingTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error || tCommon("error"));
          return;
        }
        toast.success(t("updateSuccess"));
      } else {
        const res = await fetch("/api/scheduled-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error || tCommon("error"));
          return;
        }
        toast.success(t("createSuccess"));
      }
      setDialogOpen(false);
      mutate();
    } catch {
      toast.error(tCommon("error"));
    }
  }

  async function handleToggle(task: ScheduledTask) {
    try {
      const res = await fetch(`/api/scheduled-tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !task.isEnabled }),
      });
      if (!res.ok) {
        toast.error(tCommon("error"));
        return;
      }
      mutate();
    } catch {
      toast.error(tCommon("error"));
    }
  }

  async function handleDelete(task: ScheduledTask) {
    if (!confirm(t("deleteConfirm"))) return;
    try {
      const res = await fetch(`/api/scheduled-tasks/${task.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(tCommon("error"));
        return;
      }
      toast.success(t("deleteSuccess"));
      mutate();
    } catch {
      toast.error(tCommon("error"));
    }
  }

  function renderStatusBadge(task: ScheduledTask) {
    if (!task.lastRunStatus) return null;
    const variant =
      task.lastRunStatus === "success"
        ? "default"
        : task.lastRunStatus === "error"
          ? "destructive"
          : "secondary";
    const label =
      task.lastRunStatus === "success"
        ? t("statusSuccess")
        : task.lastRunStatus === "error"
          ? t("statusError")
          : t("statusRunning");
    return <Badge variant={variant}>{label}</Badge>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("title")}</CardTitle>
              <CardDescription>{t("description")}</CardDescription>
            </div>
            <Button size="sm" onClick={openCreateDialog}>
              {t("create")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noTasks")}</p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {task.name}
                      </span>
                      <Badge variant="outline">
                        {t(`taskTypes.${task.taskType}` as Parameters<typeof t>[0])}
                      </Badge>
                      <Badge variant={task.isEnabled ? "default" : "secondary"}>
                        {task.isEnabled ? t("enabledLabel") : t("disabledLabel")}
                      </Badge>
                      {renderStatusBadge(task)}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {task.schedule}
                    </div>
                    {task.lastRunAt && (
                      <div className="text-xs text-muted-foreground">
                        {t("lastRun")}: {new Date(task.lastRunAt).toLocaleString()}
                      </div>
                    )}
                    {task.lastRunError && (
                      <div className="text-xs text-red-500 truncate">
                        {task.lastRunError}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(task)}
                    >
                      {task.isEnabled ? t("disabledLabel") : t("enabledLabel")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(task)}
                    >
                      {tCommon("edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(task)}
                    >
                      {tCommon("delete")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTask ? t("edit") : t("create")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{t("name")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("taskType")}</Label>
              <Select value={taskType} onValueChange={setTaskType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((tt) => (
                    <SelectItem key={tt} value={tt}>
                      {t(`taskTypes.${tt}` as Parameters<typeof t>[0])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("schedule")}</Label>
              <Input
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder={t("schedulePlaceholder")}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">{t("cronHelp")}</p>
            </div>

            <div className="space-y-2">
              <Label>{t("workspaceOptional")}</Label>
              <Select value={workspaceId} onValueChange={setWorkspaceId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">
                    {t("allWorkspaces")}
                  </SelectItem>
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {tCommon("cancel")}
              </Button>
              <Button onClick={handleSave}>{tCommon("save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
