import { NextRequest, NextResponse } from "next/server";
import { getExecutionRecords } from "@/lib/deep-research/event-store";
import { ensureInterfaceShell, isInterfaceOnlySession } from "@/lib/deep-research/interface-shell";
import { requireSession } from "@/lib/deep-research/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  try {
    const session = await requireSession(sessionId);
    if (isInterfaceOnlySession(session)) {
      await ensureInterfaceShell(session);
    }
    const records = await getExecutionRecords(sessionId);
    return NextResponse.json(records);
  } catch (err) {
    console.error("[api] GET execution records error:", err);
    return NextResponse.json(
      { error: "Failed to fetch execution records" },
      { status: 500 }
    );
  }
}
