// =============================================================
// Submission Adapters — Focused Tests
// =============================================================
// Deep tests for MockSubmissionAdapter, RJobSubmissionAdapter,
// RLaunchSubmissionAdapter, SSHSubmissionAdapter, RemoteExecutor,
// and all manifest/command generation helpers.

import { describe, it, expect, beforeEach } from "vitest";

import {
  MockSubmissionAdapter,
  resetMockState,
  specToRJobManifest,
  specToRLaunchManifest,
  specToSlurmManifest,
  renderJobSpec,
  renderManifest,
  getSubmissionAdapter,
} from "../exec-job-submitter";

import {
  RemoteExecutor,
  SSHSubmissionAdapter,
  setSSHRunner,
  resetSSHRunner,
  setSCPTransfer,
  resetSCPTransfer,
} from "../remote-executor";

import {
  rjobToCommand,
  rlaunchToCommand,
  buildRJobManifest,
  buildRLaunchManifest,
} from "../execution-adapters";

import { slurmToScript, slurmToCommand } from "../slurm-launcher";

import type {
  ExperimentSpec,
  RJobManifest,
  RLaunchManifest,
  SlurmManifest,
  RemoteExecutionConfig,
} from "../types";

// -------------------------------------------------------------------
// Test fixture: a realistic ExperimentSpec
// -------------------------------------------------------------------

function makeSpec(overrides?: Partial<ExperimentSpec>): ExperimentSpec {
  return {
    experimentId: "exp-test-001",
    sessionId: "sess-001",
    name: "Test Experiment",
    description: "A test experiment for adapter validation",
    scale: "pilot",
    status: "planning",
    taskType: "classification",
    models: ["bert-base"],
    dataSources: [
      {
        id: "ds-0",
        name: "test-dataset",
        source: "huggingface",
        identifier: "org/dataset",
        estimatedSizeGb: 1.0,
        cachePath: "/mnt/data/cache/test-dataset",
      },
    ],
    preprocessing: {
      enabled: false,
      steps: [],
      outputPath: "/mnt/data/processed",
      outputFormat: "jsonl",
      skipIfCached: true,
    },
    commands: [
      { name: "train", command: "python", args: ["train.py", "--epochs=10", "--lr=1e-4"], stage: "train", dependsOn: [] },
      { name: "eval", command: "python", args: ["eval.py", "--split=test"], stage: "eval", dependsOn: ["train"] },
    ],
    resources: {
      gpu: 4,
      gpuType: "A100",
      cpu: 32,
      memoryMb: 256_000,
      walltime: "24h",
      privateMachine: "group",
    },
    mounts: [
      { source: "/mnt/shared-storage", target: "/mnt/shared-storage" },
    ],
    environment: {
      modules: ["cuda/12.1"],
      condaEnv: "research",
      venvPath: undefined,
      setupCommands: ["pip install -r requirements.txt"],
      workingDir: "/workspace/experiment",
      envVars: { WANDB_PROJECT: "test-exp" },
    },
    outputs: {
      baseDir: "/output/exp-test-001",
      checkpointDir: "/output/exp-test-001/checkpoints",
      logDir: "/output/exp-test-001/logs",
      metricsDir: "/output/exp-test-001/metrics",
      artifactPatterns: ["*.json", "*.pt"],
    },
    retryPolicy: {
      maxRetries: 2,
      retryOnOOM: true,
      retryDelaySeconds: 60,
      scaleDownOnOOM: true,
    },
    submissionMode: "mock",
    launcherType: "rjob",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as ExperimentSpec;
}

// ===================================================================
// 1. MockSubmissionAdapter
// ===================================================================

describe("MockSubmissionAdapter", () => {
  beforeEach(() => {
    resetMockState();
  });

  it("submits a job and returns incremental job IDs", async () => {
    const adapter = new MockSubmissionAdapter();
    const r1 = await adapter.submit(makeSpec(), "mock");
    const r2 = await adapter.submit(makeSpec(), "mock");
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r1.jobId).toBe("mock-job-1");
    expect(r2.jobId).toBe("mock-job-2");
  });

  it("renders a human-readable spec", () => {
    const adapter = new MockSubmissionAdapter();
    const rendered = adapter.renderSpec(makeSpec());
    expect(rendered).toContain("Test Experiment");
    expect(rendered).toContain("exp-test-001");
    expect(rendered).toContain("GPU: 4");
    expect(rendered).toContain("A100");
  });

  it("simulates job status progression: queued → running → completed", async () => {
    const adapter = new MockSubmissionAdapter();
    const sub = await adapter.submit(makeSpec(), "mock");
    const jobId = sub.jobId!;

    const s1 = await adapter.queryStatus(jobId);
    expect(s1.status).toBe("running"); // queued → running on first query

    const s2 = await adapter.queryStatus(jobId);
    expect(s2.status).toBe("completed"); // running → completed on second query
    expect(s2.exitCode).toBe(0);
  });

  it("handles dry_run mode without storing the job", async () => {
    const adapter = new MockSubmissionAdapter();
    const r = await adapter.submit(makeSpec(), "dry_run");
    expect(r.success).toBe(true);
    expect(r.jobId).toBe("mock-job-1");
    expect(r.message).toContain("Dry-run");
  });

  it("returns unknown for unsubmitted job IDs", async () => {
    const adapter = new MockSubmissionAdapter();
    const s = await adapter.queryStatus("nonexistent-123");
    expect(s.status).toBe("unknown");
    expect(s.message).toContain("not found");
  });

  it("cancels a running job", async () => {
    const adapter = new MockSubmissionAdapter();
    const sub = await adapter.submit(makeSpec(), "mock");
    const cancel = await adapter.cancel(sub.jobId!);
    expect(cancel.success).toBe(true);

    const s = await adapter.queryStatus(sub.jobId!);
    expect(s.status).toBe("cancelled");
  });

  it("cannot cancel a nonexistent job", async () => {
    const adapter = new MockSubmissionAdapter();
    const cancel = await adapter.cancel("fake-job");
    expect(cancel.success).toBe(false);
  });

  it("fails submission when shouldFail is set", async () => {
    const adapter = new MockSubmissionAdapter({ shouldFail: true });
    const r = await adapter.submit(makeSpec(), "mock");
    expect(r.success).toBe(false);
    expect(r.jobId).toBeNull();
    expect(r.message).toContain("configured to fail");
  });

  it("simulates latency", async () => {
    const adapter = new MockSubmissionAdapter({ latencyMs: 50 });
    const start = Date.now();
    await adapter.submit(makeSpec(), "mock");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40); // allow slight timing variance
  });

  it("fetchLogs returns mock training output", async () => {
    const adapter = new MockSubmissionAdapter();
    const sub = await adapter.submit(makeSpec(), "mock");
    const logs = await adapter.fetchLogs!(sub.jobId!);
    expect(logs.jobId).toBe(sub.jobId);
    expect(logs.stdout).toContain("Training completed");
    expect(logs.stdout).toContain("Final loss");
    expect(logs.truncated).toBe(false);
  });

  it("fetchOutputs returns mock metrics and files", async () => {
    const adapter = new MockSubmissionAdapter();
    const outputs = await adapter.fetchOutputs!("/output/dir");
    expect(outputs.files.length).toBeGreaterThan(0);
    expect(outputs.metrics).toHaveProperty("accuracy");
    expect(outputs.metrics).toHaveProperty("loss");
    expect(outputs.metrics.accuracy).toBe(0.85);
    expect(outputs.metricsRaw).toBeTruthy();
  });

  it("supports configurable launcher type", () => {
    const adapter = new MockSubmissionAdapter({ launcherType: "rlaunch" });
    expect(adapter.launcherType).toBe("rlaunch");
  });

  it("resets state cleanly between tests", async () => {
    const adapter = new MockSubmissionAdapter();
    await adapter.submit(makeSpec(), "mock");
    resetMockState();
    const r = await adapter.submit(makeSpec(), "mock");
    expect(r.jobId).toBe("mock-job-1"); // counter reset
  });
});

// ===================================================================
// 2. rjob Manifest & Command Generation
// ===================================================================

describe("rjob manifest generation", () => {
  it("builds a correct RJobManifest from ExperimentSpec", () => {
    const manifest = specToRJobManifest(makeSpec());
    expect(manifest.launcherType).toBe("rjob");
    expect(manifest.gpu).toBe(4);
    expect(manifest.memoryMb).toBe(256_000);
    expect(manifest.cpu).toBe(32);
    expect(manifest.jobName).toBe("Test_Experiment");
    expect(manifest.command).toBe("bash");
    expect(manifest.commandArgs[0]).toBe("-exc");
    expect(manifest.commandArgs[1]).toContain("train.py");
    expect(manifest.commandArgs[1]).toContain("eval.py");
    expect(manifest.env).toHaveProperty("WANDB_PROJECT", "test-exp");
  });

  it("includes conda activation in command", () => {
    const manifest = specToRJobManifest(makeSpec());
    expect(manifest.commandArgs[1]).toContain("conda activate research");
  });

  it("includes module load in command", () => {
    const manifest = specToRJobManifest(makeSpec());
    expect(manifest.commandArgs[1]).toContain("module load cuda/12.1");
  });

  it("includes setup commands", () => {
    const manifest = specToRJobManifest(makeSpec());
    expect(manifest.commandArgs[1]).toContain("pip install -r requirements.txt");
  });

  it("includes cd to working directory", () => {
    const manifest = specToRJobManifest(makeSpec());
    expect(manifest.commandArgs[1]).toContain("cd /workspace/experiment");
  });

  it("preserves mount specs", () => {
    const manifest = specToRJobManifest(makeSpec());
    expect(manifest.mounts).toHaveLength(1);
    expect(manifest.mounts[0].source).toBe("/mnt/shared-storage");
  });

  it("sanitizes job name (removes special chars)", () => {
    const spec = makeSpec({ name: "My Experiment (v2) [final]!" });
    const manifest = specToRJobManifest(spec);
    expect(manifest.jobName).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(manifest.jobName.length).toBeLessThanOrEqual(64);
  });

  it("generates valid rjob command string", () => {
    const manifest = specToRJobManifest(makeSpec());
    manifest.chargedGroup = "ai4sdata_gpu";
    const cmd = rjobToCommand(manifest);
    expect(cmd).toContain("rjob submit");
    expect(cmd).toContain("--gpu=4");
    expect(cmd).toContain("--memory=256000");
    expect(cmd).toContain("--cpu=32");
    expect(cmd).toContain("--charged-group=ai4sdata_gpu");
    expect(cmd).toContain("--image=");
    expect(cmd).toContain("--");
    expect(cmd).toContain("bash");
  });

  it("includes env vars in rjob command", () => {
    const manifest = specToRJobManifest(makeSpec());
    const cmd = rjobToCommand(manifest);
    expect(cmd).toContain("--env=WANDB_PROJECT=test-exp");
  });

  it("includes mounts in rjob command", () => {
    const manifest = specToRJobManifest(makeSpec());
    const cmd = rjobToCommand(manifest);
    expect(cmd).toContain("--mount=/mnt/shared-storage:/mnt/shared-storage");
  });
});

// ===================================================================
// 3. rlaunch Manifest & Command Generation
// ===================================================================

describe("rlaunch manifest generation", () => {
  it("builds a correct RLaunchManifest from ExperimentSpec", () => {
    const manifest = specToRLaunchManifest(makeSpec());
    expect(manifest.launcherType).toBe("rlaunch");
    expect(manifest.gpu).toBe(4);
    expect(manifest.memoryMb).toBe(256_000);
    expect(manifest.cpu).toBe(32);
    expect(manifest.command).toContain("train.py");
    expect(manifest.command).toContain("eval.py");
  });

  it("includes environment setup in command chain", () => {
    const manifest = specToRLaunchManifest(makeSpec());
    expect(manifest.command).toContain("module load cuda/12.1");
    expect(manifest.command).toContain("conda activate research");
    expect(manifest.command).toContain("pip install -r requirements.txt");
    expect(manifest.command).toContain("cd /workspace/experiment");
  });

  it("defaults maxWaitDuration to 2h", () => {
    const manifest = specToRLaunchManifest(makeSpec());
    expect(manifest.maxWaitDuration).toBeTruthy();
  });

  it("generates valid rlaunch command string", () => {
    const manifest = specToRLaunchManifest(makeSpec());
    manifest.chargedGroup = "ai4sdata_gpu";
    const cmd = rlaunchToCommand(manifest);
    expect(cmd).toContain("rlaunch");
    expect(cmd).toContain("--gpu=4");
    expect(cmd).toContain("--memory=256000");
    expect(cmd).toContain("--cpu=32");
    expect(cmd).toContain("--charged-group=ai4sdata_gpu");
    expect(cmd).toContain("--private-machine=group");
    expect(cmd).toContain("--");
  });

  it("includes mounts in rlaunch command", () => {
    const manifest = specToRLaunchManifest(makeSpec());
    const cmd = rlaunchToCommand(manifest);
    expect(cmd).toContain("--mount=/mnt/shared-storage:/mnt/shared-storage");
  });

  it("handles spec with no mounts", () => {
    const spec = makeSpec({ mounts: [] });
    const manifest = specToRLaunchManifest(spec);
    const cmd = rlaunchToCommand(manifest);
    expect(cmd).not.toContain("--mount=");
  });
});

// ===================================================================
// 4. Slurm Manifest & Script Generation
// ===================================================================

describe("slurm manifest generation", () => {
  it("builds a correct SlurmManifest from ExperimentSpec", () => {
    const manifest = specToSlurmManifest(makeSpec());
    expect(manifest.launcherType).toBe("slurm");
    expect(manifest.partition).toBe("gpu");
    expect(manifest.gpusPerNode).toBe(4);
    expect(manifest.nodes).toBe(1);
    expect(manifest.jobName).toBe("Test_Experiment");
    expect(manifest.command).toContain("train.py");
  });

  it("generates valid sbatch script", () => {
    const manifest = specToSlurmManifest(makeSpec());
    const script = slurmToScript(manifest);
    expect(script).toContain("#!/bin/bash");
    expect(script).toContain("#SBATCH");
    expect(script).toContain("--partition=gpu");
    expect(script).toContain("--gres=gpu:4");
    expect(script).toContain("--job-name=Test_Experiment");
  });

  it("generates valid sbatch command", () => {
    const manifest = specToSlurmManifest(makeSpec());
    const cmd = slurmToCommand(manifest);
    expect(cmd).toContain("sbatch");
  });

  it("sets output and error paths", () => {
    const manifest = specToSlurmManifest(makeSpec());
    expect(manifest.outputPath).toContain("/output/exp-test-001/logs/");
    expect(manifest.errorPath).toContain("/output/exp-test-001/logs/");
  });
});

// ===================================================================
// 5. renderManifest / renderJobSpec
// ===================================================================

describe("render helpers", () => {
  it("renderJobSpec produces human-readable output", () => {
    const rendered = renderJobSpec(makeSpec());
    expect(rendered).toContain("# Experiment: Test Experiment");
    expect(rendered).toContain("# ID: exp-test-001");
    expect(rendered).toContain("## Resources");
    expect(rendered).toContain("GPU: 4 (A100)");
    expect(rendered).toContain("## Commands");
    expect(rendered).toContain("[train] train:");
    expect(rendered).toContain("[eval] eval:");
    expect(rendered).toContain("## Data Sources");
    expect(rendered).toContain("test-dataset");
    expect(rendered).toContain("## Environment");
    expect(rendered).toContain("Conda: research");
    expect(rendered).toContain("## Outputs");
  });

  it("renderManifest dispatches to rjob renderer", () => {
    const manifest = specToRJobManifest(makeSpec());
    manifest.chargedGroup = "test-group";
    const rendered = renderManifest(manifest);
    expect(rendered).toContain("rjob submit");
  });

  it("renderManifest dispatches to rlaunch renderer", () => {
    const manifest = specToRLaunchManifest(makeSpec());
    manifest.chargedGroup = "test-group";
    const rendered = renderManifest(manifest);
    expect(rendered).toContain("rlaunch");
  });

  it("renderManifest dispatches to slurm renderer", () => {
    const manifest = specToSlurmManifest(makeSpec());
    const rendered = renderManifest(manifest);
    expect(rendered).toContain("#!/bin/bash");
    expect(rendered).toContain("#SBATCH");
  });
});

// ===================================================================
// 6. Adapter Registry
// ===================================================================

describe("adapter registry", () => {
  it("returns rjob adapter from registry", () => {
    const adapter = getSubmissionAdapter("rjob");
    expect(adapter.name).toBe("rjob");
    expect(adapter.launcherType).toBe("rjob");
  });

  it("returns rlaunch adapter from registry", () => {
    const adapter = getSubmissionAdapter("rlaunch");
    expect(adapter.name).toBe("rlaunch");
    expect(adapter.launcherType).toBe("rlaunch");
  });

  it("falls back to mock for unknown launcher type", () => {
    const adapter = getSubmissionAdapter("local_shell");
    expect(adapter.name).toBe("mock");
  });
});

// ===================================================================
// 7. RemoteExecutor — Deep SSH Tests
// ===================================================================

describe("RemoteExecutor", () => {
  beforeEach(() => {
    resetSSHRunner();
    resetSCPTransfer();
  });

  // --- Connection tests ---

  it("testConnection succeeds when echo returns __ALIVE__", async () => {
    setSSHRunner(async (_config, cmd) => {
      expect(cmd).toBe("echo __ALIVE__");
      return { stdout: "__ALIVE__\n", stderr: "", exitCode: 0 };
    });
    const exec = new RemoteExecutor({ host: "gpu01.cluster.com", username: "researcher" });
    const result = await exec.testConnection();
    expect(result.connected).toBe(true);
    expect(result.message).toContain("gpu01.cluster.com");
  });

  it("testConnection fails when response is wrong", async () => {
    setSSHRunner(async () => ({ stdout: "bash: command not found", stderr: "", exitCode: 0 }));
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const result = await exec.testConnection();
    expect(result.connected).toBe(false);
    expect(result.message).toContain("Unexpected");
  });

  it("testConnection fails with no host", async () => {
    const exec = new RemoteExecutor({ username: "u" });
    const result = await exec.testConnection();
    expect(result.connected).toBe(false);
    expect(result.message).toContain("Missing");
  });

  it("testConnection fails with no username", async () => {
    const exec = new RemoteExecutor({ host: "h" });
    const result = await exec.testConnection();
    expect(result.connected).toBe(false);
    expect(result.message).toContain("Missing");
  });

  it("testConnection handles thrown errors gracefully", async () => {
    setSSHRunner(async () => { throw new Error("Connection refused"); });
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const result = await exec.testConnection();
    expect(result.connected).toBe(false);
    expect(result.message).toContain("Connection refused");
  });

  // --- Launcher detection ---

  it("detects only rjob when rlaunch/sbatch are missing", async () => {
    setSSHRunner(async (_config, cmd) => {
      if (cmd.includes("rjob")) return { stdout: "/usr/bin/rjob", stderr: "", exitCode: 0 };
      return { stdout: "", stderr: "", exitCode: 1 };
    });
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const launchers = await exec.detectLaunchers();
    expect(launchers).toEqual(["rjob"]);
  });

  it("detects slurm from sbatch", async () => {
    setSSHRunner(async (_config, cmd) => {
      if (cmd.includes("sbatch")) return { stdout: "/usr/bin/sbatch", stderr: "", exitCode: 0 };
      return { stdout: "", stderr: "", exitCode: 1 };
    });
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const launchers = await exec.detectLaunchers();
    expect(launchers).toEqual(["slurm"]);
  });

  it("detects no launchers on a bare machine", async () => {
    setSSHRunner(async () => ({ stdout: "", stderr: "", exitCode: 1 }));
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const launchers = await exec.detectLaunchers();
    expect(launchers).toEqual([]);
  });

  // --- File staging ---

  it("stages multiple files to remote", async () => {
    const cmdsRun: string[] = [];
    setSSHRunner(async (_config, cmd) => {
      cmdsRun.push(cmd);
      return { stdout: "", stderr: "", exitCode: 0 };
    });
    setSCPTransfer(async (_config, local, remote) => {
      expect(local).toBeTruthy();
      expect(remote).toContain("/remote/work/");
      return { success: true };
    });

    const exec = new RemoteExecutor({ host: "h", username: "u", remoteWorkDir: "/remote/work" });
    const result = await exec.stageFiles(["/local/train.py", "/local/eval.py", "/local/config.yaml"], "exp-1");
    expect(result.success).toBe(true);
    expect(result.remotePaths).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
    expect(cmdsRun[0]).toContain("mkdir -p");
  });

  it("reports partial failure when some files fail to stage", async () => {
    setSSHRunner(async () => ({ stdout: "", stderr: "", exitCode: 0 }));
    let callCount = 0;
    setSCPTransfer(async () => {
      callCount++;
      if (callCount === 2) return { success: false, error: "Permission denied" };
      return { success: true };
    });

    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const result = await exec.stageFiles(["/a.py", "/b.py", "/c.py"]);
    expect(result.success).toBe(false);
    expect(result.remotePaths).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Permission denied");
  });

  // --- Environment setup ---

  it("runs setup commands on remote", async () => {
    let ranCmd = "";
    setSSHRunner(async (_config, cmd) => {
      ranCmd = cmd;
      return { stdout: "", stderr: "", exitCode: 0 };
    });
    const exec = new RemoteExecutor({
      host: "h", username: "u",
      remoteSetupCommands: ["module load cuda/12.1", "conda activate research"],
    });
    const result = await exec.setupEnvironment();
    expect(result.exitCode).toBe(0);
    expect(ranCmd).toContain("module load cuda/12.1");
    expect(ranCmd).toContain("conda activate research");
    expect(ranCmd).toContain(" && ");
  });

  it("no-ops when no setup commands", async () => {
    const exec = new RemoteExecutor({ host: "h", username: "u", remoteSetupCommands: [] });
    const result = await exec.setupEnvironment();
    expect(result.exitCode).toBe(0);
  });

  // --- Job submission ---

  it("submits rjob via SSH and parses Submitted batch job format", async () => {
    setSSHRunner(async () => ({
      stdout: "Submitted batch job 98765",
      stderr: "",
      exitCode: 0,
    }));
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const result = await exec.submitJob(makeSpec(), "real");
    expect(result.success).toBe(true);
    expect(result.jobId).toBe("98765");
    expect(result.metadata).toHaveProperty("adapter", "ssh");
    expect(result.metadata).toHaveProperty("host", "h");
  });

  it("submits rjob via SSH and parses Job ID: format", async () => {
    setSSHRunner(async () => ({
      stdout: "Job submitted. Job ID: 54321\nEstimated wait: 5 minutes",
      stderr: "",
      exitCode: 0,
    }));
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const result = await exec.submitJob(makeSpec(), "real");
    expect(result.success).toBe(true);
    expect(result.jobId).toBe("54321");
  });

  it("submits rjob via SSH and parses bare numeric ID", async () => {
    setSSHRunner(async () => ({
      stdout: "Queued. Your task number is 123456789",
      stderr: "",
      exitCode: 0,
    }));
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const result = await exec.submitJob(makeSpec(), "real");
    expect(result.success).toBe(true);
    expect(result.jobId).toBe("123456789");
  });

  it("generates fallback ID when output has no parseable job ID", async () => {
    setSSHRunner(async () => ({
      stdout: "OK",
      stderr: "",
      exitCode: 0,
    }));
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const result = await exec.submitJob(makeSpec(), "real");
    expect(result.success).toBe(true);
    expect(result.jobId).toMatch(/^rjob-\d+$/); // fallback format
  });

  it("dry_run does not call SSH runner", async () => {
    let sshCalled = false;
    setSSHRunner(async () => {
      sshCalled = true;
      return { stdout: "", stderr: "", exitCode: 0 };
    });
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const result = await exec.submitJob(makeSpec(), "dry_run");
    expect(result.success).toBe(true);
    expect(result.mode).toBe("dry_run");
    expect(sshCalled).toBe(false);
    expect(result.renderedSpec).toContain("rjob submit");
  });

  it("renders rlaunch command when spec launcherType is rlaunch", async () => {
    setSSHRunner(async () => ({ stdout: "Session started", stderr: "", exitCode: 0 }));
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const spec = makeSpec({ launcherType: "rlaunch" });
    const result = await exec.submitJob(spec, "dry_run");
    expect(result.renderedSpec).toContain("rlaunch");
    expect(result.renderedSpec).not.toContain("rjob submit");
  });

  it("falls back to shell commands for unknown launcher", () => {
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const spec = makeSpec({ launcherType: "local_shell" });
    const cmd = exec.renderCommand(spec);
    expect(cmd).toContain("python train.py");
    expect(cmd).toContain("python eval.py");
  });

  it("includes setup commands in real submission", async () => {
    let ranCmd = "";
    setSSHRunner(async (_config, cmd) => {
      ranCmd = cmd;
      return { stdout: "Job ID: 111", stderr: "", exitCode: 0 };
    });
    const exec = new RemoteExecutor({
      host: "h", username: "u",
      remoteSetupCommands: ["source /etc/profile", "module load cuda"],
    });
    await exec.submitJob(makeSpec(), "real");
    expect(ranCmd).toContain("source /etc/profile");
    expect(ranCmd).toContain("module load cuda");
    expect(ranCmd).toContain("rjob submit");
  });

  it("handles SSH error with nonzero exit code", async () => {
    setSSHRunner(async () => ({
      stdout: "",
      stderr: "rjob: error: Invalid charged group",
      exitCode: 1,
    }));
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const result = await exec.submitJob(makeSpec(), "real");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid charged group");
  });

  it("handles thrown exception during submission", async () => {
    setSSHRunner(async () => { throw new Error("Network timeout"); });
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const result = await exec.submitJob(makeSpec(), "real");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Network timeout");
  });

  // --- Status queries ---

  it("parses completed status", async () => {
    setSSHRunner(async () => ({ stdout: "Job 12345: completed (exit 0)", stderr: "", exitCode: 0 }));
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const s = await exec.queryStatus("12345");
    expect(s.status).toBe("completed");
  });

  it("parses running status", async () => {
    setSSHRunner(async () => ({ stdout: "running", stderr: "", exitCode: 0 }));
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const s = await exec.queryStatus("12345");
    expect(s.status).toBe("running");
  });

  it("parses queued/pending status", async () => {
    setSSHRunner(async () => ({ stdout: "pending in queue", stderr: "", exitCode: 0 }));
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const s = await exec.queryStatus("12345");
    expect(s.status).toBe("queued");
  });

  it("parses failed status", async () => {
    setSSHRunner(async () => ({ stdout: "error: job failed with OOM", stderr: "", exitCode: 0 }));
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const s = await exec.queryStatus("12345");
    expect(s.status).toBe("failed");
  });

  it("parses cancelled status", async () => {
    setSSHRunner(async () => ({ stdout: "Job cancelled by user", stderr: "", exitCode: 0 }));
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const s = await exec.queryStatus("12345");
    expect(s.status).toBe("cancelled");
  });

  it("returns unknown for unparseable status", async () => {
    setSSHRunner(async () => ({ stdout: "???", stderr: "", exitCode: 0 }));
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const s = await exec.queryStatus("12345");
    expect(s.status).toBe("unknown");
  });

  it("queries slurm status with squeue command", async () => {
    let ranCmd = "";
    setSSHRunner(async (_config, cmd) => {
      ranCmd = cmd;
      return { stdout: "RUNNING", stderr: "", exitCode: 0 };
    });
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const s = await exec.queryStatus("12345", "slurm");
    expect(ranCmd).toContain("squeue");
    expect(s.status).toBe("running");
  });

  it("returns unknown when SSH fails during status query", async () => {
    setSSHRunner(async () => { throw new Error("SSH broken"); });
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const s = await exec.queryStatus("12345");
    expect(s.status).toBe("unknown");
    expect(s.message).toContain("Failed");
  });

  // --- Log fetching ---

  it("fetches logs via rjob logs command", async () => {
    let ranCmd = "";
    setSSHRunner(async (_config, cmd) => {
      ranCmd = cmd;
      return {
        stdout: "Epoch 1: loss=1.2\nEpoch 2: loss=0.8\nEpoch 3: loss=0.5",
        stderr: "",
        exitCode: 0,
      };
    });
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const logs = await exec.fetchLogs("12345", "rjob", 100);
    expect(ranCmd).toContain("rjob logs 12345");
    expect(ranCmd).toContain("tail -100");
    expect(logs.stdout).toContain("Epoch 1");
    expect(logs.stdout).toContain("Epoch 3");
  });

  it("fetches slurm logs from slurm-*.out files", async () => {
    let ranCmd = "";
    setSSHRunner(async (_config, cmd) => {
      ranCmd = cmd;
      return {
        stdout: "Training started\n---STDERR---\nWarning: lr too high",
        stderr: "",
        exitCode: 0,
      };
    });
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const logs = await exec.fetchLogs("12345", "slurm");
    expect(ranCmd).toContain("slurm-12345.out");
    expect(logs.stdout).toContain("Training started");
    expect(logs.stderr).toContain("Warning: lr too high");
  });

  it("handles log fetch failure gracefully", async () => {
    setSSHRunner(async () => { throw new Error("No such file"); });
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const logs = await exec.fetchLogs("12345");
    expect(logs.stdout).toBe("");
    expect(logs.stderr).toContain("Failed to fetch");
  });

  // --- Output fetching ---

  it("fetches outputs and parses nested JSON metrics", async () => {
    setSSHRunner(async (_config, cmd) => {
      if (cmd.includes("find")) {
        return {
          stdout: "512 /out/metrics.json\n2048 /out/checkpoint.pt\n128 /out/eval_results.json",
          stderr: "", exitCode: 0,
        };
      }
      if (cmd.includes("cat")) {
        return {
          stdout: JSON.stringify({
            accuracy: 0.92,
            detailed: { precision: 0.91, recall: 0.93 },
            loss: 0.08,
          }),
          stderr: "", exitCode: 0,
        };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    });
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const outputs = await exec.fetchOutputs("/out");
    expect(outputs.files).toHaveLength(3);
    expect(outputs.files.find(f => f.isMetrics)).toBeTruthy();
    expect(outputs.metrics.accuracy).toBe(0.92);
    expect(outputs.metrics["detailed.precision"]).toBe(0.91);
    expect(outputs.metrics["detailed.recall"]).toBe(0.93);
    expect(outputs.metrics.loss).toBe(0.08);
    expect(outputs.metricsRaw).toBeTruthy();
  });

  it("handles empty output directory", async () => {
    setSSHRunner(async () => ({ stdout: "", stderr: "", exitCode: 0 }));
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const outputs = await exec.fetchOutputs("/empty");
    expect(outputs.files).toHaveLength(0);
    expect(Object.keys(outputs.metrics)).toHaveLength(0);
  });

  it("handles invalid JSON in metrics file", async () => {
    setSSHRunner(async (_config, cmd) => {
      if (cmd.includes("find")) {
        return { stdout: "100 /out/metrics.json", stderr: "", exitCode: 0 };
      }
      if (cmd.includes("cat")) {
        return { stdout: "not valid json {{{", stderr: "", exitCode: 0 };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    });
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const outputs = await exec.fetchOutputs("/out");
    expect(outputs.files).toHaveLength(1);
    expect(Object.keys(outputs.metrics)).toHaveLength(0); // graceful fallback
    expect(outputs.metricsRaw).toBe("not valid json {{{");
  });

  // --- Cancel ---

  it("cancels rjob via SSH", async () => {
    let ranCmd = "";
    setSSHRunner(async (_config, cmd) => {
      ranCmd = cmd;
      return { stdout: "Cancelled", stderr: "", exitCode: 0 };
    });
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const result = await exec.cancelJob("12345", "rjob");
    expect(ranCmd).toBe("rjob cancel 12345");
    expect(result.success).toBe(true);
  });

  it("cancels slurm job via scancel", async () => {
    let ranCmd = "";
    setSSHRunner(async (_config, cmd) => {
      ranCmd = cmd;
      return { stdout: "", stderr: "", exitCode: 0 };
    });
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const result = await exec.cancelJob("12345", "slurm");
    expect(ranCmd).toBe("scancel 12345");
    expect(result.success).toBe(true);
  });

  it("reports failure when cancel command fails", async () => {
    setSSHRunner(async () => ({ stdout: "", stderr: "Not authorized", exitCode: 1 }));
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const result = await exec.cancelJob("12345");
    expect(result.success).toBe(false);
  });

  // --- Download outputs ---

  it("downloads outputs via SCP", async () => {
    let scpDirection = "";
    setSCPTransfer(async (_config, _local, _remote, direction) => {
      scpDirection = direction;
      return { success: true };
    });
    const exec = new RemoteExecutor({ host: "h", username: "u" });
    const result = await exec.downloadOutputs("/remote/output", "/local/output");
    expect(result.success).toBe(true);
    expect(scpDirection).toBe("download");
  });

  // --- Config ---

  it("getConfig returns a copy with defaults merged", () => {
    const exec = new RemoteExecutor({ host: "my-host", username: "me" });
    const config = exec.getConfig();
    expect(config.host).toBe("my-host");
    expect(config.username).toBe("me");
    expect(config.port).toBe(22); // default
    expect(config.connectTimeoutMs).toBe(30_000); // default
  });
});

// ===================================================================
// 8. SSHSubmissionAdapter — SubmissionAdapter interface compliance
// ===================================================================

describe("SSHSubmissionAdapter", () => {
  beforeEach(() => {
    resetSSHRunner();
    resetSCPTransfer();
  });

  it("implements SubmissionAdapter interface properties", () => {
    setSSHRunner(async () => ({ stdout: "", stderr: "", exitCode: 0 }));
    const adapter = new SSHSubmissionAdapter({ host: "h", username: "u" }, "rjob");
    expect(adapter.name).toBe("ssh");
    expect(adapter.launcherType).toBe("ssh");
  });

  it("renders rjob spec via inner launcher", () => {
    setSSHRunner(async () => ({ stdout: "", stderr: "", exitCode: 0 }));
    const adapter = new SSHSubmissionAdapter({ host: "h", username: "u" }, "rjob");
    const rendered = adapter.renderSpec(makeSpec());
    expect(rendered).toContain("rjob submit");
    expect(rendered).toContain("--gpu=4");
  });

  it("renders rlaunch spec via inner launcher", () => {
    setSSHRunner(async () => ({ stdout: "", stderr: "", exitCode: 0 }));
    const adapter = new SSHSubmissionAdapter({ host: "h", username: "u" }, "rlaunch");
    const rendered = adapter.renderSpec(makeSpec());
    expect(rendered).toContain("rlaunch");
    expect(rendered).not.toContain("rjob submit");
  });

  it("submits via SSH and returns result", async () => {
    setSSHRunner(async () => ({
      stdout: "Job ID: 77777",
      stderr: "",
      exitCode: 0,
    }));
    const adapter = new SSHSubmissionAdapter({ host: "gpu.cluster", username: "user" }, "rjob");
    const result = await adapter.submit(makeSpec(), "real");
    expect(result.success).toBe(true);
    expect(result.jobId).toBe("77777");
    expect(result.metadata).toHaveProperty("adapter", "ssh");
    expect(result.metadata).toHaveProperty("host", "gpu.cluster");
  });

  it("queries status through SSH", async () => {
    setSSHRunner(async () => ({ stdout: "running", stderr: "", exitCode: 0 }));
    const adapter = new SSHSubmissionAdapter({ host: "h", username: "u" }, "rjob");
    const status = await adapter.queryStatus("12345");
    expect(status.status).toBe("running");
    expect(status.jobId).toBe("12345");
  });

  it("cancel delegates to SSH executor", async () => {
    let ranCmd = "";
    setSSHRunner(async (_config, cmd) => {
      ranCmd = cmd;
      return { stdout: "", stderr: "", exitCode: 0 };
    });
    const adapter = new SSHSubmissionAdapter({ host: "h", username: "u" }, "rjob");
    const result = await adapter.cancel("12345");
    expect(result.success).toBe(true);
    expect(ranCmd).toContain("rjob cancel 12345");
  });

  it("fetchLogs delegates to SSH executor", async () => {
    setSSHRunner(async () => ({
      stdout: "Training log line 1\nTraining log line 2",
      stderr: "",
      exitCode: 0,
    }));
    const adapter = new SSHSubmissionAdapter({ host: "h", username: "u" }, "rjob");
    const logs = await adapter.fetchLogs!("12345");
    expect(logs.stdout).toContain("Training log line 1");
  });

  it("fetchOutputs delegates to SSH executor", async () => {
    setSSHRunner(async (_config, cmd) => {
      if (cmd.includes("find")) {
        return { stdout: "1024 /out/metrics.json", stderr: "", exitCode: 0 };
      }
      if (cmd.includes("cat")) {
        return { stdout: '{"acc": 0.9}', stderr: "", exitCode: 0 };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    });
    const adapter = new SSHSubmissionAdapter({ host: "h", username: "u" }, "rjob");
    const outputs = await adapter.fetchOutputs!("/out");
    expect(outputs.files).toHaveLength(1);
    expect(outputs.metrics.acc).toBe(0.9);
  });

  it("getExecutor returns the underlying RemoteExecutor", () => {
    setSSHRunner(async () => ({ stdout: "", stderr: "", exitCode: 0 }));
    const adapter = new SSHSubmissionAdapter({ host: "h", username: "u" }, "rjob");
    const executor = adapter.getExecutor();
    expect(executor).toBeInstanceOf(RemoteExecutor);
    const config = executor.getConfig();
    expect(config.host).toBe("h");
  });

  // --- Full lifecycle test ---

  it("full lifecycle: submit → status → logs → outputs → cancel", async () => {
    let callIndex = 0;
    setSSHRunner(async (_config, cmd) => {
      callIndex++;
      // 1: submit
      if (cmd.includes("rjob submit")) {
        return { stdout: "Job ID: 42000", stderr: "", exitCode: 0 };
      }
      // 2: status query
      if (cmd.includes("rjob status")) {
        return { stdout: "running", stderr: "", exitCode: 0 };
      }
      // 3: logs
      if (cmd.includes("rjob logs")) {
        return { stdout: "Epoch 5/10 loss=0.12", stderr: "", exitCode: 0 };
      }
      // 4: find outputs
      if (cmd.includes("find")) {
        return { stdout: "512 /out/metrics.json", stderr: "", exitCode: 0 };
      }
      // 5: cat metrics
      if (cmd.includes("cat")) {
        return { stdout: '{"accuracy": 0.88}', stderr: "", exitCode: 0 };
      }
      // 6: cancel
      if (cmd.includes("rjob cancel")) {
        return { stdout: "Cancelled", stderr: "", exitCode: 0 };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    });

    const adapter = new SSHSubmissionAdapter({ host: "gpu01", username: "user" }, "rjob");

    // Submit
    const sub = await adapter.submit(makeSpec(), "real");
    expect(sub.success).toBe(true);
    expect(sub.jobId).toBe("42000");

    // Query status
    const status = await adapter.queryStatus("42000");
    expect(status.status).toBe("running");

    // Fetch logs
    const logs = await adapter.fetchLogs!("42000");
    expect(logs.stdout).toContain("Epoch 5/10");

    // Fetch outputs
    const outputs = await adapter.fetchOutputs!("/out");
    expect(outputs.metrics.accuracy).toBe(0.88);

    // Cancel
    const cancel = await adapter.cancel("42000");
    expect(cancel.success).toBe(true);
  });
});

// ===================================================================
// 9. Cross-adapter: buildRJobManifest / buildRLaunchManifest helpers
// ===================================================================

describe("execution-adapters builder helpers", () => {
  it("buildRJobManifest applies defaults from config", () => {
    const manifest = buildRJobManifest({
      jobName: "test-job",
      image: "registry/image:latest",
      command: "bash",
      commandArgs: ["-c", "echo hello"],
      purpose: "test",
    });
    expect(manifest.gpu).toBeGreaterThan(0);
    expect(manifest.memoryMb).toBeGreaterThan(0);
    expect(manifest.cpu).toBeGreaterThan(0);
    expect(manifest.chargedGroup).toBeTruthy();
  });

  it("buildRLaunchManifest applies defaults from config", () => {
    const manifest = buildRLaunchManifest({
      command: "python train.py",
      purpose: "training",
    });
    expect(manifest.gpu).toBeGreaterThan(0);
    expect(manifest.memoryMb).toBeGreaterThan(0);
    expect(manifest.maxWaitDuration).toBeTruthy();
  });

  it("buildRJobManifest overrides defaults with explicit values", () => {
    const manifest = buildRJobManifest({
      jobName: "custom",
      gpu: 8,
      memoryMb: 512_000,
      cpu: 64,
      image: "custom-image",
      command: "bash",
      purpose: "test",
    });
    expect(manifest.gpu).toBe(8);
    expect(manifest.memoryMb).toBe(512_000);
    expect(manifest.cpu).toBe(64);
  });

  it("rjob command includes private-machine flag", () => {
    const manifest = buildRJobManifest({
      jobName: "test",
      image: "img",
      command: "bash",
      purpose: "test",
      privateMachine: "yes",
    });
    const cmd = rjobToCommand(manifest);
    expect(cmd).toContain("--private-machine=yes");
  });

  it("rjob command includes priority when set", () => {
    const manifest = buildRJobManifest({
      jobName: "test",
      image: "img",
      command: "bash",
      purpose: "test",
      priority: 5,
    });
    const cmd = rjobToCommand(manifest);
    expect(cmd).toContain("--priority=5");
  });

  it("rjob command includes host-network flag when set", () => {
    const manifest = buildRJobManifest({
      jobName: "test",
      image: "img",
      command: "bash",
      purpose: "test",
      hostNetwork: true,
    });
    const cmd = rjobToCommand(manifest);
    expect(cmd).toContain("--host-network");
  });
});
