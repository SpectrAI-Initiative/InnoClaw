import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env.local so DATABASE_URL is available when running `npx drizzle-kit migrate`
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL || "./data/notebooklm.db",
  },
});
