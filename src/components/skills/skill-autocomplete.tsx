"use client";

import React, { useEffect, useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import type { Skill } from "@/types";

interface SkillAutocompleteProps {
  query: string;
  skills: Skill[];
  onSelect: (skill: Skill) => void;
  onClose: () => void;
}

export function SkillAutocomplete({
  query,
  skills,
  onSelect,
  onClose,
}: SkillAutocompleteProps) {
  const t = useTranslations("skills");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = skills.filter(
    (s) =>
      s.isEnabled &&
      (s.slug.includes(query.toLowerCase()) ||
        s.name.toLowerCase().includes(query.toLowerCase()))
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

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
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered.length > 0) {
        e.preventDefault();
        onSelect(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filtered, selectedIndex, onSelect, onClose]);

  if (filtered.length === 0) {
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
      {filtered.map((skill, index) => (
        <button
          key={skill.id}
          onClick={() => onSelect(skill)}
          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
            index === selectedIndex
              ? "bg-[#1c2129] text-[#c9d1d9]"
              : "text-[#8b949e] hover:bg-[#1c2129]"
          }`}
        >
          <Zap className="h-3 w-3 shrink-0 text-[#7aa2f7]" />
          <span className="font-mono text-[#7aa2f7]">/{skill.slug}</span>
          <span className="truncate">{skill.name}</span>
          {skill.description && (
            <span className="text-[#565f89] truncate ml-auto text-[10px]">
              {skill.description}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
