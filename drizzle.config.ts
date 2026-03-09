import { defineConfig } from "drizzle-kit";
import fs from "fs";

// Load .env.local so DATABASE_URL is available when running `npx drizzle-kit migrate`.
// Inline loader avoids adding a `dotenv` dependency.
try {
  const envLocal = fs.readFileSync(".env.local", "utf-8");
  for (const line of envLocal.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  // .env.local may not exist; that's fine – DATABASE_URL will use the default.
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL || "./data/vibelab.db",
  },
});
