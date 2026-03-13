import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  DEFAULT_CAPABILITIES,
  CAPABILITY_KEYS,
  type CapabilityFlags,
} from "./types";

/** Prefix for capability keys stored in appSettings. */
const PREFIX = "rex_cap_";

/** Build the appSettings key for a workspace + capability pair. */
function capKey(workspaceId: string, flag: keyof CapabilityFlags): string {
  return `${PREFIX}${workspaceId}_${flag}`;
}

/** Read all capability flags for a workspace from appSettings. */
export async function getCapabilities(
  workspaceId: string,
): Promise<CapabilityFlags> {
  const rows = await db.select().from(appSettings);
  const lookup = new Map(rows.map((r) => [r.key, r.value]));

  const flags = { ...DEFAULT_CAPABILITIES };
  for (const key of CAPABILITY_KEYS) {
    const val = lookup.get(capKey(workspaceId, key));
    if (val === "true") {
      flags[key] = true;
    }
  }
  return flags;
}

/** Set a single capability flag for a workspace. */
export async function setCapability(
  workspaceId: string,
  flag: keyof CapabilityFlags,
  value: boolean,
): Promise<void> {
  const key = capKey(workspaceId, flag);
  const strValue = value ? "true" : "false";

  const existing = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);

  if (existing.length > 0) {
    await db.update(appSettings).set({ value: strValue }).where(eq(appSettings.key, key));
  } else {
    await db.insert(appSettings).values({ key, value: strValue });
  }
}

/** Check that a capability is enabled. Returns an error object if not. */
export function requireCapability(
  flags: CapabilityFlags,
  cap: keyof CapabilityFlags,
  actionDescription: string,
): { blocked: true; error: string } | null {
  if (!flags[cap]) {
    return {
      blocked: true,
      error: `CAPABILITY BLOCKED: "${actionDescription}" requires "${cap}" to be enabled. Go to Research Execution → Capabilities to enable it.`,
    };
  }
  return null;
}
