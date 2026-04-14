import fs from "node:fs";
import path from "node:path";

export type LinuxMountInfo = {
  mountPoint: string;
  fsType: string;
  mountOptions: string[];
  superOptions: string[];
};

export type DistDirLockAssessment = {
  disableLock: boolean;
  mount?: LinuxMountInfo;
  reason?: string;
};

export type ResolvedNextBuildDir = {
  distDir?: string;
  warning?: string;
};

const LOCKLESS_OPTIONS = new Set(["local_lock=none", "nolock"]);
const NETWORK_FILESYSTEM_TYPES = new Set([
  "9p",
  "afs",
  "ceph",
  "cifs",
  "fuse.sshfs",
  "glusterfs",
  "lustre",
  "nfs",
  "nfs4",
  "smb3",
  "sshfs",
]);

function decodeMountPath(value: string): string {
  return value.replace(/\\([0-7]{3})/g, (_, octal: string) =>
    String.fromCharCode(Number.parseInt(octal, 8))
  );
}

function isPathWithinMount(targetPath: string, mountPoint: string): boolean {
  const normalizedTarget = path.resolve(targetPath);
  const normalizedMountPoint = path.resolve(mountPoint);

  if (normalizedTarget === normalizedMountPoint) {
    return true;
  }

  const prefix = normalizedMountPoint.endsWith(path.sep)
    ? normalizedMountPoint
    : `${normalizedMountPoint}${path.sep}`;

  return normalizedTarget.startsWith(prefix);
}

function escapesProjectRoot(relativePath: string): boolean {
  return (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  );
}

export function parseLinuxMountInfo(content: string): LinuxMountInfo[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const [beforeSeparator, afterSeparator] = line.split(" - ");

      if (!beforeSeparator || !afterSeparator) {
        return [];
      }

      const beforeFields = beforeSeparator.split(" ");
      const afterFields = afterSeparator.split(" ");

      if (beforeFields.length < 6 || afterFields.length < 3) {
        return [];
      }

      return [
        {
          mountPoint: decodeMountPath(beforeFields[4]),
          fsType: afterFields[0],
          mountOptions: beforeFields[5].split(",").filter(Boolean),
          superOptions: afterFields[2].split(",").filter(Boolean),
        },
      ];
    });
}

export function findMountForPath(
  targetPath: string,
  mounts: LinuxMountInfo[]
): LinuxMountInfo | null {
  let bestMatch: LinuxMountInfo | null = null;

  for (const mount of mounts) {
    if (!isPathWithinMount(targetPath, mount.mountPoint)) {
      continue;
    }

    if (!bestMatch || mount.mountPoint.length > bestMatch.mountPoint.length) {
      bestMatch = mount;
    }
  }

  return bestMatch;
}

export function assessPathLocking(
  targetPath: string,
  mountInfoContent?: string
): DistDirLockAssessment {
  if (process.platform !== "linux") {
    return { disableLock: false };
  }

  try {
    const mounts = parseLinuxMountInfo(
      mountInfoContent ?? fs.readFileSync("/proc/self/mountinfo", "utf8")
    );
    const mount = findMountForPath(targetPath, mounts);

    if (!mount) {
      return { disableLock: false };
    }

    const options = new Set(
      [...mount.mountOptions, ...mount.superOptions].map((option) =>
        option.toLowerCase()
      )
    );

    const reasons: string[] = [];
    if (NETWORK_FILESYSTEM_TYPES.has(mount.fsType.toLowerCase())) {
      reasons.push(`filesystem type is ${mount.fsType}`);
    }

    for (const option of LOCKLESS_OPTIONS) {
      if (options.has(option)) {
        reasons.push(`mount option ${option}`);
      }
    }

    return {
      disableLock: reasons.length > 0,
      mount,
      reason: reasons.join("; "),
    };
  } catch {
    return { disableLock: false };
  }
}

export function assessDistDirLocking(
  projectDir: string,
  distDir?: string,
  mountInfoContent?: string
): DistDirLockAssessment {
  const distDirPath = path.resolve(projectDir, distDir ?? ".next");
  return assessPathLocking(distDirPath, mountInfoContent);
}

export function resolveNextBuildDir(
  projectDir: string,
  rawValue: string | undefined
): ResolvedNextBuildDir {
  const trimmedValue = rawValue?.trim();

  if (!trimmedValue) {
    return {};
  }

  const candidatePath = path.resolve(projectDir, trimmedValue);
  const relativePath = path.relative(projectDir, candidatePath);

  if (!relativePath) {
    return {
      warning:
        "Ignoring NEXT_BUILD_DIR because it resolves to the project root. Use a subdirectory such as .next-local.",
    };
  }

  if (escapesProjectRoot(relativePath)) {
    return {
      warning:
        `Ignoring NEXT_BUILD_DIR=${trimmedValue} because Next.js/Turbopack requires distDir to stay within the project root.`,
    };
  }

  return {
    distDir: relativePath,
  };
}
