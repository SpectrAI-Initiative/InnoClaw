import { getBaseUrlCandidates } from "./runtime.mjs";

async function pingServer(baseUrl) {
  for (const candidate of getBaseUrlCandidates(baseUrl)) {
    try {
      const response = await fetch(`${candidate}/api/auth/me`, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(3_000),
      });
      const contentType = response.headers?.get?.("content-type") ?? "";
      if (!contentType.toLowerCase().includes("application/json")) {
        continue;
      }
      const body = await response.json();
      if (
        response.status === 200
        && body
        && typeof body.authMode === "string"
        && body.user
      ) {
        return true;
      }
      if (response.status === 401 && body?.error === "Unauthorized") {
        return true;
      }
    } catch {
      // Try the next local candidate when available.
    }
  }
  return false;
}

export async function ensureServerReady({ baseUrl }) {
  if (await pingServer(baseUrl)) {
    return;
  }

  throw new Error(
    `InnoScale is not reachable at ${baseUrl}. Start the container with scripts/docker-up-local.ps1 or scripts/docker-up-local.sh.`,
  );
}
