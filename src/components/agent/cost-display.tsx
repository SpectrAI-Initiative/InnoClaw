"use client";

import React, { useState } from "react";
import { DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import type { CostSnapshot } from "@/lib/agent/cost-tracker";
import { formatTokens } from "@/lib/agent/cost-tracker";

interface CostDisplayProps {
  snapshot: CostSnapshot | null;
}

export function CostDisplay({ snapshot }: CostDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  if (!snapshot) return null;

  const hasTokenUsage =
    snapshot.totalInputTokens > 0 || snapshot.totalOutputTokens > 0;
  const hasUnknownPricing = Object.values(snapshot.modelUsage).some(
    (usage) => !usage.pricingKnown
  );

  if (snapshot.totalCostUsd === 0 && !hasTokenUsage) return null;

  const costStr =
    snapshot.totalCostUsd === 0
      ? hasUnknownPricing && hasTokenUsage
        ? "~est"
        : "$0.00"
      : snapshot.totalCostUsd < 0.01
        ? "<$0.01"
        : `$${snapshot.totalCostUsd.toFixed(2)}`;
  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        title="Session cost"
        className="flex items-center gap-0.5 text-[10px] font-mono tabular-nums px-1 py-0.5 rounded select-none transition-colors text-agent-muted hover:text-agent-foreground"
      >
        <DollarSign className="h-3 w-3" />
        <span>{costStr}</span>
        {expanded ? (
          <ChevronUp className="h-2.5 w-2.5" />
        ) : (
          <ChevronDown className="h-2.5 w-2.5" />
        )}
      </button>

      {expanded && (
        <div className="absolute bottom-full right-0 mb-1 rounded-md border border-[#30363d] bg-[#161b22] p-3 text-xs font-mono z-50 min-w-[240px] shadow-lg">
          <div className="text-[#c9d1d9] font-semibold mb-2">Session Cost</div>
          <div className="space-y-1 text-[#8b949e]">
            <div className="flex justify-between">
              <span>Total</span>
              <span className="text-[#c9d1d9]">{costStr}</span>
            </div>
            <div className="flex justify-between">
              <span>Input tokens</span>
              <span>{formatTokens(snapshot.totalInputTokens)}</span>
            </div>
            <div className="flex justify-between">
              <span>Output tokens</span>
              <span>{formatTokens(snapshot.totalOutputTokens)}</span>
            </div>
          </div>

          {Object.keys(snapshot.modelUsage).length > 0 && (
            <>
              <div className="border-t border-[#30363d] my-2" />
              <div className="text-[#8b949e] text-[10px] mb-1">By model</div>
              <div className="space-y-1">
                {Object.entries(snapshot.modelUsage).map(([model, usage]) => (
                  <div key={model} className="text-[10px]">
                    <div className="flex justify-between text-[#8b949e]">
                      <span className="truncate max-w-[140px]">{model}</span>
                      <span className="text-[#c9d1d9]">
                        ${usage.costUsd.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex gap-2 text-[#565f89] ml-2">
                      <span>{formatTokens(usage.inputTokens)} in</span>
                      <span>{formatTokens(usage.outputTokens)} out</span>
                      {!usage.pricingKnown && (
                        <span className="text-[#e0af68]">~est</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
