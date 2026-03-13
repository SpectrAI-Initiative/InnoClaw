import { execInWorkspace } from "@/lib/utils/shell";
import { TRUNCATE, BUFFER } from "@/lib/constants";
import type {
  RunMonitorStatus,
  RunStatusSnapshot,
  JobMonitoringConfig,
  RemoteExecutionProfile,
  ExperimentRun,
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
): { schedulerStatus: RunMonitorStatus; resolvedStatus: RunMonitorStatus } {
  let schedulerStatus: RunMonitorStatus = "unknown";

  if (profile.schedulerType === "slurm") {
    // Prefer squeue (active jobs), fall back to sacct (terminal jobs)
    if (parsed.squeue) {
      schedulerStatus = parseSlurmState(parsed.squeue);
    } else if (parsed.sacct) {
      // sacct format: State|ExitCode  e.g. "COMPLETED|0:0" or "FAILED|1:0"
      const sacctState = parsed.sacct.split("|")[0] ?? "";
      schedulerStatus = parseSlurmState(sacctState);
    }
  } else if (profile.schedulerType === "rjob") {
    if (parsed.rjobStatus) {
      schedulerStatus = parseRjobState(parsed.rjobStatus);
    }
  } else {
    // Shell mode — PID check
    if (parsed.pidStatus === "RUNNING") {
      schedulerStatus = "running";
    } else if (parsed.pidStatus === "STOPPED") {
      schedulerStatus = "stopped";
    }
  }

  // Resolve: scheduler is authoritative when terminal
  const isTerminal = ["completed", "failed", "cancelled", "timed_out"].includes(schedulerStatus);
  if (isTerminal) {
    return { schedulerStatus, resolvedStatus: schedulerStatus };
  }

  // Scheduler says running/queued → trust it
  if (schedulerStatus === "running" || schedulerStatus === "queued" || schedulerStatus === "completing") {
    // But check for conflicting markers
    if (parsed.doneMarker) {
      return { schedulerStatus, resolvedStatus: "needs_attention" };
    }
    if (parsed.failedMarker) {
      return { schedulerStatus, resolvedStatus: "needs_attention" };
    }
    return { schedulerStatus, resolvedStatus: schedulerStatus };
  }

  // Scheduler unknown/stopped — use markers as strong evidence
  if (parsed.doneMarker) {
    return { schedulerStatus, resolvedStatus: "completed" };
  }
  if (parsed.failedMarker) {
    return { schedulerStatus, resolvedStatus: "failed" };
  }

  // Stopped process with no markers → needs attention
  if (schedulerStatus === "stopped") {
    return { schedulerStatus, resolvedStatus: "needs_attention" };
  }

  return { schedulerStatus, resolvedStatus: "unknown" };
}

// =============================================================
// Map resolvedStatus to a decision
// =============================================================

function toDecision(
  resolvedStatus: RunMonitorStatus,
): "still_running" | "completed" | "failed" | "needs_attention" {
  switch (resolvedStatus) {
    case "completed":
      return "completed";
    case "failed":
    case "cancelled":
    case "timed_out":
      return "failed";
    case "queued":
    case "running":
    case "completing":
      return "still_running";
    default:
      return "needs_attention";
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
): Promise<RunStatusSnapshot> {
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
  const { schedulerStatus, resolvedStatus } = resolveStatus(profile, parsed);

  // Heartbeat age
  let heartbeat: RunStatusSnapshot["heartbeat"] = null;
  if (parsed.heartbeatMtime !== null) {
    const nowEpoch = Math.floor(Date.now() / 1000);
    heartbeat = { found: true, ageSeconds: nowEpoch - parsed.heartbeatMtime };
  } else {
    heartbeat = { found: false };
  }

  // Marker evidence
  const markerEvidence: RunStatusSnapshot["markerEvidence"] = parsed.doneMarker
    ? "done"
    : parsed.failedMarker
      ? "failed"
      : "none";

  const decision = toDecision(resolvedStatus);
  const pollInterval = overrides?.pollIntervalSeconds ?? profile.pollIntervalSeconds ?? 60;

  return {
    schedulerStatus,
    markerEvidence,
    heartbeat,
    logTail: parsed.logTail || parsed.rjobLog || null,
    logGrowing: null, // would need previous snapshot to compute — omit for v1
    resolvedStatus,
    decision,
    retryAfterSeconds: decision === "still_running" ? pollInterval : null,
    timestamp: new Date().toISOString(),
    rawOutput: result.exitCode !== 0 ? `exit=${result.exitCode} stderr=${result.stderr.slice(0, 500)}` : undefined,
  };
}
