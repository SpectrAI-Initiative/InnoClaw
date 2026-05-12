import { NextRequest, NextResponse } from "next/server";

/** Standard JSON error response for non-streaming API routes. */
export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Plain text error response for streaming API routes. */
export function textError(message: string, status: number) {
  return new Response(message, { status });
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function jsonException(
  error: unknown,
  fallback: string,
  options?: { accessDeniedStatus?: number; status?: number },
) {
  const message = errorMessage(error, fallback);
  const status =
    options?.status ??
    (message.includes("Access denied") ? options?.accessDeniedStatus ?? 403 : 500);
  return jsonError(message, status);
}

export function requiredSearchParam(
  request: NextRequest,
  name: string,
  message = `Missing ${name}`,
): string | NextResponse {
  const value = request.nextUrl.searchParams.get(name);
  if (!value) {
    return jsonError(message, 400);
  }
  return value;
}

export function requiredStringFields(
  body: Record<string, unknown>,
  fields: readonly string[],
  message: string,
): NextResponse | null {
  const missing = fields.some((field) => {
    const value = body[field];
    return typeof value !== "string" || !value.trim();
  });

  return missing ? jsonError(message, 400) : null;
}
