import { execInWorkspace } from "@/lib/utils/shell";
import { TRUNCATE, BUFFER } from "@/lib/constants";
import type {
  RunMonitorStatus,
  RunStatusSnapshot,
  RunCompletionState,
  MonitorJobDecision,
  JobMonitoringConfig,
  RemoteExecutionProfile,
  ExperimentRun,
  ExperimentRunStatus,
} from "./types";

// =============================================================
// SSH helper — build the ssh command prefix from a profile
// =============================================================

function buildSshPrefix(profile: RemoteExecutionProfile): string {
  const keyOpt = profile.sshKeyRef ? `-i ${profile.sshKeyRef} ` : "";
  return `ssh ${keyOpt}-p ${profile.port} ${profile.username}@${profile.host}`;
}

// =============================================================
// Slurm state → RunMonitorStatus mapping
// =============================================================

const SLURM_STATE_MAP: Record<string, RunMonitorStatus> = {
  PENDING: "queued",
  RUNNING: "running",
  COMPLETING: "completing",
  COMPLETED: "completed",
  FAILED: "failed",
  NODE_FAIL: "failed",
  CANCELLED: "cancelled",
  "CANCELLED+": "cancelled",
  TIMEOUT: "timed_out",
  PREEMPTED: "cancelled",
  SUSPENDED: "queued",
  OUT_OF_MEMORY: "failed",
};

function parseSlurmState(raw: string): RunMonitorStatus {
  const normalized = raw.trim().toUpperCase();
  return SLURM_STATE_MAP[normalized] ?? "unknown";
}

// =============================================================
// rjob state → RunMonitorStatus mapping
// =============================================================

const RJOB_STATE_MAP: Record<string, RunMonitorStatus> = {
  PENDING: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
  UNKNOWN: "unknown",
};

function parseRjobState(raw: string): RunMonitorStatus {
  const normalized = raw.trim().toUpperCase();
  return RJOB_STATE_MAP[normalized] ?? "unknown";
}

// =============================================================
// Parse the batched SSH output
// =============================================================

interface ParsedCheckOutput {
  squeue: string;
  sacct: string;
  pidStatus: string;
  rjobStatus: string;
  rjobLog: string;
  doneMarker: boolean;
  failedMarker: boolean;
  heartbeatMtime: number | null;
  logTail: string;
}

function parseCheckOutput(stdout: string): ParsedCheckOutput {
  const lines = stdout.split("\n");
  let squeue = "";
  let sacct = "";
  let pidStatus = "";
  let rjobStatus = "";
  let rjobLog = "";
  let doneMarker = false;
  let failedMarker = false;
  let heartbeatMtime: number | null = null;
  const logTailLines: string[] = [];
  let inLogTail = false;
  let inRjobLog = false;
  const rjobLogLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("SQUEUE:")) {
      squeue = line.slice(7).trim();
      inRjobLog = false;
    } else if (line.startsWith("SACCT:")) {
      sacct = line.slice(6).trim();
    } else if (line.startsWith("PID:")) {
      pidStatus = line.slice(4).trim();
    } else if (line.startsWith("RJOB:")) {
      rjobStatus = line.slice(5).trim();
    } else if (line.startsWith("RJOBLOG:")) {
      inRjobLog = true;
      const rest = line.slice(8);
      if (rest.trim()) rjobLogLines.push(rest);
    } else if (line.startsWith("DONE:")) {
      doneMarker = line.slice(5).trim() === "YES";
      inRjobLog = false;
    } else if (line.startsWith("FAILED:")) {
      failedMarker = line.slice(7).trim() === "YES";
    } else if (line.startsWith("HB:")) {
      const val = line.slice(3).trim();
      if (val !== "NONE" && val !== "") {
        heartbeatMtime = parseInt(val, 10) || null;
      }
    } else if (line.startsWith("LOGTAIL:")) {
      inLogTail = true;
      inRjobLog = false;
      const rest = line.slice(8);
      if (rest.trim()) logTailLines.push(rest);
    } else if (inLogTail) {
      logTailLines.push(line);
    } else if (inRjobLog) {
      rjobLogLines.push(line);
    }
  }

  rjobLog = rjobLogLines.join("\n").trim();

  return {
    squeue,
    sacct,
    pidStatus,
    rjobStatus,
    rjobLog,
    doneMarker,
    failedMarker,
    heartbeatMtime,
    logTail: logTailLines.join("\n").trim() || "",
  };
}

// =============================================================
// Resolve status from parsed signals
// =============================================================

function resolveStatus(
  profile: RemoteExecutionProfile,
  parsed: ParsedCheckOutput,
): { schedulerState: string; resolvedStatus: RunMonitorStatus; exitCode?: number | null } {
  let schedulerState = "unknown";
  let exitCode: number | null | undefined = undefined;

  if (profile.schedulerType === "slurm") {
    if (parsed.squeue) {
      schedulerState = parsed.squeue.trim();
    } else if (parsed.sacct) {
      const parts = parsed.sacct.split("|");
      schedulerState = (parts[0] ?? "").trim();
      const exitStr = (parts[1] ?? "").split(":")[0];
      if (exitStr) {
        const parsedExit = parseInt(exitStr, 10);
        exitCode = Number.isNaN(parsedExit) ? null : parsedExit;
      }
    }
  } else if (profile.schedulerType === "rjob") {
    if (parsed.rjobStatus) {
      schedulerState = parsed.rjobStatus.trim();
    }
  } else {
    // Shell mode
    schedulerState = parsed.pidStatus || "unknown";
  }

  // Map to RunMonitorStatus
  let schedulerStatus: RunMonitorStatus;
  if (profile.schedulerType === "slurm") {
    schedulerStatus = parseSlurmState(schedulerState);
  } else if (profile.schedulerType === "rjob") {
    schedulerStatus = parseRjobState(schedulerState);
  } else {
    if (parsed.pidStatus === "RUNNING") schedulerStatus = "running";
    else if (parsed.pidStatus === "STOPPED") schedulerStatus = "stopped";
    else schedulerStatus = "unknown";
  }

  // Resolve: scheduler is authoritative when terminal
  const isTerminal = ["completed", "failed", "cancelled", "timed_out"].includes(schedulerStatus);
  if (isTerminal) {
    return { schedulerState, resolvedStatus: schedulerStatus, exitCode };
  }

  // Scheduler says running/queued → trust it
  if (schedulerStatus === "running" || schedulerStatus === "queued" || schedulerStatus === "completing") {
    // But check for conflicting markers
    if (parsed.doneMarker || parsed.failedMarker) {
      return { schedulerState, resolvedStatus: "needs_attention", exitCode };
    }
    return { schedulerState, resolvedStatus: schedulerStatus, exitCode };
  }

  // Scheduler unknown/stopped — use markers as strong evidence
  if (parsed.doneMarker) {
    return { schedulerState, resolvedStatus: "completed", exitCode };
  }
  if (parsed.failedMarker) {
    return { schedulerState, resolvedStatus: "failed", exitCode };
  }

  // Stopped process with no markers → needs attention
  if (schedulerStatus === "stopped") {
    return { schedulerState, resolvedStatus: "needs_attention", exitCode };
  }

  return { schedulerState, resolvedStatus: "unknown", exitCode };
}

// =============================================================
// Map RunMonitorStatus → ExperimentRunStatus + RunCompletionState
// =============================================================

function toExperimentStatus(monitorStatus: RunMonitorStatus): ExperimentRunStatus {
  switch (monitorStatus) {
    case "queued": return "queued";
    case "running": return "running";
    case "completing": return "running";
    case "completed": return "completed";
    case "failed": return "failed";
    case "cancelled": return "cancelled";
    case "timed_out": return "timed_out";
    case "stopped": return "failed";
    case "needs_attention": return "needs_attention";
    default: return "unknown";
  }
}

function toCompletionState(monitorStatus: RunMonitorStatus): RunCompletionState {
  switch (monitorStatus) {
    case "queued":
    case "running":
    case "completing":
      return "in_progress";
    case "completed":
      return "terminal_success";
    case "failed":
    case "timed_out":
    case "stopped":
      return "terminal_failure";
    case "cancelled":
      return "terminal_cancelled";
    default:
      return "undetermined";
  }
}

// =============================================================
// Build MonitorJobDecision from resolved status
// =============================================================

function buildDecision(
  snapshot: RunStatusSnapshot,
  resolvedStatus: RunMonitorStatus,
  pollInterval: number,
): MonitorJobDecision {
  switch (resolvedStatus) {
    case "completed":
      return { kind: "completed", snapshot };
    case "failed":
    case "timed_out":
    case "stopped":
      return { kind: "failed", snapshot };
    case "cancelled":
      return { kind: "cancelled", snapshot };
    case "queued":
    case "running":
    case "completing":
      return { kind: "still_running", snapshot, retryAfterSeconds: pollInterval };
    case "needs_attention":
      return { kind: "unknown", snapshot, retryAfterSeconds: pollInterval };
    default:
      return { kind: "unknown", snapshot, retryAfterSeconds: pollInterval };
  }
}

// =============================================================
// Main: checkJobStatus
// =============================================================

export async function checkJobStatus(
  profile: RemoteExecutionProfile & { pollIntervalSeconds?: number },
  run: ExperimentRun,
  cwd: string,
  overrides?: JobMonitoringConfig,
): Promise<MonitorJobDecision> {
  const sshPrefix = buildSshPrefix(profile);
  const remotePath = profile.remotePath;
  const jobId = run.jobId ?? "";

  // Build marker paths (with overrides)
  const donePath = overrides?.doneMarkerPath ?? "DONE";
  const failedPath = overrides?.failedMarkerPath ?? "FAILED";
  const heartbeatPath = overrides?.heartbeatPath ?? "heartbeat";
  const logPaths = overrides?.logPaths ?? ["*.log"];
  const logGlob = logPaths[0] ?? "*.log";

  // Build a single batched SSH command
  const scriptParts: string[] = [];

  if (profile.schedulerType === "slurm" && jobId) {
    scriptParts.push(`SQUEUE_OUT="$(squeue -j ${jobId} -h -o '%T' 2>/dev/null)"`);
    scriptParts.push(`SACCT_OUT="$(sacct -j ${jobId} --format=State,ExitCode -n -P 2>/dev/null)"`);
    scriptParts.push(`echo "SQUEUE:$SQUEUE_OUT"`);
    scriptParts.push(`echo "SACCT:$SACCT_OUT"`);
    scriptParts.push(`echo "PID:"`);
    scriptParts.push(`echo "RJOB:"`);
    scriptParts.push(`echo "RJOBLOG:"`);
  } else if (profile.schedulerType === "rjob" && jobId) {
    scriptParts.push(`echo "SQUEUE:"`);
    scriptParts.push(`echo "SACCT:"`);
    scriptParts.push(`echo "PID:"`);
    scriptParts.push(`RJOB_STATUS="$(rjob status ${jobId} --format short 2>/dev/null)"`);
    scriptParts.push(`echo "RJOB:$RJOB_STATUS"`);
    scriptParts.push(`RJOB_LOG="$(rjob logs ${jobId} --tail 5 2>/dev/null)"`);
    scriptParts.push(`echo "RJOBLOG:$RJOB_LOG"`);
  } else if (jobId) {
    // Shell mode — jobId is the PID
    scriptParts.push(`echo "SQUEUE:"`);
    scriptParts.push(`echo "SACCT:"`);
    scriptParts.push(`PID_STATUS=$(kill -0 ${jobId} 2>/dev/null && echo RUNNING || echo STOPPED)`);
    scriptParts.push(`echo "PID:$PID_STATUS"`);
    scriptParts.push(`echo "RJOB:"`);
    scriptParts.push(`echo "RJOBLOG:"`);
  } else {
    scriptParts.push(`echo "SQUEUE:"`);
    scriptParts.push(`echo "SACCT:"`);
    scriptParts.push(`echo "PID:"`);
    scriptParts.push(`echo "RJOB:"`);
    scriptParts.push(`echo "RJOBLOG:"`);
  }

  // Marker checks
  scriptParts.push(`cd '${remotePath.replace(/'/g, "'\\''")}'`);
  scriptParts.push(`DONE_VAL=$(test -f '${donePath}' && echo YES || echo NO)`);
  scriptParts.push(`echo "DONE:$DONE_VAL"`);
  scriptParts.push(`FAILED_VAL=$(test -f '${failedPath}' && echo YES || echo NO)`);
  scriptParts.push(`echo "FAILED:$FAILED_VAL"`);

  // Heartbeat
  scriptParts.push(`HB_MTIME=$(stat -c %Y '${heartbeatPath}' 2>/dev/null || echo NONE)`);
  scriptParts.push(`echo "HB:$HB_MTIME"`);

  // Log tail
  scriptParts.push(`LOG_TAIL="$(tail -5 ${logGlob} 2>/dev/null)"`);
  scriptParts.push(`echo "LOGTAIL:$LOG_TAIL"`);

  const script = scriptParts.join("; ");
  const cmd = `${sshPrefix} 'bash -c ${JSON.stringify(script)}'`;

  const result = await execInWorkspace(cmd, cwd, {
    timeout: 30_000,
    maxBuffer: BUFFER.DEFAULT,
  });

  const rawOutput = result.stdout.slice(0, TRUNCATE.STDOUT);
  const parsed = parseCheckOutput(rawOutput);

  // Resolve status
  const { schedulerState, resolvedStatus, exitCode } = resolveStatus(profile, parsed);

  // Heartbeat
  const heartbeatSeenAt = parsed.heartbeatMtime !== null
    ? new Date(parsed.heartbeatMtime * 1000).toISOString()
    : undefined;

  // Log tail preview
  const logTailContent = parsed.logTail || parsed.rjobLog || "";
  const logTailPreview = logTailContent
    ? logTailContent.split("\n").filter(Boolean).slice(-5)
    : undefined;

  // Build observation-only snapshot
  const snapshot: RunStatusSnapshot = {
    observedAt: new Date().toISOString(),
    status: toExperimentStatus(resolvedStatus),
    completionState: toCompletionState(resolvedStatus),
    schedulerState,
    exitCode: exitCode ?? undefined,
    processAlive: parsed.pidStatus === "RUNNING" ? true : parsed.pidStatus === "STOPPED" ? false : undefined,
    heartbeatSeenAt,
    stdoutLogExists: parsed.logTail.length > 0 || undefined,
    stderrLogExists: undefined,
    logTailPreview,
    message: result.exitCode !== 0
      ? `SSH exit=${result.exitCode} stderr=${result.stderr.slice(0, 500)}`
      : undefined,
  };

  const pollInterval = overrides?.pollIntervalSeconds ?? profile.pollIntervalSeconds ?? 60;
  return buildDecision(snapshot, resolvedStatus, pollInterval);
}
