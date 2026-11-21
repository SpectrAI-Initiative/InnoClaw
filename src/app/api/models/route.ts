import { NextRequest, NextResponse } from "next/server";
import { isArchivedProvider } from "@/lib/ai/archived-providers";
import { DEFAULT_PROVIDER, PROVIDERS, type ProviderId } from "@/lib/ai/models";

/**
 * Return the managed model catalog for the active provider.
 * Remote provider model lists are not merged in, so the selectable range
 * stays limited to the catalog in `src/lib/ai/models.ts`.
 */
export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get("provider") || DEFAULT_PROVIDER;

  if (isArchivedProvider(provider)) {
    return NextResponse.json(
      { error: `Provider "${provider}" is archived.` },
      { status: 400 },
    );
  }

  const active = PROVIDERS[provider as ProviderId];
  if (!active) {
    return NextResponse.json(
      { error: `Unsupported provider "${provider}"` },
      { status: 400 },
    );
  }

  return NextResponse.json({
    models: active.models.map((model) => ({ id: model.id, name: model.name })),
  });
}
