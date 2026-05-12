"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { SPECIES_EMOJI, RARITY_STARS, RARITY_COLORS, STAT_NAMES, type Companion } from "@/lib/agent/buddy/types";
import { getCompanion, setMuted } from "@/lib/agent/buddy/storage";
import { Volume2, VolumeX } from "lucide-react";

interface BuddyAvatarProps {
  workspaceId: string;
  lastAssistantMessage?: string;
  onHatchRequest: () => void;
}

export function BuddyAvatar({ workspaceId, lastAssistantMessage, onHatchRequest }: BuddyAvatarProps) {
  const [companion, setCompanion] = useState<Companion | null>(() => getCompanion());
  const [reaction, setReaction] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const reactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReactedMsgRef = useRef<string | null>(null);
  const [prevWorkspaceId, setPrevWorkspaceId] = useState(workspaceId);

  // Reload companion when workspaceId changes (React-recommended derived state pattern)
  if (prevWorkspaceId !== workspaceId) {
    setPrevWorkspaceId(workspaceId);
    setCompanion(getCompanion());
  }

  // Fire reaction when a new assistant message arrives
  useEffect(() => {
    if (!companion || companion.muted || !lastAssistantMessage) return;
    if (lastAssistantMessage === lastReactedMsgRef.current) return;
    lastReactedMsgRef.current = lastAssistantMessage;

    // Fire-and-forget reaction request
    fetch("/api/agent/buddy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "react",
        lastMsg: lastAssistantMessage,
        companion: {
          name: companion.name,
          species: companion.species,
          rarity: companion.rarity,
          personality: companion.personality,
          stats: companion.stats,
        },
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.reaction) {
          setReaction(data.reaction);
          if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
          reactionTimeoutRef.current = setTimeout(() => setReaction(null), 8000);
        }
      })
      .catch(() => { /* non-essential */ });
  }, [lastAssistantMessage, companion]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
    };
  }, []);

  const toggleMute = useCallback(() => {
    if (!companion) return;
    const newMuted = !companion.muted;
    setMuted(newMuted);
    setCompanion({ ...companion, muted: newMuted });
    if (newMuted) setReaction(null);
  }, [companion]);

  if (!companion) {
    return (
      <button
        onClick={onHatchRequest}
        className="flex items-center gap-1 text-[10px] text-agent-muted hover:text-agent-foreground transition-colors px-1 py-0.5 rounded"
        title="Hatch a buddy companion"
      >
        <span className="text-sm">🥚</span>
      </button>
    );
  }

  const emoji = SPECIES_EMOJI[companion.species] ?? "🐾";
  const stars = RARITY_STARS[companion.rarity];
  const color = RARITY_COLORS[companion.rarity];

  return (
    <div className="relative">
      {/* Speech bubble */}
      {reaction && (
        <div className="absolute bottom-full right-0 mb-2 px-2 py-1 rounded-lg bg-[#1c2129] border border-[#30363d] text-[10px] text-[#c9d1d9] whitespace-nowrap max-w-[200px] truncate shadow-lg animate-in fade-in slide-in-from-bottom-1 z-50">
          {reaction}
          <div className="absolute bottom-[-4px] right-3 w-2 h-2 bg-[#1c2129] border-r border-b border-[#30363d] rotate-45" />
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded transition-colors hover:bg-agent-card-hover"
        title={`${companion.name} (${companion.species})`}
      >
        <span className="text-sm">{emoji}</span>
        {companion.shiny && <span className="text-[8px]">✨</span>}
      </button>

      {/* Expanded stats panel */}
      {expanded && (
        <div className="absolute bottom-full right-0 mb-1 rounded-md border border-[#30363d] bg-[#161b22] p-3 text-xs font-mono z-50 min-w-[200px] shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-sm mr-1">{emoji}</span>
              <span className="text-[#c9d1d9] font-semibold">{companion.name}</span>
              {companion.shiny && <span className="ml-1 text-[8px]">✨ Shiny!</span>}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); toggleMute(); }}
              className="p-1 rounded hover:bg-[#30363d] text-[#8b949e]"
              title={companion.muted ? "Unmute" : "Mute"}
            >
              {companion.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
            </button>
          </div>
          <div className="text-[10px] mb-2" style={{ color }}>
            {stars} {companion.rarity}
          </div>
          <div className="text-[#8b949e] text-[10px] mb-2 italic">
            {companion.personality}
          </div>
          <div className="space-y-1">
            {STAT_NAMES.map((stat) => {
              const val = companion.stats[stat] ?? 0;
              return (
                <div key={stat} className="flex items-center gap-2">
                  <span className="text-[#565f89] text-[9px] w-16 text-right">{stat}</span>
                  <div className="flex-1 h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${val}%`,
                        backgroundColor: val >= 80 ? "#3fb950" : val >= 60 ? "#58a6ff" : val >= 40 ? "#d2a8ff" : "#8b949e",
                      }}
                    />
                  </div>
                  <span className="text-[#565f89] text-[9px] w-6">{val}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
