import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "pdf-parse"],
  // Allow overriding the .next build directory via env var.
  // Useful on network/shared filesystems where Turbopack cache persistence fails.
  ...(process.env.NEXT_BUILD_DIR ? { distDir: process.env.NEXT_BUILD_DIR } : {}),
  turbopack: {
    // Set the project root explicitly to avoid lockfile detection issues.
    root: __dirname,
  },
};

export default withNextIntl(nextConfig);
