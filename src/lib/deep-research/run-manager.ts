import { runDeepResearch, resumeAfterConfirmation } from "./orchestrator";
import type { ConfirmationOutcome } from "./types";

class DeepResearchRunManager {
  private activeRuns = new Map<
    string,
    { abort: AbortController; promise: Promise<void> }
  >();

  /**
   * Start a new orchestrator run for the given session.
   * Returns false if a run is already active for this session.
   */
  startRun(sessionId: string): boolean {
    if (this.activeRuns.has(sessionId)) {
      return false;
    }

    const abort = new AbortController();
    const promise = runDeepResearch(sessionId, abort.signal).finally(() => {
      this.activeRuns.delete(sessionId);
    });

    this.activeRuns.set(sessionId, { abort, promise });
    return true;
  }

  /**
   * Resume after user confirmation. The main brain interprets
   * the user's feedback and dispatches the next step.
   * Returns false if a run is already active for this session.
   */
  resumeAfterConfirmation(
    sessionId: string,
    nodeId: string,
    outcome: ConfirmationOutcome,
    feedback?: string
  ): boolean {
    if (this.activeRuns.has(sessionId)) {
      return false;
    }

    const abort = new AbortController();
    const promise = resumeAfterConfirmation(
      sessionId,
      nodeId,
      outcome,
      feedback,
      abort.signal
    ).finally(() => {
      this.activeRuns.delete(sessionId);
    });

    this.activeRuns.set(sessionId, { abort, promise });
    return true;
  }

  /**
   * Abort a running session.
   */
  abortRun(sessionId: string): void {
    const run = this.activeRuns.get(sessionId);
    if (run) {
      run.abort.abort();
      this.activeRuns.delete(sessionId);
    }
  }

  /**
   * Check if a session has an active orchestrator run.
   */
  isRunning(sessionId: string): boolean {
    return this.activeRuns.has(sessionId);
  }
}

export const runManager = new DeepResearchRunManager();
