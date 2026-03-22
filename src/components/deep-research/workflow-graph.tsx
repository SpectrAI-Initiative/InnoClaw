"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node as FlowNode,
  type Edge as FlowEdge,
  type NodeProps,
  Handle,
  Position,
} from "@xyflow/react";
import dagre from "dagre";
import type { DeepResearchNode } from "@/lib/deep-research/types";
import { PHASE_STAGE_NUMBER } from "@/lib/deep-research/types";
import { Badge } from "@/components/ui/badge";
import type { Phase } from "@/lib/deep-research/types";
import {
  Brain,
  Search,
  FileText,
  Eye,
  MessageSquare,
  Play,
  CheckCircle,
  Sparkles,
  BookOpen,
  Filter,
  ShieldCheck,
  ClipboardList,
  Server,
  Activity,
  FolderDown,
  GitCompare,
} from "lucide-react";
import "@xyflow/react/dist/style.css";

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
  deliberate: MessageSquare,
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

const STATUS_COLORS: Record<string, { border: string; bg: string }> = {
  pending: { border: "border-gray-300 dark:border-gray-600", bg: "bg-white dark:bg-gray-900" },
  queued: { border: "border-gray-400 dark:border-gray-500", bg: "bg-gray-50 dark:bg-gray-800" },
  running: { border: "border-blue-500 animate-pulse", bg: "bg-blue-50 dark:bg-blue-950" },
  completed: { border: "border-green-500", bg: "bg-green-50 dark:bg-green-950" },
  failed: { border: "border-red-500", bg: "bg-red-50 dark:bg-red-950" },
  skipped: { border: "border-gray-300 dark:border-gray-600", bg: "bg-gray-50 dark:bg-gray-800" },
  awaiting_approval: { border: "border-yellow-500 animate-pulse", bg: "bg-yellow-50 dark:bg-yellow-950" },
  awaiting_user_confirmation: { border: "border-amber-500 animate-pulse", bg: "bg-amber-50 dark:bg-amber-950" },
  superseded: { border: "border-gray-300 dark:border-gray-600", bg: "bg-gray-100 dark:bg-gray-800 opacity-50" },
};

const ROLE_COLORS: Record<string, string> = {
  main_brain: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  reviewer_a: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  reviewer_b: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  worker: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

function CustomNode({ data }: NodeProps) {
  const nodeData = data as {
    label: string;
    nodeType: string;
    status: string;
    assignedRole: string;
    onClick: () => void;
  };
  const Icon = NODE_ICONS[nodeData.nodeType] || Brain;
  const colors = STATUS_COLORS[nodeData.status] || STATUS_COLORS.pending;
  const isSuperseded = nodeData.status === "superseded";

  return (
    <div
      className={`px-3 py-2 rounded-lg border-2 ${colors.border} ${colors.bg} cursor-pointer hover:shadow-md transition-shadow min-w-[140px] ${isSuperseded ? "opacity-50" : ""}`}
      onClick={nodeData.onClick}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" />
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className={`text-xs font-medium truncate ${isSuperseded ? "line-through" : ""}`}>{nodeData.label}</span>
      </div>
      <div className="flex items-center gap-1">
        <Badge className={`text-[9px] px-1 py-0 ${ROLE_COLORS[nodeData.assignedRole] || ""}`}>
          {nodeData.assignedRole.replace("_", " ")}
        </Badge>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

const PHASE_LABELS: Record<Phase, string> = {
  intake: "0 — Intake",
  planning: "1 — Planning",
  evidence_collection: "2 — Evidence Collection",
  literature_synthesis: "3 — Literature Synthesis",
  reviewer_deliberation: "4 — Reviewer Deliberation",
  decision: "5 — Decision",
  additional_literature: "6 — Additional Literature",
  validation_planning: "7 — Validation Planning",
  resource_acquisition: "8 — Resource Acquisition",
  experiment_execution: "9 — Experiment Execution",
  validation_review: "10 — Validation Review",
  final_report: "11 — Final Report",
};

function layoutGraph(
  researchNodes: DeepResearchNode[],
  onNodeSelect: (nodeId: string) => void
): { flowNodes: FlowNode[]; flowEdges: FlowEdge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 50, ranksep: 80 });

  for (const node of researchNodes) {
    // Use stage number for rank to enforce sequential ordering
    const stage = PHASE_STAGE_NUMBER[node.phase] ?? 0;
    g.setNode(node.id, { width: 180, height: 60, rank: stage });
    for (const depId of node.dependsOn) {
      g.setEdge(depId, node.id);
    }
    // Add implicit edges between stages for sequential ordering
    // (dagre uses rank hints via edges for ordering)
  }

  // Add invisible edges between phase groups to enforce stage ordering
  const nodesByPhase = new Map<Phase, string[]>();
  for (const node of researchNodes) {
    const existing = nodesByPhase.get(node.phase) ?? [];
    existing.push(node.id);
    nodesByPhase.set(node.phase, existing);
  }

  // Connect first node of each phase to first node of next phase (if no explicit dep exists)
  const sortedPhases = [...nodesByPhase.keys()].sort(
    (a, b) => (PHASE_STAGE_NUMBER[a] ?? 0) - (PHASE_STAGE_NUMBER[b] ?? 0)
  );
  for (let i = 0; i < sortedPhases.length - 1; i++) {
    const currentPhaseNodes = nodesByPhase.get(sortedPhases[i])!;
    const nextPhaseNodes = nodesByPhase.get(sortedPhases[i + 1])!;
    // Check if there's already an explicit edge between these phases
    const hasExplicitEdge = researchNodes.some(
      n => nextPhaseNodes.includes(n.id) && n.dependsOn.some(d => currentPhaseNodes.includes(d))
    );
    if (!hasExplicitEdge && currentPhaseNodes.length > 0 && nextPhaseNodes.length > 0) {
      // Add invisible ordering edge
      g.setEdge(currentPhaseNodes[0], nextPhaseNodes[0], { weight: 0, minlen: 1 });
    }
  }

  dagre.layout(g);

  // Group nodes by phase for background labels
  const phaseGroups = new Map<Phase, { minX: number; minY: number; maxX: number; maxY: number }>();
  for (const node of researchNodes) {
    const pos = g.node(node.id);
    if (!pos) continue;
    const phase = node.phase;
    const existing = phaseGroups.get(phase);
    if (existing) {
      existing.minX = Math.min(existing.minX, pos.x - 100);
      existing.minY = Math.min(existing.minY, pos.y - 40);
      existing.maxX = Math.max(existing.maxX, pos.x + 100);
      existing.maxY = Math.max(existing.maxY, pos.y + 40);
    } else {
      phaseGroups.set(phase, {
        minX: pos.x - 100, minY: pos.y - 40,
        maxX: pos.x + 100, maxY: pos.y + 40,
      });
    }
  }

  // Create phase group background nodes
  const groupNodes: FlowNode[] = [];
  for (const [phase, bounds] of phaseGroups) {
    const pad = 20;
    groupNodes.push({
      id: `phase-${phase}`,
      type: "group",
      position: { x: bounds.minX - pad, y: bounds.minY - 28 },
      data: { label: PHASE_LABELS[phase] || phase },
      style: {
        width: bounds.maxX - bounds.minX + pad * 2,
        height: bounds.maxY - bounds.minY + pad + 28,
        backgroundColor: "rgba(128,128,128,0.04)",
        border: "1px dashed rgba(128,128,128,0.2)",
        borderRadius: "8px",
        fontSize: "10px",
        color: "rgba(128,128,128,0.6)",
        padding: "4px 8px",
      },
    });
  }

  const flowNodes: FlowNode[] = [
    ...groupNodes,
    ...researchNodes.map((node) => {
      const pos = g.node(node.id);
      return {
        id: node.id,
        type: "custom",
        position: { x: (pos?.x ?? 0) - 90, y: (pos?.y ?? 0) - 30 },
        data: {
          label: node.label,
          nodeType: node.nodeType,
          status: node.status,
          assignedRole: node.assignedRole,
          phase: node.phase,
          onClick: () => onNodeSelect(node.id),
        },
      };
    }),
  ];

  const flowEdges: FlowEdge[] = [];
  const nodeStatusMap = new Map(researchNodes.map(n => [n.id, n.status]));
  // Build set of explicit dependency edges for filtering
  const explicitEdges = new Set<string>();
  for (const node of researchNodes) {
    for (const depId of node.dependsOn) {
      explicitEdges.add(`${depId}-${node.id}`);
    }
  }
  for (const node of researchNodes) {
    for (const depId of node.dependsOn) {
      const sourceStatus = nodeStatusMap.get(depId);
      const targetStatus = node.status;
      // Animate edges where target is running, or source just completed and target is pending
      const isActive = targetStatus === "running" ||
        (sourceStatus === "completed" && targetStatus === "pending");
      flowEdges.push({
        id: `${depId}-${node.id}`,
        source: depId,
        target: node.id,
        animated: isActive,
        style: node.status === "superseded" ? { opacity: 0.3 } : undefined,
      });
    }
  }

  return { flowNodes, flowEdges };
}

export function WorkflowGraph({ nodes: researchNodes, onNodeSelect }: WorkflowGraphProps) {
  const { flowNodes: initialNodes, flowEdges: initialEdges } = useMemo(
    () => layoutGraph(researchNodes, onNodeSelect),
    [researchNodes, onNodeSelect]
  );

  const [flowNodes] = useNodesState(initialNodes);
  const [flowEdges] = useEdgesState(initialEdges);

  if (researchNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No workflow nodes yet. Start the research to see the graph.
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
