"use client";

import { useMemo } from "react";
import type { DeepResearchNode } from "@/lib/deep-research/types";
import { Badge } from "@/components/ui/badge";
import {
  getNodeDisplayLabel,
  getStructuredRoleDisplayName,
  getRoleColorToken,
} from "@/lib/deep-research/role-registry";
import {
  Activity,
  BookOpen,
  Brain,
  CheckCircle,
  ClipboardList,
  Eye,
  FileText,
  Filter,
  FolderDown,
  GitCompare,
  Play,
  Search,
  Send,
  Server,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

interface WorkflowGraphProps {
  nodes: DeepResearchNode[];
  onNodeSelect: (nodeId: string) => void;
}

const NODE_ICONS: Record<string, React.ElementType> = {
  intake: BookOpen,
  plan: Brain,
  evidence_gather: Search,
  evidence_extract: Filter,
  summarize: FileText,
  synthesize: Sparkles,
  review: Eye,
  audit: ShieldCheck,
  validation_plan: ClipboardList,
  resource_request: Server,
  execute: Play,
  monitor: Activity,
  result_collect: FolderDown,
  result_compare: GitCompare,
  approve: CheckCircle,
  final_report: FileText,
};

const STATUS_STYLES: Record<string, { dot: string; badge: string; line: string }> = {
  pending: {
    dot: "bg-slate-400 ring-slate-200",
    badge: "border-slate-300 bg-slate-50 text-slate-700",
    line: "bg-slate-300",
  },
  queued: {
    dot: "bg-stone-500 ring-stone-200",
    badge: "border-stone-300 bg-stone-50 text-stone-700",
    line: "bg-stone-300",
  },
  running: {
    dot: "bg-sky-500 ring-sky-200",
    badge: "border-sky-300 bg-sky-50 text-sky-700",
    line: "bg-sky-300",
  },
  completed: {
    dot: "bg-emerald-500 ring-emerald-200",
    badge: "border-emerald-300 bg-emerald-50 text-emerald-700",
    line: "bg-emerald-300",
  },
  failed: {
    dot: "bg-rose-500 ring-rose-200",
    badge: "border-rose-300 bg-rose-50 text-rose-700",
    line: "bg-rose-300",
  },
  skipped: {
    dot: "bg-zinc-400 ring-zinc-200",
    badge: "border-zinc-300 bg-zinc-50 text-zinc-700",
    line: "bg-zinc-300",
  },
  awaiting_approval: {
    dot: "bg-amber-500 ring-amber-200",
    badge: "border-amber-300 bg-amber-50 text-amber-700",
    line: "bg-amber-300",
  },
  awaiting_user_confirmation: {
    dot: "bg-orange-500 ring-orange-200",
    badge: "border-orange-300 bg-orange-50 text-orange-700",
    line: "bg-orange-300",
  },
  superseded: {
    dot: "bg-zinc-300 ring-zinc-100",
    badge: "border-zinc-200 bg-zinc-50 text-zinc-500",
    line: "bg-zinc-200",
  },
};

type RoadmapItem = {
  node: DeepResearchNode;
  dependsLabels: string[];
  childCount: number;
  createdLabel: string;
};

export function WorkflowGraph({ nodes, onNodeSelect }: WorkflowGraphProps) {
  const roadmap = useMemo(() => buildRoadmapItems(nodes), [nodes]);

  if (roadmap.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No roadmap items yet. Start the research to see the execution trail.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-[linear-gradient(180deg,rgba(15,23,42,0.02),transparent_24%)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 p-4">
        <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Roadmap</div>
              <p className="mt-1 text-xs text-muted-foreground">
                A GitLens-style execution trail for this deep research session. Select any node to inspect its messages,
                artifacts, and execution history.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {roadmap.length} node{roadmap.length === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-background/90 shadow-sm">
          {roadmap.map((item, index) => (
            <RoadmapRow
              key={item.node.id}
              item={item}
              isFirst={index === 0}
              isLast={index === roadmap.length - 1}
              onSelect={onNodeSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RoadmapRow({
  item,
  isFirst,
  isLast,
  onSelect,
}: {
  item: RoadmapItem;
  isFirst: boolean;
  isLast: boolean;
  onSelect: (nodeId: string) => void;
}) {
  const { node, dependsLabels, childCount, createdLabel } = item;
  const Icon = NODE_ICONS[node.nodeType] || Brain;
  const styles = STATUS_STYLES[node.status] ?? STATUS_STYLES.pending;
  const assignedRoleLabel = getStructuredRoleDisplayName(node.assignedRole, node.nodeType);

  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      className="group flex w-full items-stretch gap-0 text-left transition-colors hover:bg-muted/30"
    >
      <div className="relative flex w-20 shrink-0 items-center justify-center">
        {!isFirst && <div className={`absolute left-1/2 top-0 h-1/2 w-px -translate-x-1/2 ${styles.line}`} />}
        {!isLast && <div className={`absolute left-1/2 bottom-0 h-1/2 w-px -translate-x-1/2 ${styles.line}`} />}
        <div className={`relative z-10 h-3.5 w-3.5 rounded-full ring-4 ${styles.dot} ${node.status === "running" ? "animate-pulse" : ""}`} />
        {node.dependsOn.length > 0 && (
          <div className="absolute left-[calc(50%+10px)] top-1/2 h-px w-4 -translate-y-1/2 bg-border/80" />
        )}
      </div>

      <div className={`flex-1 border-l border-border/60 px-4 py-3 ${isLast ? "" : "border-b"} border-border/60`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className={`truncate text-sm font-semibold ${node.status === "superseded" ? "line-through text-muted-foreground" : ""}`}>
                {getNodeDisplayLabel(node.label)}
              </span>
              <Badge variant="outline" className={`text-[10px] ${styles.badge}`}>
                {node.status.replaceAll("_", " ")}
              </Badge>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge className={`text-[10px] ${getRoleColorToken(node.assignedRole, node.nodeType)}`}>
                {assignedRoleLabel}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono">
                {node.id.slice(0, 8)}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {node.nodeType.replaceAll("_", " ")}
              </Badge>
              {node.assignedModel && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {node.assignedModel}
                </span>
              )}
            </div>

            <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/70">
                  Trigger
                </div>
                <div className="truncate">{createdLabel}</div>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/70">
                  Depends On
                </div>
                <div className="truncate">
                  {dependsLabels.length > 0 ? dependsLabels.join(", ") : "Root node"}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/70">
                  Downstream
                </div>
                <div>{childCount} linked node{childCount === 1 ? "" : "s"}</div>
              </div>
            </div>
          </div>

          <div className="hidden shrink-0 items-center gap-1 text-[10px] text-muted-foreground md:flex">
            <Send className="h-3 w-3" />
            <span className="group-hover:text-foreground">Open details</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function buildRoadmapItems(nodes: DeepResearchNode[]): RoadmapItem[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const childCountMap = new Map<string, number>();

  for (const node of nodes) {
    for (const depId of node.dependsOn) {
      childCountMap.set(depId, (childCountMap.get(depId) ?? 0) + 1);
    }
  }

  return [...nodes]
    .sort((left, right) => {
      const timeDelta = left.createdAt.localeCompare(right.createdAt);
      if (timeDelta !== 0) return timeDelta;
      return left.id.localeCompare(right.id);
    })
    .map((node) => ({
      node,
      dependsLabels: node.dependsOn
        .map((depId) => nodeMap.get(depId))
        .filter((dep): dep is DeepResearchNode => Boolean(dep))
        .map((dep) => getNodeDisplayLabel(dep.label)),
      childCount: childCountMap.get(node.id) ?? 0,
      createdLabel: formatCreatedAt(node.createdAt),
    }));
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
