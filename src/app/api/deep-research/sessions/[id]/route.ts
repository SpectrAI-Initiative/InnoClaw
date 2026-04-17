import { NextRequest, NextResponse } from "next/server";
import { getConfiguredModelSelection } from "@/lib/ai/provider";
import { deleteSession, updateSession } from "@/lib/deep-research/event-store";
import { ensureInterfaceShell, isInterfaceOnlySession } from "@/lib/deep-research/interface-shell";
import {
  buildDeepResearchConfigForResolvedModel,
  hasDeepResearchModelConfigDrift,
} from "@/lib/deep-research/model-overrides";
import { runManager } from "@/lib/deep-research/run-manager";
import {
  handleDeepResearchRouteError,
  isRecord,
  parseNullableString,
  parseOptionalString,
  readSessionId,
  requireSession,
  type DeepResearchRouteParams,
} from "@/lib/deep-research/api-helpers";

function isLegacyInterfaceShellSession(session: Awaited<ReturnType<typeof requireSession>>): boolean {
  return session.config.interfaceOnly === true
    && session.config.resolvedModel?.provider === "reserved"
    && session.config.resolvedModel?.modelId === "interface-shell";
}

export async function GET(_req: NextRequest, { params }: DeepResearchRouteParams) {
  try {
    const sessionId = await readSessionId(params);
    const session = await requireSession(sessionId);
    const configuredModel = await getConfiguredModelSelection();
    const resolvedModel = {
      provider: configuredModel.providerId,
      modelId: configuredModel.modelId,
    };
    if (isLegacyInterfaceShellSession(session)) {
      const nextConfig = buildDeepResearchConfigForResolvedModel(
        session.config,
        resolvedModel,
        { interfaceOnly: false },
      );
      await updateSession(sessionId, {
        config: nextConfig,
      });
      return NextResponse.json(await requireSession(sessionId));
    }
    const nextConfig = buildDeepResearchConfigForResolvedModel(session.config, resolvedModel);
    const needsModelSync =
      session.config.interfaceOnly !== true && hasDeepResearchModelConfigDrift(session.config, nextConfig);
    if (needsModelSync) {
      await updateSession(sessionId, {
        config: nextConfig,
      });
      return NextResponse.json(await requireSession(sessionId));
    }
    if (isInterfaceOnlySession(session)) {
      await ensureInterfaceShell(session);
      return NextResponse.json(await requireSession(sessionId));
    }
    return NextResponse.json(session);
  } catch (error) {
    return handleDeepResearchRouteError(error, "Failed to fetch session");
  }
}

export async function DELETE(_req: NextRequest, { params }: DeepResearchRouteParams) {
  try {
    const sessionId = await readSessionId(params);
    await requireSession(sessionId);

    if (runManager.isRunning(sessionId)) {
      runManager.abortRun(sessionId);
    }

    await deleteSession(sessionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleDeepResearchRouteError(error, "Failed to delete session");
  }
}

export async function PATCH(req: NextRequest, { params }: DeepResearchRouteParams) {
  try {
    const sessionId = await readSessionId(params);
    await requireSession(sessionId);
    const configuredModel = await getConfiguredModelSelection();
    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.remoteProfileId !== undefined) {
      updates.remoteProfileId = parseNullableString(body.remoteProfileId, "Invalid remoteProfileId");
    }
    if (body.title !== undefined) {
      updates.title = parseOptionalString(body.title, "Invalid title");
    }
    if (body.modelOverrides !== undefined) {
      if (!isRecord(body.modelOverrides)) {
        return NextResponse.json({ error: "Invalid modelOverrides" }, { status: 400 });
      }
      const session = await requireSession(sessionId);
      const parsedOverrides = parseModelOverridesRecord(body.modelOverrides);
      updates.config = buildDeepResearchConfigForResolvedModel(
        {
          ...session.config,
          modelOverrides: parsedOverrides,
        },
        session.config.resolvedModel ?? {
          provider: configuredModel.providerId,
          modelId: configuredModel.modelId,
        },
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    await updateSession(sessionId, updates as Parameters<typeof updateSession>[1]);
    const updated = await requireSession(sessionId);
    return NextResponse.json(updated);
  } catch (error) {
    return handleDeepResearchRouteError(error, "Failed to update session");
  }
}

function parseModelOverridesRecord(
  value: Record<string, unknown>,
): Record<string, { provider: string; modelId: string }> | undefined {
  const parsedEntries = Object.entries(value).flatMap(([roleId, rawOverride]) => {
    if (!isRecord(rawOverride)) {
      return [];
    }

    const provider = parseOptionalString(rawOverride.provider, `Invalid provider for ${roleId}`);
    const modelId = parseOptionalString(rawOverride.modelId, `Invalid modelId for ${roleId}`);
    if (!provider || !modelId) {
      return [];
    }

    return [[roleId, { provider, modelId }] as const];
  });

  return parsedEntries.length > 0 ? Object.fromEntries(parsedEntries) : undefined;
}
