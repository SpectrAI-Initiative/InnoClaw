"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  getCommunicationProtocolsForRole,
  getRoleColorToken,
  getStructuredRoleDefinition,
  getStructuredRoleDisplayName,
  listStructuredRoleDefinitions,
  RESEARCHER_ROLE_ID,
} from "@/lib/deep-research/role-registry";
import type { DeepResearchArtifact, DeepResearchNode, ModelRole } from "@/lib/deep-research/types";
import { Brain, Send, Sparkles } from "lucide-react";

interface RoleStudioPanelProps {
  nodes: DeepResearchNode[];
  artifacts: DeepResearchArtifact[];
  selectedNode: DeepResearchNode | null;
  resolvedModel?: { provider: string; modelId: string } | null;
  onSelectRoleNode?: (nodeId: string) => void;
  onSendMessage: (
    content: string,
    options?: {
      relatedNodeId?: string;
      metadata?: Record<string, unknown>;
      relatedArtifactIds?: string[];
    },
  ) => Promise<void>;
}

function isRoleNode(node: DeepResearchNode): boolean {
  return typeof node.input?.roleId === "string";
}

function getRoleIdFromNode(node: DeepResearchNode | null): ModelRole {
  const roleId = node?.input?.roleId;
  if (typeof roleId === "string") {
    return roleId as ModelRole;
  }
  return RESEARCHER_ROLE_ID;
}

function findRoleArtifact(
  artifacts: DeepResearchArtifact[],
  nodeId: string | null,
): DeepResearchArtifact | null {
  if (!nodeId) {
    return null;
  }

  return artifacts.find((artifact) => artifact.nodeId === nodeId) ?? null;
}

export function RoleStudioPanel({
  nodes,
  artifacts,
  selectedNode,
  resolvedModel,
  onSelectRoleNode,
  onSendMessage,
}: RoleStudioPanelProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const roleNodes = useMemo(
    () => nodes.filter(isRoleNode),
    [nodes],
  );

  const activeRoleId = getRoleIdFromNode(selectedNode);
  const activeRole = getStructuredRoleDefinition(activeRoleId);
  const activeRoleNode = roleNodes.find((node) => getRoleIdFromNode(node) === activeRoleId) ?? null;
  const activeRoleArtifact = findRoleArtifact(artifacts, activeRoleNode?.id ?? null);
  const activeProtocols = getCommunicationProtocolsForRole(activeRoleId);
  const latestRoleRuntimeNode = useMemo(
    () =>
      [...nodes]
        .reverse()
        .find((node) => node.assignedRole === activeRoleId && typeof node.assignedModel === "string" && node.assignedModel.length > 0) ?? null,
    [activeRoleId, nodes],
  );
  const activeRoleModel = resolvedModel
    ? `${resolvedModel.provider}/${resolvedModel.modelId}`
    : latestRoleRuntimeNode?.assignedModel ?? null;

  if (!activeRole) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Structured role definitions are not available for this session.
      </div>
    );
  }

  const quickPrompts = activeRole.prompts.slice(0, 3);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || sending) {
      return;
    }

    setSending(true);
    try {
      await onSendMessage(content, {
        relatedNodeId: activeRoleNode?.id,
        metadata: {
          source: "role_studio",
          roleId: activeRole.roleId,
          roleName: activeRole.roleName,
          roleStudioMode: activeRoleNode ? "linked_node" : "session_instruction",
        },
        relatedArtifactIds: activeRoleArtifact ? [activeRoleArtifact.id] : undefined,
      });
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="w-[260px] shrink-0 border-r border-border/50 bg-muted/10">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-2">
            <div className="rounded-lg border border-border/60 bg-background p-3">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-violet-500" />
                <div className="text-sm font-semibold">Role Studio</div>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Write directly to the Researcher or any worker role from the Deep Research tab.
              </p>
            </div>

            {listStructuredRoleDefinitions().map((role) => {
              const roleNode = roleNodes.find((node) => getRoleIdFromNode(node) === role.roleId) ?? null;
              const isActive = role.roleId === activeRoleId;

              return (
                <button
                  key={role.roleId}
                  type="button"
                  onClick={() => {
                    if (roleNode?.id) {
                      onSelectRoleNode?.(roleNode.id);
                    }
                  }}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    isActive
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/60 bg-background hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{role.roleName}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {role.workflowSegment}
                      </div>
                    </div>
                    <Badge variant="secondary" className={`text-[10px] ${getRoleColorToken(role.roleId)}`}>
                      {role.category === "main_brain" ? "Coordinator" : "Specialist"}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      <ScrollArea className="flex-1 min-w-0">
        <div className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold">{activeRole.roleName}</h3>
                <Badge variant="secondary" className={`text-[10px] ${getRoleColorToken(activeRole.roleId)}`}>
                  {activeRole.workflowSegment}
                </Badge>
                {activeRoleModel && (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    Model: {activeRoleModel}
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {activeRole.corePositioning}
              </p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              Node linked: {activeRoleNode ? "yes" : "no"}
            </Badge>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Role Writing</CardTitle>
              <CardDescription className="text-xs">
                Send a structured instruction to {activeRole.roleName}. The session will store the request against this role and generate a collaboration artifact.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <Button
                    key={prompt.title}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => {
                      setDraft(`${prompt.title}: ${prompt.objective}`);
                    }}
                  >
                    <Sparkles className="mr-1 h-3 w-3" />
                    {prompt.title}
                  </Button>
                ))}
              </div>
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={`Write a structured instruction for ${activeRole.roleName}...`}
                className="min-h-[120px] resize-none text-sm"
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-muted-foreground">
                  Messages sent here use the existing Deep Research session pipeline. When a structured role node exists, the message is attached to that node; otherwise it is stored as a role-targeted session instruction.
                </p>
                <Button
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
                >
                  <Send className="h-3.5 w-3.5" />
                  Send to {activeRole.roleName}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Prompt Contracts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeRole.prompts.map((prompt) => (
                  <div key={`${activeRole.roleId}-${prompt.title}`} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{prompt.title}</div>
                      <Badge variant="outline" className="text-[10px]">
                        {prompt.kind}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {prompt.objective}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {prompt.requiredSections.map((section) => (
                        <Badge key={section} variant="secondary" className="text-[10px]">
                          {section}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Skills</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeRole.skills.map((skill) => (
                  <div key={skill.id} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{skill.name}</div>
                      <Badge variant="outline" className="text-[10px]">
                        {skill.kind}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {skill.purpose}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {skill.outputs.map((output) => (
                        <Badge key={output} variant="secondary" className="text-[10px]">
                          {output}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Collaboration Paths</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeRole.collaborations.map((item, index) => (
                  <div key={`${item.partnerRoleId}-${item.collaborationType}-${index}`} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        {getStructuredRoleDisplayName(item.partnerRoleId)}
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {item.collaborationType}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {item.trigger}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.expectedResponse.map((response) => (
                        <Badge key={response} variant="secondary" className="text-[10px]">
                          {response}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Communication Protocols</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeProtocols.map((protocol) => (
                  <div key={protocol.id} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        {getStructuredRoleDisplayName(protocol.fromRoleId)} to {getStructuredRoleDisplayName(protocol.toRoleId)}
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        protocol
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {protocol.goal}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {protocol.responseContract.map((item) => (
                        <Badge key={item} variant="secondary" className="text-[10px]">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
