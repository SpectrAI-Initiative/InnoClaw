"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Terminal } from "lucide-react";

/**
 * Parse an SSH command string into profile fields.
 * Supports patterns like:
 *   ssh user@host
 *   ssh -p 2222 user@host
 *   ssh -i ~/.ssh/key user@host
 *   ssh -CAXY user.something@host.example.com
 *   ssh -J jumphost user@host
 *   ssh -o ProxyJump=jump user@host
 */
function parseSshCommand(raw: string): {
  username: string;
  host: string;
  port: string;
  sshKeyRef: string;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Tokenize respecting quoted strings
  const tokens: string[] = [];
  let i = 0;
  while (i < trimmed.length) {
    // skip whitespace
    while (i < trimmed.length && /\s/.test(trimmed[i])) i++;
    if (i >= trimmed.length) break;
    if (trimmed[i] === '"' || trimmed[i] === "'") {
      const q = trimmed[i];
      i++;
      let tok = "";
      while (i < trimmed.length && trimmed[i] !== q) {
        tok += trimmed[i];
        i++;
      }
      i++; // skip closing quote
      tokens.push(tok);
    } else {
      let tok = "";
      while (i < trimmed.length && !/\s/.test(trimmed[i])) {
        tok += trimmed[i];
        i++;
      }
      tokens.push(tok);
    }
  }

  if (tokens.length === 0) return null;
  // Strip leading "ssh" if present
  if (tokens[0].toLowerCase() === "ssh") tokens.shift();
  if (tokens.length === 0) return null;

  let port = "22";
  let sshKeyRef = "";
  let destination = "";

  let idx = 0;
  while (idx < tokens.length) {
    const tok = tokens[idx];
    if (tok === "-p" && idx + 1 < tokens.length) {
      port = tokens[idx + 1];
      idx += 2;
    } else if (tok === "-i" && idx + 1 < tokens.length) {
      sshKeyRef = tokens[idx + 1];
      idx += 2;
    } else if (tok === "-J" || tok === "-o" || tok === "-L" || tok === "-R" || tok === "-D" || tok === "-W" || tok === "-F" || tok === "-l" || tok === "-w" || tok === "-b" || tok === "-c" || tok === "-e" || tok === "-m" || tok === "-O" || tok === "-Q" || tok === "-S" || tok === "-E") {
      // flags that consume next arg — skip both
      idx += 2;
    } else if (tok.startsWith("-")) {
      // flags like -CAXY, -v, -N, etc. — skip
      // Check for combined flags with value, e.g. -p2222
      const portMatch = tok.match(/^-[A-Za-z]*p(\d+)/);
      if (portMatch) {
        port = portMatch[1];
      }
      const keyMatch = tok.match(/^-[A-Za-z]*i(.+)/);
      if (keyMatch) {
        sshKeyRef = keyMatch[1];
      }
      idx++;
    } else {
      // This should be the destination (user@host or host)
      destination = tok;
      idx++;
    }
  }

  if (!destination) return null;

  let username = "";
  let host = "";

  const atIdx = destination.indexOf("@");
  if (atIdx !== -1) {
    username = destination.slice(0, atIdx);
    host = destination.slice(atIdx + 1);
  } else {
    host = destination;
  }

  // Strip trailing :path if someone pasted scp-style
  const colonIdx = host.indexOf(":");
  if (colonIdx !== -1) {
    host = host.slice(0, colonIdx);
  }

  if (!host) return null;

  return { username, host, port, sshKeyRef };
}

interface RemoteProfileFormProps {
  workspaceId: string;
  onCreated: () => void;
}

export function RemoteProfileForm({ workspaceId, onCreated }: RemoteProfileFormProps) {
  const t = useTranslations("researchExec");
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [remotePath, setRemotePath] = useState("");
  const [schedulerType, setSchedulerType] = useState("shell");
  const [sshKeyRef, setSshKeyRef] = useState("");
  const [pollInterval, setPollInterval] = useState("60");
  const [saving, setSaving] = useState(false);
  const [sshInput, setSshInput] = useState("");
  const [showQuickPaste, setShowQuickPaste] = useState(true);

  const handleParseSsh = () => {
    const parsed = parseSshCommand(sshInput);
    if (!parsed) {
      toast.error(t("sshParseFailed"));
      return;
    }
    if (parsed.host) setHost(parsed.host);
    if (parsed.username) setUsername(parsed.username);
    if (parsed.port) setPort(parsed.port);
    if (parsed.sshKeyRef) setSshKeyRef(parsed.sshKeyRef);
    // Auto-generate profile name from user@host
    if (!name) {
      setName(parsed.username ? `${parsed.username}@${parsed.host}` : parsed.host);
    }
    setSshInput("");
    setShowQuickPaste(false);
    toast.success(t("sshParsed"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !host || !username || !remotePath) {
      toast.error(t("profileMissingFields"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/research-exec/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          name,
          host,
          port: parseInt(port, 10) || 22,
          username,
          remotePath,
          schedulerType,
          sshKeyRef: sshKeyRef || null,
          pollIntervalSeconds: parseInt(pollInterval, 10) || 60,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create profile");
      }
      toast.success(t("profileCreated"));
      setName("");
      setHost("");
      setPort("22");
      setUsername("");
      setRemotePath("");
      setSshKeyRef("");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 border rounded-lg">
      <h4 className="text-sm font-semibold">{t("addProfile")}</h4>

      {/* Quick paste SSH command */}
      {showQuickPaste && (
        <div className="space-y-2 rounded-md border border-dashed p-3 bg-muted/30">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Terminal className="h-3.5 w-3.5" />
            {t("sshQuickPaste")}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={t("sshCommandPlaceholder")}
              value={sshInput}
              onChange={(e) => setSshInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleParseSsh();
                }
              }}
              className="flex-1 font-mono text-xs"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleParseSsh}
              disabled={!sshInput.trim()}
            >
              {t("sshParseButton")}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">{t("sshQuickPasteHint")}</p>
        </div>
      )}

      {!showQuickPaste && (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          onClick={() => setShowQuickPaste(true)}
        >
          {t("sshQuickPaste")}
        </button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder={t("profileName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder={t("profileHost")}
          value={host}
          onChange={(e) => setHost(e.target.value)}
        />
        <Input
          placeholder={t("profilePort")}
          value={port}
          onChange={(e) => setPort(e.target.value)}
          type="number"
        />
        <Input
          placeholder={t("profileUsername")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Input
          placeholder={t("profileRemotePath")}
          value={remotePath}
          onChange={(e) => setRemotePath(e.target.value)}
          className="col-span-2"
        />
        <Select value={schedulerType} onValueChange={setSchedulerType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="shell">Shell (nohup)</SelectItem>
            <SelectItem value="slurm">Slurm (sbatch)</SelectItem>
            <SelectItem value="rjob">rjob (container)</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder={t("profileSshKeyRef")}
          value={sshKeyRef}
          onChange={(e) => setSshKeyRef(e.target.value)}
        />
        <Input
          placeholder={t("profilePollInterval")}
          value={pollInterval}
          onChange={(e) => setPollInterval(e.target.value)}
          type="number"
        />
      </div>
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? t("saving") : t("addProfile")}
      </Button>
    </form>
  );
}
