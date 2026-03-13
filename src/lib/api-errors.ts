import { NextResponse } from "next/server";

/** Standard JSON error response for non-streaming API routes. */
export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Plain text error response for streaming API routes. */
export function textError(message: string, status: number) {
  return new Response(message, { status });
}
