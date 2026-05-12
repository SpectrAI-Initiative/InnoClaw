import { NextRequest, NextResponse } from "next/server";
import { getCapabilities, setCapability } from "@/lib/research-exec/capabilities";
import { CAPABILITY_KEYS, type CapabilityFlags } from "@/lib/research-exec/types";
import { requireWorkspaceAccess } from "@/lib/auth/ownership";
import { jsonError, jsonException, requiredSearchParam } from "@/lib/api-errors";

export async function GET(req: NextRequest) {
  const workspaceId = requiredSearchParam(req, "workspaceId");
  if (workspaceId instanceof NextResponse) {
    return workspaceId;
  }
  const access = await requireWorkspaceAccess(req, workspaceId);
  if (access instanceof NextResponse) {
    return access;
  }

  const caps = await getCapabilities(workspaceId);
  return NextResponse.json(caps);
}

export async function PATCH(req: NextRequest) {
  try {
    const { workspaceId, flag, value } = await req.json();

    if (!workspaceId || typeof workspaceId !== "string") {
      return jsonError("Missing workspaceId", 400);
    }
    const access = await requireWorkspaceAccess(req, workspaceId);
    if (access instanceof NextResponse) {
      return access;
    }

    if (!flag || !CAPABILITY_KEYS.includes(flag as keyof CapabilityFlags)) {
      return jsonError(`Invalid flag. Must be one of: ${CAPABILITY_KEYS.join(", ")}`, 400);
    }

    if (typeof value !== "boolean") {
      return jsonError("value must be a boolean", 400);
    }

    await setCapability(workspaceId, flag as keyof CapabilityFlags, value);
    const updated = await getCapabilities(workspaceId);
    return NextResponse.json(updated);
  } catch (error) {
    return jsonException(error, "Failed to update capability");
  }
}
