// =============================================================
// Deep Research — Hardware Detection
// =============================================================
// Auto-detects GPU capabilities (NVIDIA CUDA / Apple MPS / CPU-only)
// and adapts execution context accordingly.
// Ported from AutoResearchClaw's hardware.py.

import { execSync } from "child_process";
import type { HardwareProfile, GpuType, HardwareTier } from "./types";
import { DEFAULT_HARDWARE_DETECTION_CONFIG } from "./config-types";
import type { HardwareDetectionConfig } from "./config-types";

// =============================================================
// Constants
// =============================================================

/** VRAM threshold (MB) — GPUs with less than this are "limited". */
const HIGH_VRAM_THRESHOLD_MB = 8192;

/** Recommended packages by GPU tier. */
const RECOMMENDED_PACKAGES: Record<HardwareTier, string[]> = {
  high: [
    "torch>=2.0",
    "cuda-toolkit",
    "tensorflow[gpu]",
    "jax[cuda12]",
    "xformers",
    "flash-attn",
    "bitsandbytes",
    "deepspeed",
  ],
  limited: [
    "torch>=2.0",
    "transformers",
    "accelerate",
    "bitsandbytes",  // 8-bit/4-bit quantization for limited VRAM
    "peft",
  ],
  cpu_only: [
    "torch",
    "onnxruntime",
    "scikit-learn",
    "numpy",
  ],
};

// =============================================================
// Detection logic
// =============================================================

function detectNvidia(): HardwareProfile | null {
  try {
    const output = execSync(
      "nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits",
      { encoding: "utf-8", timeout: 5000 },
    ).trim();

    if (!output) return null;

    const lines = output.split("\n");
    const firstLine = lines[0]?.trim();
    if (!firstLine) return null;

    // Parse: "NVIDIA RTX 4090, 24564"
    const parts = firstLine.split(",").map((s) => s.trim());
    const gpuName = parts[0] ?? "NVIDIA GPU";
    const vramMb = parseInt(parts[1] ?? "0", 10) || 0;

    const tier: HardwareTier =
      vramMb >= HIGH_VRAM_THRESHOLD_MB ? "high" : "limited";

    return {
      hasGpu: true,
      gpuType: "cuda",
      gpuName,
      vramMb,
      tier,
      warning:
        tier === "limited"
          ? `GPU "${gpuName}" has only ${vramMb}MB VRAM (threshold: ${HIGH_VRAM_THRESHOLD_MB}MB). Large models may require quantization or smaller batch sizes.`
          : "",
      recommendedPackages: RECOMMENDED_PACKAGES[tier],
      adaptCodeGeneration: tier !== "high",
    };
  } catch {
    return null;
  }
}

function detectAppleSilicon(): HardwareProfile | null {
  const isMac = process.platform === "darwin";
  const isArm = process.arch === "arm64";

  if (!isMac || !isArm) return null;

  // Apple Silicon Macs have MPS support
  const tier: HardwareTier = "high"; // Apple Silicon has unified memory

  return {
    hasGpu: true,
    gpuType: "mps",
    gpuName: "Apple Silicon (MPS)",
    vramMb: null, // Unified memory — not separately measurable
    tier,
    warning: "",
    recommendedPackages: [
      "torch>=2.0",
      "transformers",
      "accelerate",
      "mlx",
      "mlx-lm",
    ],
    adaptCodeGeneration: false,
  };
}

function detectCpuOnly(): HardwareProfile {
  return {
    hasGpu: false,
    gpuType: "cpu",
    gpuName: "CPU only",
    vramMb: null,
    tier: "cpu_only",
    warning:
      "No GPU detected. Only CPU-based experiments are supported. GPU-intensive workloads will not be executable.",
    recommendedPackages: RECOMMENDED_PACKAGES.cpu_only,
    adaptCodeGeneration: true,
  };
}

// =============================================================
// Public API
// =============================================================

/**
 * Detect hardware capabilities of the current machine.
 * Detection order: NVIDIA → Apple MPS → CPU-only.
 */
export function detectHardware(
  config?: Partial<HardwareDetectionConfig>,
): HardwareProfile {
  const cfg = { ...DEFAULT_HARDWARE_DETECTION_CONFIG, ...config };

  if (!cfg.enabled) {
    return {
      hasGpu: false,
      gpuType: "cpu",
      gpuName: "Hardware detection disabled",
      vramMb: null,
      tier: "cpu_only",
      warning: "",
      recommendedPackages: [],
      adaptCodeGeneration: false,
    };
  }

  // Try NVIDIA first
  const nvidiaProfile = detectNvidia();
  if (nvidiaProfile) {
    // Apply VRAM threshold from config
    if (
      cfg.highVramThresholdMb &&
      nvidiaProfile.vramMb &&
      nvidiaProfile.vramMb < cfg.highVramThresholdMb
    ) {
      nvidiaProfile.tier = "limited";
      nvidiaProfile.warning = `GPU "${nvidiaProfile.gpuName}" has ${nvidiaProfile.vramMb}MB VRAM (threshold: ${cfg.highVramThresholdMb}MB).`;
    }
    nvidiaProfile.adaptCodeGeneration = cfg.adaptCodeGeneration;
    return nvidiaProfile;
  }

  // Try Apple MPS
  const mpsProfile = detectAppleSilicon();
  if (mpsProfile) {
    mpsProfile.adaptCodeGeneration = cfg.adaptCodeGeneration;
    return mpsProfile;
  }

  // CPU-only fallback
  const cpuProfile = detectCpuOnly();
  cpuProfile.adaptCodeGeneration = cfg.adaptCodeGeneration;
  return cpuProfile;
}

/**
 * Build a hardware-aware prompt block for injection into LLM context.
 * Helps the LLM generate code appropriate for the available hardware.
 */
export function buildHardwarePromptBlock(
  profile: HardwareProfile,
): string {
  if (profile.tier === "high" && !profile.adaptCodeGeneration) {
    return `

## Hardware Context

- GPU: ${profile.gpuName} (${profile.gpuType.toUpperCase()})
- VRAM: ${profile.vramMb ? `${profile.vramMb}MB` : "Unified memory"}
- Tier: HIGH — full GPU capabilities available. Use standard GPU-accelerated code.
`;
  }

  let block = `

## Hardware Context

- GPU: ${profile.gpuName}
- GPU Type: ${profile.gpuType.toUpperCase()}
- VRAM: ${profile.vramMb ? `${profile.vramMb}MB` : "N/A"}
- Tier: ${profile.tier.toUpperCase()}
`;

  if (profile.warning) {
    block += `
⚠️ **Warning**: ${profile.warning}
`;
  }

  if (profile.recommendedPackages.length > 0) {
    block += `
**Recommended packages for this hardware**:
`;
    for (const pkg of profile.recommendedPackages.slice(0, 5)) {
      block += `  - \`${pkg}\`
`;
    }
  }

  if (profile.tier === "limited") {
    block += `
**Guidance for limited VRAM**:
- Use gradient accumulation to simulate larger batch sizes
- Consider 8-bit (bitsandbytes) or 4-bit quantization
- Use mixed precision training (fp16/bf16)
- Enable gradient checkpointing
- Use smaller model variants when possible
`;
  } else if (profile.tier === "cpu_only") {
    block += `
**Guidance for CPU-only execution**:
- Use small models and datasets only
- Prefer scikit-learn, ONNX Runtime, or lightweight frameworks
- Avoid GPU-dependent libraries (CUDA, MPS)
- Limit training to simple architectures
`;
  }

  return block;
}

/**
 * Check if a specific framework/package is compatible with the detected hardware.
 */
export function isPackageCompatible(
  packageName: string,
  profile: HardwareProfile,
): boolean {
  if (profile.tier === "high") return true;

  const cpuOnlyIncompatible = [
    "cuda",
    "cudnn",
    "nccl",
    "tensorrt",
    "triton",
    "flash-attn",
    "xformers",
    "deepspeed",
  ];

  const limitedIncompatible = [
    "deepspeed", // Typically needs lots of VRAM
    "megatron-lm",
  ];

  const pkgLower = packageName.toLowerCase();

  if (profile.tier === "cpu_only") {
    return !cpuOnlyIncompatible.some((p) => pkgLower.includes(p));
  }

  if (profile.tier === "limited") {
    return !limitedIncompatible.some((p) => pkgLower.includes(p));
  }

  return true;
}
