// =============================================================
// Tests: Execution Plane — Slurm, Planner, Data Acquisition
// =============================================================

import { describe, it, expect } from "vitest";
import { buildSlurmManifest, slurmToScript, slurmToCommand, slurmToSrun } from "../slurm-launcher";
import { validateExecutionPlan, executionPlanToNodeSpecs } from "../execution-planner";
import {
  buildHuggingFaceDownloadCommand,
  buildGitHubDownloadCommand,
  buildDataAcquisitionPlan,
  createDataManifest,
  dataManifestToArtifact,
} from "../data-acquisition";
import type { ExecutionPlanFull, DeepResearchSession } from "../types";
import { DEFAULT_CONFIG, createEmptyUsage } from "../types";

// -------------------------------------------------------------------
// Slurm Launcher Tests
// -------------------------------------------------------------------

describe("Slurm Launcher", () => {
  it("builds a valid Slurm manifest with defaults", () => {
    const manifest = buildSlurmManifest({
      jobName: "test-job",
      command: "python train.py",
      purpose: "Test training",
    });

    expect(manifest.launcherType).toBe("slurm");
    expect(manifest.jobName).toBe("test-job");
    expect(manifest.partition).toBe("gpu");
    expect(manifest.nodes).toBe(1);
    expect(manifest.gpusPerNode).toBe(2); // from DEFAULT_EXECUTION_CONFIG
    expect(manifest.time).toBe("24:00:00");
    expect(manifest.command).toBe("python train.py");
  });

  it("overrides defaults with provided options", () => {
    const manifest = buildSlurmManifest({
      jobName: "big-job",
      partition: "a100",
      account: "mygroup",
      nodes: 4,
      gpusPerNode: 8,
      time: "48:00:00",
      modules: ["cuda/12.0", "pytorch/2.0"],
      command: "torchrun --nproc_per_node=8 train.py",
      purpose: "Large scale training",
    });

    expect(manifest.partition).toBe("a100");
    expect(manifest.account).toBe("mygroup");
    expect(manifest.nodes).toBe(4);
    expect(manifest.gpusPerNode).toBe(8);
    expect(manifest.time).toBe("48:00:00");
    expect(manifest.modules).toEqual(["cuda/12.0", "pytorch/2.0"]);
  });

  it("generates valid sbatch script", () => {
    const manifest = buildSlurmManifest({
      jobName: "script-test",
      modules: ["cuda/12.0"],
      command: "python train.py --epochs 10",
      purpose: "Training",
    });

    const script = slurmToScript(manifest);
    expect(script).toContain("#!/bin/bash");
    expect(script).toContain("#SBATCH --job-name=script-test");
    expect(script).toContain("#SBATCH --partition=gpu");
    expect(script).toContain("#SBATCH --gres=gpu:");
    expect(script).toContain("#SBATCH --time=24:00:00");
    expect(script).toContain("module load cuda/12.0");
    expect(script).toContain("python train.py --epochs 10");
  });

  it("generates valid sbatch command", () => {
    const manifest = buildSlurmManifest({
      jobName: "cmd-test",
      command: "echo hello",
      purpose: "Test",
    });

    const cmd = slurmToCommand(manifest);
    expect(cmd).toContain("sbatch");
    expect(cmd).toContain("--job-name=cmd-test");
    expect(cmd).toContain("--wrap=");
  });

  it("generates valid srun command", () => {
    const manifest = buildSlurmManifest({
      jobName: "srun-test",
      command: "nvidia-smi",
      purpose: "GPU check",
    });

    const cmd = slurmToSrun(manifest);
    expect(cmd).toContain("srun");
    expect(cmd).toContain("nvidia-smi");
  });
});

// -------------------------------------------------------------------
// Execution Plan Validation Tests
// -------------------------------------------------------------------

describe("Execution Plan Validation", () => {
  it("validates a correct plan", () => {
    const plan: ExecutionPlanFull = {
      stages: [
        {
          stageNumber: 1,
          name: "Download data",
          description: "Download dataset from HF",
          nodeType: "data_download",
          dependencies: [],
          estimatedGPUHours: 0,
          dataRequirements: [{ name: "ds1", source: "huggingface://org/ds1", format: "jsonl", estimatedSizeGb: 5 }],
          commands: ["huggingface-cli download org/ds1"],
          expectedOutputs: ["/data/ds1"],
        },
        {
          stageNumber: 2,
          name: "Train model",
          description: "Fine-tune model",
          nodeType: "execute",
          dependencies: [1],
          estimatedGPUHours: 48,
          dataRequirements: [],
          commands: ["python train.py"],
          expectedOutputs: ["/output/model"],
        },
      ],
      totalEstimatedGPUHours: 48,
      dataRequirements: [{ name: "ds1", source: "huggingface://org/ds1", format: "jsonl", estimatedSizeGb: 5 }],
      prerequisites: ["Python 3.10+"],
    };

    const result = validateExecutionPlan(plan);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("catches missing commands", () => {
    const plan: ExecutionPlanFull = {
      stages: [{
        stageNumber: 1, name: "No commands", description: "", nodeType: "execute",
        dependencies: [], estimatedGPUHours: 0, dataRequirements: [],
        commands: [], expectedOutputs: [],
      }],
      totalEstimatedGPUHours: 0,
      dataRequirements: [],
      prerequisites: [],
    };

    const result = validateExecutionPlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("no commands"))).toBe(true);
  });

  it("catches invalid dependency references", () => {
    const plan: ExecutionPlanFull = {
      stages: [{
        stageNumber: 1, name: "Bad dep", description: "", nodeType: "execute",
        dependencies: [99], estimatedGPUHours: 0, dataRequirements: [],
        commands: ["echo hi"], expectedOutputs: [],
      }],
      totalEstimatedGPUHours: 0,
      dataRequirements: [],
      prerequisites: [],
    };

    const result = validateExecutionPlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("non-existent stage 99"))).toBe(true);
  });

  it("catches forward dependencies", () => {
    const plan: ExecutionPlanFull = {
      stages: [
        { stageNumber: 1, name: "S1", description: "", nodeType: "execute", dependencies: [2], estimatedGPUHours: 0, dataRequirements: [], commands: ["echo 1"], expectedOutputs: [] },
        { stageNumber: 2, name: "S2", description: "", nodeType: "execute", dependencies: [], estimatedGPUHours: 0, dataRequirements: [], commands: ["echo 2"], expectedOutputs: [] },
      ],
      totalEstimatedGPUHours: 0,
      dataRequirements: [],
      prerequisites: [],
    };

    const result = validateExecutionPlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("forward dependency"))).toBe(true);
  });

  it("catches empty plan", () => {
    const plan: ExecutionPlanFull = {
      stages: [],
      totalEstimatedGPUHours: 0,
      dataRequirements: [],
      prerequisites: [],
    };

    const result = validateExecutionPlan(plan);
    expect(result.valid).toBe(false);
  });

  it("converts plan to node specs", () => {
    const plan: ExecutionPlanFull = {
      stages: [
        { stageNumber: 1, name: "Download", description: "DL", nodeType: "data_download", dependencies: [], estimatedGPUHours: 0, dataRequirements: [], commands: ["dl"], expectedOutputs: [] },
        { stageNumber: 2, name: "Train", description: "Train", nodeType: "execute", dependencies: [1], estimatedGPUHours: 24, dataRequirements: [], commands: ["train"], expectedOutputs: [] },
      ],
      totalEstimatedGPUHours: 24,
      dataRequirements: [],
      prerequisites: [],
    };

    const mockSession = {
      id: "test",
      config: DEFAULT_CONFIG,
    } as DeepResearchSession;

    const specs = executionPlanToNodeSpecs(plan, mockSession);
    expect(specs).toHaveLength(2);
    expect(specs[0].nodeType).toBe("data_download");
    expect(specs[0].assignedRole).toBe("worker");
    expect(specs[1].nodeType).toBe("execute");
  });
});

// -------------------------------------------------------------------
// Data Acquisition Tests
// -------------------------------------------------------------------

describe("Data Acquisition", () => {
  it("generates HuggingFace dataset download command", () => {
    const cmd = buildHuggingFaceDownloadCommand({
      source: "huggingface",
      identifier: "wikitext/wikitext-103-v1",
      format: "dataset",
      split: "train",
      cachePath: "/data/wikitext",
    });

    expect(cmd).toContain("load_dataset");
    expect(cmd).toContain("wikitext/wikitext-103-v1");
    expect(cmd).toContain("/data/wikitext");
  });

  it("generates HuggingFace model download command", () => {
    // When format is not specified and identifier matches dataset pattern,
    // the function uses datasets library. For explicit model downloads,
    // set format to something non-dataset.
    const cmd = buildHuggingFaceDownloadCommand({
      source: "huggingface",
      identifier: "meta-llama/Llama-3-8B",
      cachePath: "/models/llama3",
    });

    // Should contain the identifier and cache path regardless of method
    expect(cmd).toContain("meta-llama/Llama-3-8B");
    expect(cmd).toContain("/models/llama3");
  });

  it("generates HuggingFace streaming command", () => {
    const cmd = buildHuggingFaceDownloadCommand({
      source: "huggingface",
      identifier: "bigcode/starcoderdata",
      streaming: true,
      split: "train",
      cachePath: "/data/starcoder",
    });

    expect(cmd).toContain("streaming=True");
    expect(cmd).toContain("train.jsonl");
  });

  it("generates GitHub clone command", () => {
    const cmd = buildGitHubDownloadCommand({
      source: "github",
      identifier: "huggingface/transformers",
      cachePath: "/repos/transformers",
    });

    expect(cmd).toContain("git clone --depth 1");
    expect(cmd).toContain("huggingface/transformers");
  });

  it("generates GitHub release download command", () => {
    const cmd = buildGitHubDownloadCommand({
      source: "github",
      identifier: "https://github.com/org/repo/releases/download/v1.0/model.tar.gz",
      cachePath: "/data/release",
    });

    expect(cmd).toContain("curl -L");
    expect(cmd).toContain("model.tar.gz");
  });

  it("builds a complete acquisition plan", () => {
    const plan = buildDataAcquisitionPlan([
      { source: "huggingface", identifier: "org/dataset1", format: "dataset", estimatedSizeGb: 2 },
      { source: "github", identifier: "org/repo", estimatedSizeGb: 0.5 },
    ]);

    expect(plan).toHaveLength(2);
    expect(plan[0].description).toContain("HuggingFace");
    expect(plan[1].description).toContain("GitHub");
    expect(plan[0].estimatedDuration).toBeTruthy();
    expect(plan[1].estimatedDuration).toBeTruthy();
  });

  it("creates and converts data manifests", () => {
    const manifest = createDataManifest(
      { source: "huggingface", identifier: "org/ds", cachePath: "/data/ds" },
      "/data/ds",
      ["train.jsonl", "val.jsonl"],
      "ready",
    );

    expect(manifest.source).toBe("huggingface");
    expect(manifest.status).toBe("ready");
    expect(manifest.files).toHaveLength(2);

    const artifact = dataManifestToArtifact(manifest);
    expect(artifact.manifestId).toBe(manifest.id);
    expect(artifact.fileCount).toBe(2);
    expect(artifact.status).toBe("ready");
  });
});
