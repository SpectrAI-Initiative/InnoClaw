import { describe, expect, it } from "vitest";
import { ALL_TOOLS, EVERY_TOOL, K8S_TOOLS } from "./tool-names";

const GENERIC_K8S_JOB_TOOLS = [
  "prepareK8sJob",
  "runK8sJob",
  "waitForK8sJob",
  "collectK8sJobLogs",
  "cleanupK8sJob",
] as const;

describe("tool name contracts", () => {
  it("registers generic Kubernetes Job tools as high-privilege tools", () => {
    for (const toolName of GENERIC_K8S_JOB_TOOLS) {
      expect(K8S_TOOLS).toContain(toolName);
      expect(EVERY_TOOL).toContain(toolName);
    }
  });

  it("does not grant generic Kubernetes Job tools by default", () => {
    for (const toolName of GENERIC_K8S_JOB_TOOLS) {
      expect(ALL_TOOLS).not.toContain(toolName);
    }
  });
});
