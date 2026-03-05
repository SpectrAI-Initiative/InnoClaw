import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Get the HuggingFace token from DB setting first, then fall back to env var.
 */
export async function getHfToken(): Promise<string | undefined> {
  try {
    const rows = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, "hf_token"))
      .limit(1);
    if (rows.length > 0 && rows[0].value) {
      return rows[0].value;
    }
  } catch {
    // DB not ready, fall back to env
  }
  return process.env.HF_TOKEN || undefined;
}
