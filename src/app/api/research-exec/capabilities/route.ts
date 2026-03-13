import { NextRequest, NextResponse } from "next/server";
import { getCapabilities, setCapability } from "@/lib/research-exec/capabilities";
import { CAPABILITY_KEYS, type CapabilityFlags } from "@/lib/research-exec/types";

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
  }

  const caps = await getCapabilities(workspaceId);
  return NextResponse.json(caps);
}

export async function PATCH(req: NextRequest) {
  try {
    const { workspaceId, flag, value } = await req.json();

    if (!workspaceId || typeof workspaceId !== "string") {
      return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
    }

    if (!flag || !CAPABILITY_KEYS.includes(flag as keyof CapabilityFlags)) {
      return NextResponse.json(
        { error: `Invalid flag. Must be one of: ${CAPABILITY_KEYS.join(", ")}` },
        { status: 400 },
      );
    }

    if (typeof value !== "boolean") {
      return NextResponse.json({ error: "value must be a boolean" }, { status: 400 });
    }

    await setCapability(workspaceId, flag as keyof CapabilityFlags, value);
    const updated = await getCapabilities(workspaceId);
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update capability";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
