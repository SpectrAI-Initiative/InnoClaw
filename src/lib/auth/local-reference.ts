import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceProvisioningPathsAccess } from "./ownership";

function isRemoteOrIdentifier(reference: string): boolean {
  return (
    reference.length === 0 ||
    /^https?:\/\//i.test(reference) ||
    /^(?:doi:\s*)?10\.\d{4,9}\/\S+$/i.test(reference)
  );
}

export async function requireLocalReferenceAccess(
  request: NextRequest,
  reference: string,
): Promise<{ canonicalReference: string } | NextResponse> {
  if (isRemoteOrIdentifier(reference) || !path.isAbsolute(reference)) {
    return { canonicalReference: reference };
  }

  const access = await requireWorkspaceProvisioningPathsAccess(request, [
    reference,
  ]);
  if (access instanceof NextResponse) {
    return access;
  }

  return { canonicalReference: access.canonicalPaths[0] };
}
