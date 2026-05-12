"use client";

import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { SPECIES_EMOJI, RARITY_STARS, RARITY_COLORS, STAT_NAMES, type CompanionBones } from "@/lib/agent/buddy/types";
import { roll } from "@/lib/agent/buddy/companion";
import { saveStoredCompanion } from "@/lib/agent/buddy/storage";

interface BuddyHatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHatched: () => void;
}

export function BuddyHatchDialog({ open, onOpenChange, onHatched }: BuddyHatchDialogProps) {
  const [seed, setSeed] = useState("");
  const [bones, setBones] = useState<CompanionBones | null>(null);
  const [hatching, setHatching] = useState(false);
  const [rolled, setRolled] = useState(false);

  const handleRoll = useCallback(() => {
    const userId = seed.trim() || `user-${Date.now()}`;
    const result = roll(userId);
    setBones(result.bones);
    setRolled(true);
  }, [seed]);

  const handleHatch = useCallback(async () => {
    if (!bones) return;
    setHatching(true);

    try {
      const res = await fetch("/api/agent/buddy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "hatch",
          species: bones.species,
          rarity: bones.rarity,
          stats: bones.stats,
        }),
      });

      if (!res.ok) throw new Error("Hatch failed");

      const { name, personality } = await res.json();

      saveStoredCompanion({
        name,
        personality,
        hatchedAt: Date.now(),
        seed: seed.trim() || `user-${Date.now()}`,
        muted: false,
      });

      onHatched();
      onOpenChange(false);
      setBones(null);
      setRolled(false);
      setSeed("");
    } catch (error) {
      console.error("Failed to hatch buddy", error);
      window.alert("Unable to hatch your buddy right now. Please try again.");
    } finally {
      setHatching(false);
    }
  }, [bones, seed, onHatched, onOpenChange]);

  const emoji = bones ? (SPECIES_EMOJI[bones.species] ?? "🐾") : "🥚";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Hatch a Buddy</DialogTitle>
          <DialogDescription>
            Your coding companion! Enter a seed (or leave blank for random).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            value={seed}
            onChange={(e) => { setSeed(e.target.value); setRolled(false); setBones(null); }}
            placeholder="Seed (username, email, etc.)"
            className="text-sm"
          />

          {!rolled && (
            <Button onClick={handleRoll} className="w-full">
              Roll Companion
            </Button>
          )}

          {bones && (
            <div className="rounded-md border border-[#30363d] bg-[#161b22] p-4 text-center space-y-3">
              <div className="text-5xl">{emoji}</div>
              {bones.shiny && <div className="text-xs text-yellow-400">✨ Shiny!</div>}
              <div className="text-xs font-mono" style={{ color: RARITY_COLORS[bones.rarity] }}>
                {RARITY_STARS[bones.rarity]} {bones.rarity.toUpperCase()} {bones.species.toUpperCase()}
              </div>
              <div className="space-y-1 text-left mx-auto max-w-[180px]">
                {STAT_NAMES.map((stat) => {
                  const val = bones.stats[stat] ?? 0;
                  return (
                    <div key={stat} className="flex items-center gap-2 text-[10px]">
                      <span className="text-[#565f89] w-16 text-right font-mono">{stat}</span>
                      <div className="flex-1 h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${val}%`,
                            backgroundColor: val >= 80 ? "#3fb950" : val >= 60 ? "#58a6ff" : val >= 40 ? "#d2a8ff" : "#8b949e",
                          }}
                        />
                      </div>
                      <span className="text-[#565f89] w-5 text-right font-mono">{val}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {rolled && bones && (
            <>
              <Button variant="outline" onClick={() => { setRolled(false); setBones(null); }}>
                Re-roll
              </Button>
              <Button onClick={handleHatch} disabled={hatching}>
                {hatching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    Hatching...
                  </>
                ) : (
                  "Hatch!"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
