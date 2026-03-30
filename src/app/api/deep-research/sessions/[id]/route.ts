import { NextRequest, NextResponse } from "next/server";
import { getConfiguredModelSelection } from "@/lib/ai/provider";
import { deleteSession, updateSession } from "@/lib/deep-research/event-store";
import { ensureInterfaceShell, isInterfaceOnlySession } from "@/lib/deep-research/interface-shell";
import { runManager } from "@/lib/deep-research/run-manager";
import {
  handleDeepResearchRouteError,
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
    if (isLegacyInterfaceShellSession(session)) {
      await updateSession(sessionId, {
        config: {
          ...session.config,
          interfaceOnly: false,
          resolvedModel: {
            provider: configuredModel.providerId,
            modelId: configuredModel.modelId,
          },
          modelOverrides: undefined,
        },
      });
      return NextResponse.json(await requireSession(sessionId));
    }
    const needsModelSync =
      session.config.interfaceOnly !== true && (
        session.config.resolvedModel?.provider !== configuredModel.providerId
        || session.config.resolvedModel?.modelId !== configuredModel.modelId
        || session.config.modelOverrides !== undefined
      );
    if (needsModelSync) {
      await updateSession(sessionId, {
        config: {
          ...session.config,
          resolvedModel: {
            provider: configuredModel.providerId,
            modelId: configuredModel.modelId,
          },
          modelOverrides: undefined,
        },
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
    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.remoteProfileId !== undefined) {
      updates.remoteProfileId = parseNullableString(body.remoteProfileId, "Invalid remoteProfileId");
    }
    if (body.title !== undefined) {
      updates.title = parseOptionalString(body.title, "Invalid title");
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
