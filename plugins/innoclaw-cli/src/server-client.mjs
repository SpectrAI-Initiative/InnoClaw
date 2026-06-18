import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { getBaseUrlCandidates, isLocalBaseUrl } from "./runtime.mjs";

async function pingServer(baseUrl) {
  for (const candidate of getBaseUrlCandidates(baseUrl)) {
    try {
      const response = await fetch(`${candidate}/api/auth/me`, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(3_000),
      });
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

function startLocalServer(appRoot) {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", ["dev-start.sh"], {
      cwd: appRoot,
      stdio: "inherit",
      shell: false,
    });
    child.on("exit", (code, signal) => {
      resolve({
        code: code ?? 0,
        signal: signal ?? null,
      });
    });
    child.on("error", reject);
  });
}

export async function ensureServerReady({
  appRoot,
  baseUrl,
  autoStart = true,
  waitTimeoutMs = 90_000,
}) {
  if (await pingServer(baseUrl)) {
    return;
  }

  if (!autoStart || !isLocalBaseUrl(baseUrl)) {
    throw new Error(`InnoClaw is not reachable at ${baseUrl}`);
  }

  const launchResult = await startLocalServer(appRoot);

  const deadline = Date.now() + waitTimeoutMs;
  while (Date.now() < deadline) {
    if (await pingServer(baseUrl)) {
      return;
    }
    await delay(1_000);
  }

  if (launchResult.code !== 0) {
    throw new Error(
      `Timed out waiting for InnoClaw to start at ${baseUrl} after dev-start.sh exited with code ${launchResult.code}`,
    );
  }

  if (launchResult.signal) {
    throw new Error(
      `Timed out waiting for InnoClaw to start at ${baseUrl} after dev-start.sh ended with signal ${launchResult.signal}`,
    );
  }

  throw new Error(`Timed out waiting for InnoClaw to start at ${baseUrl}`);
}
