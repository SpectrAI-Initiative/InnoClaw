import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import {
  assessDistDirLocking,
  resolveNextBuildDir,
} from "./src/lib/dev/project-filesystem";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const projectDir = __dirname;
const resolvedBuildDir = resolveNextBuildDir(projectDir, process.env.NEXT_BUILD_DIR);
const distDirLocking = assessDistDirLocking(projectDir, resolvedBuildDir.distDir);

if (resolvedBuildDir.warning) {
  console.warn(`[next.config] ${resolvedBuildDir.warning}`);
}

if (distDirLocking.disableLock) {
  const mountPoint = distDirLocking.mount?.mountPoint ?? projectDir;
  console.warn(
    `[next.config] Detected ${distDirLocking.reason} at ${mountPoint}; disabling Next dist-dir locking so dev/build can run on this mount. SQLite should still use a local DATABASE_URL on network filesystems.`
  );
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const serverExternalPackages = [
  "better-sqlite3",
  "pdf-parse",
  // Turbopack on Windows can panic while creating the junction for this scoped package.
  ...(process.platform === "win32" ? [] : ["@larksuiteoapi/node-sdk"]),
];

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages,
  // Keep distDir inside the project root so Turbopack accepts it.
  ...(resolvedBuildDir.distDir ? { distDir: resolvedBuildDir.distDir } : {}),
  ...(distDirLocking.disableLock
    ? {
        experimental: {
          lockDistDir: false,
        },
      }
    : {}),
  turbopack: {
    // Set the project root explicitly to avoid lockfile detection issues.
    root: projectDir,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
