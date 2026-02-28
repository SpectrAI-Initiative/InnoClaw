"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { TerminalSquare } from "lucide-react";

interface TerminalEntry {
  id: number;
  cwd: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface TerminalPanelProps {
  cwd: string;
}

export function TerminalPanel({ cwd: initialCwd }: TerminalPanelProps) {
  const t = useTranslations("terminal");
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState(initialCwd);
  const [isRunning, setIsRunning] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, isRunning]);

  // Re-focus input after command finishes (isRunning: true → false)
  useEffect(() => {
    if (!isRunning) {
      inputRef.current?.focus();
    }
  }, [isRunning]);

  // Focus input when clicking on the terminal area
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const commandHistory = useMemo(() => entries.map((e) => e.command), [entries]);

  const handleSubmit = async () => {
    const cmd = input.trim();
    if (!cmd || isRunning) return;

    setInput("");
    setHistoryIndex(-1);

    // Handle `clear` locally
    if (cmd === "clear") {
      setEntries([]);
      return;
    }

    setIsRunning(true);

    try {
      const res = await fetch("/api/terminal/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd, cwd }),
      });

      const data = await res.json();

      if (res.ok) {
        setEntries((prev) => [
          ...prev,
          {
            id: (idCounter.current += 1),
            cwd,
            command: cmd,
            stdout: data.stdout || "",
            stderr: data.stderr || "",
            exitCode: data.exitCode ?? 0,
          },
        ]);
        // Update cwd if the server returned a new one (e.g., after `cd`)
        if (data.cwd) {
          setCwd(data.cwd);
        }
      } else {
        setEntries((prev) => [
          ...prev,
          {
            id: (idCounter.current += 1),
            cwd,
            command: cmd,
            stdout: "",
            stderr: data.error || "Request failed",
            exitCode: 1,
          },
        ]);
      }
    } catch (err) {
      setEntries((prev) => [
        ...prev,
        {
          id: (idCounter.current += 1),
          cwd,
          command: cmd,
          stdout: "",
          stderr: err instanceof Error ? err.message : "Network error",
          exitCode: 1,
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const newIndex =
        historyIndex === -1
          ? commandHistory.length - 1
          : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setInput(commandHistory[newIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === -1) return;
      const newIndex = historyIndex + 1;
      if (newIndex >= commandHistory.length) {
        setHistoryIndex(-1);
        setInput("");
      } else {
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setEntries([]);
    }
  };

  // Shorten the cwd for display (normalize Windows backslashes to forward slashes)
  const normalizedCwd = cwd.replace(/\\/g, "/");
  const shortCwd = normalizedCwd.split("/").slice(-2).join("/");

  return (
    <div
      className="flex h-full flex-col bg-terminal-bg text-terminal-foreground font-mono text-xs"
      onClick={focusInput}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-terminal-border px-3 py-1.5 text-terminal-muted">
        <TerminalSquare className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{t("title")}</span>
        <span className="ml-auto text-[10px] text-terminal-muted-dim">{shortCwd}</span>
      </div>

      {/* Output */}
      <div className="flex-1 overflow-auto" ref={scrollRef}>
        <div className="p-2 space-y-1">
          {entries.map((entry) => (
            <div key={entry.id}>
              {/* Command line */}
              <div className="flex gap-1">
                <span className="text-terminal-prompt shrink-0">
                  {entry.cwd.replace(/\\/g, "/").split("/").pop()}$
                </span>
                <span className="text-terminal-foreground">{entry.command}</span>
              </div>
              {/* Stdout */}
              {entry.stdout && (
                <pre className="whitespace-pre-wrap text-terminal-stdout pl-2 leading-relaxed">
                  {entry.stdout}
                </pre>
              )}
              {/* Stderr */}
              {entry.stderr && (
                <pre className="whitespace-pre-wrap text-terminal-stderr pl-2 leading-relaxed">
                  {entry.stderr}
                </pre>
              )}
            </div>
          ))}

          {/* Running indicator */}
          {isRunning && (
            <div className="text-terminal-muted animate-pulse">{t("running")}</div>
          )}
        </div>
      </div>

      {/* Input line */}
      <div className="flex items-center gap-1 border-t border-terminal-border px-2 py-1.5">
        <span className="text-terminal-prompt shrink-0">
          {normalizedCwd.split("/").pop()}$
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("placeholder")}
          className="flex-1 bg-transparent text-terminal-foreground placeholder:text-terminal-muted-dim outline-none text-xs font-mono"
          autoFocus
        />
      </div>
    </div>
  );
}
