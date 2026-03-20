import { NextRequest, NextResponse } from "next/server";
import { getExecutionRecords } from "@/lib/deep-research/event-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  try {
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
