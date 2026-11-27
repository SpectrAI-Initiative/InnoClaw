import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    id: "stub", name: "stub", description: null, ownerUserId: "", plan: "free",
    createdAt: "", updatedAt: "", members: [], workspaces: [],
  });
}