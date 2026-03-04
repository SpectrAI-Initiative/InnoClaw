import { NextResponse } from "next/server";
import { getNetworkSpeed } from "@/lib/system/network";

/**
 * GET /api/system/network - Returns current network speed (bytes/sec)
 */
export async function GET() {
  const speed = await getNetworkSpeed();
  return NextResponse.json(speed);
}
