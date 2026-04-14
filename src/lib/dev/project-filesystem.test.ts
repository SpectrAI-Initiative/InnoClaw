import { describe, expect, it } from "vitest";

import {
  assessPathLocking,
  assessDistDirLocking,
  findMountForPath,
  parseLinuxMountInfo,
  resolveNextBuildDir,
} from "./project-filesystem";

describe("project-filesystem", () => {
  it("parses linux mountinfo entries", () => {
    const mounts = parseLinuxMountInfo(
      [
        "145 128 0:44 / / rw,relatime - overlay overlay rw,lowerdir=/lower,upperdir=/upper,workdir=/work",
        "201 145 0:49 / /mnt/data rw,relatime - nfs 10.0.0.1:/share rw,vers=3,local_lock=none",
      ].join("\n")
    );

    expect(mounts).toHaveLength(2);
    expect(mounts[1]).toMatchObject({
      mountPoint: "/mnt/data",
      fsType: "nfs",
    });
    expect(mounts[1].superOptions).toContain("local_lock=none");
  });

  it("finds the most specific mount for a path", () => {
    const mounts = parseLinuxMountInfo(
      [
        "145 128 0:44 / / rw,relatime - overlay overlay rw",
        "201 145 0:49 / /mnt rw,relatime - nfs 10.0.0.1:/mnt rw,vers=3",
        "202 201 0:50 / /mnt/data rw,relatime - nfs 10.0.0.1:/data rw,vers=3,local_lock=none",
      ].join("\n")
    );

    const mount = findMountForPath("/mnt/data/project", mounts);

    expect(mount?.mountPoint).toBe("/mnt/data");
    expect(mount?.fsType).toBe("nfs");
  });

  it("disables dist-dir locking on lockless network filesystems", () => {
    const assessment = assessDistDirLocking(
      "/mnt/data/project",
      "202 201 0:50 / /mnt/data rw,relatime - nfs 10.0.0.1:/data rw,vers=3,local_lock=none"
    );

    expect(assessment.disableLock).toBe(true);
    expect(assessment.reason).toContain("filesystem type is nfs");
    expect(assessment.reason).toContain("mount option local_lock=none");
  });

  it("keeps dist-dir locking on normal local filesystems", () => {
    const assessment = assessDistDirLocking(
      "/workspace/project",
      "145 128 0:44 / /workspace rw,relatime - ext4 /dev/sda1 rw"
    );

    expect(assessment.disableLock).toBe(false);
  });

  it("assesses arbitrary paths on lockless mounts", () => {
    const assessment = assessPathLocking(
      "/mnt/data/project/data/innoclaw.db",
      "202 201 0:50 / /mnt/data rw,relatime - nfs 10.0.0.1:/data rw,vers=3,local_lock=none"
    );

    expect(assessment.disableLock).toBe(true);
    expect(assessment.mount?.mountPoint).toBe("/mnt/data");
  });

  it("normalizes in-project NEXT_BUILD_DIR values", () => {
    const resolved = resolveNextBuildDir(
      "/workspace/project",
      "/workspace/project/.next-local"
    );

    expect(resolved).toEqual({ distDir: ".next-local" });
  });

  it("rejects NEXT_BUILD_DIR values that escape the project root", () => {
    const resolved = resolveNextBuildDir(
      "/workspace/project",
      "/tmp/innoclaw-next"
    );

    expect(resolved.distDir).toBeUndefined();
    expect(resolved.warning).toContain("requires distDir to stay within the project root");
  });

  it("rejects NEXT_BUILD_DIR values that point at the project root itself", () => {
    const resolved = resolveNextBuildDir("/workspace/project", ".");

    expect(resolved.distDir).toBeUndefined();
    expect(resolved.warning).toContain("project root");
  });
});
