"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Zap, Terminal } from "lucide-react";
import type { Skill } from "@/types";
import {
  getMatchingSkillsForSlashQuery,
  getMatchingBuiltinCommands,
  type BuiltinCommand,
} from "@/components/agent/slash-command";

type AutocompleteItem =
  | { kind: "skill"; skill: Skill }
  | { kind: "builtin"; command: BuiltinCommand };

interface SkillAutocompleteProps {
  query: string;
  skills: Skill[];
  onSelect: (skill: Skill) => void;
  onBuiltinSelect?: (command: BuiltinCommand) => void;
  onClose: () => void;
}

export function SkillAutocomplete({
  query,
  skills,
  onSelect,
  onBuiltinSelect,
  onClose,
}: SkillAutocompleteProps) {
  const t = useTranslations("skills");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const [trackedQuery, setTrackedQuery] = useState(query);

  const filteredSkills = getMatchingSkillsForSlashQuery(skills, query);
  const filteredBuiltins = getMatchingBuiltinCommands(query);

  const items: AutocompleteItem[] = useMemo(() => [
    ...filteredBuiltins.map((command) => ({ kind: "builtin" as const, command })),
    ...filteredSkills.map((skill) => ({ kind: "skill" as const, skill })),
  ], [filteredSkills, filteredBuiltins]);

  if (trackedQuery !== query) {
    setTrackedQuery(query);
    setSelectedIndex(0);
  }

  // Clamp selectedIndex when items list shrinks (render-time derivation)
  const clampedIndex = Math.min(selectedIndex, Math.max(0, items.length - 1));
  if (clampedIndex !== selectedIndex) {
    setSelectedIndex(clampedIndex);
  }

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.children[selectedIndex] as HTMLElement;
      selected?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && items.length > 0) {
        e.preventDefault();
        const item = items[selectedIndex];
        if (!item) return;
        if (item.kind === "skill") {
          onSelect(item.skill);
        } else if (item.kind === "builtin" && onBuiltinSelect) {
          onBuiltinSelect(item.command);
        }
      } else if (e.key === "Tab") {
        onClose();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, selectedIndex, onSelect, onBuiltinSelect, onClose]);

  if (items.length === 0) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-1 rounded-md border border-[#30363d] bg-[#161b22] p-2 text-xs text-[#565f89] z-50">
        {t("noMatchingSkills")}
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 rounded-md border border-[#30363d] bg-[#161b22] overflow-hidden z-50 max-h-[200px] overflow-y-auto"
    >
      {items.map((item, index) => {
        const isBuiltin = item.kind === "builtin";
        const slug = isBuiltin ? item.command.slug : item.skill.slug;
        const name = isBuiltin ? item.command.name : item.skill.name;
        const description = isBuiltin ? item.command.description : item.skill.description;
        const key = isBuiltin ? `builtin-${slug}` : item.skill.id;

        return (
          <button
            key={key}
            onClick={() => {
              if (isBuiltin && onBuiltinSelect) {
                onBuiltinSelect(item.command);
              } else if (!isBuiltin) {
                onSelect(item.skill);
              }
            }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
              index === selectedIndex
                ? "bg-[#1c2129] text-[#c9d1d9]"
                : "text-[#8b949e] hover:bg-[#1c2129]"
            }`}
          >
            {isBuiltin ? (
              <Terminal className="h-3 w-3 shrink-0 text-[#9ece6a]" />
            ) : (
              <Zap className="h-3 w-3 shrink-0 text-[#7aa2f7]" />
            )}
            <span className={`font-mono ${isBuiltin ? "text-[#9ece6a]" : "text-[#7aa2f7]"}`}>
              /{slug}
            </span>
            <span className="truncate">{name}</span>
            {description && (
              <span className="text-[#565f89] truncate ml-auto text-[10px]">
                {description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
