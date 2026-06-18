import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { ApiError } from "./http.mjs";

const COOKIE_NAMES = [
  "innoclaw_session",
  "innoclaw_session_expires",
  "innoclaw_session_sig",
];

const SESSION_DIR = path.join(os.homedir(), ".innoclaw");
const SESSION_FILE = path.join(SESSION_DIR, "cli-sessions.json");

function emptyStore() {
  return {
    version: 1,
    sessions: {},
  };
}

function isKnownCookie(name) {
  return COOKIE_NAMES.includes(name);
}

function parseCookieNameValue(setCookie) {
  const first = setCookie.split(";", 1)[0];
  const index = first.indexOf("=");
  if (index === -1) return null;
  return {
    name: first.slice(0, index).trim(),
    value: first.slice(index + 1).trim(),
  };
}

async function loadStore() {
  try {
    const raw = await readFile(SESSION_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.sessions) {
      return parsed;
    }
    return emptyStore();
  } catch {
    return emptyStore();
  }
}

async function saveStore(store) {
  await mkdir(SESSION_DIR, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") {
    await chmod(SESSION_DIR, 0o700).catch(() => {});
  }
  await writeFile(SESSION_FILE, JSON.stringify(store, null, 2), { encoding: "utf-8", mode: 0o600 });
  if (process.platform !== "win32") {
    await chmod(SESSION_FILE, 0o600).catch(() => {});
  }
}

function getResponseSetCookies(response) {
  const getter = response.headers?.getSetCookie;
  if (typeof getter === "function") {
    return getter.call(response.headers);
  }
  const fallback = response.headers.get("set-cookie");
  return fallback ? [fallback] : [];
}

function buildBrowserCallbackUrl(port) {
  return `http://127.0.0.1:${port}/callback`;
}

function validateCallbackPayload(payload, expectedNonce) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid CLI login handoff payload");
  }
  if (payload.nonce !== expectedNonce) {
    throw new Error("CLI login handoff nonce mismatch");
  }
  if (!payload.cookies || typeof payload.cookies !== "object") {
    throw new Error("CLI login handoff cookies missing");
  }

  for (const name of COOKIE_NAMES) {
    const value = payload.cookies[name];
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`CLI login handoff missing cookie: ${name}`);
    }
  }

  return {
    cookies: payload.cookies,
    user: payload.user ?? null,
    expiresAt: payload.expiresAt ?? payload.cookies.innoclaw_session_expires,
    updatedAt: new Date().toISOString(),
  };
}

export function openBrowser(url, { settleMs = 250 } = {}) {
  let command;
  let args;

  if (process.platform === "darwin") {
    command = "open";
    args = [url];
  } else if (process.platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        detached: true,
        stdio: "ignore",
        shell: false,
      });
    } catch {
      resolve(false);
      return;
    }

    let settled = false;
    let timer = null;

    function finish(opened) {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      child.off("exit", onExit);
      if (opened) {
        child.off("error", onError);
        child.on("error", () => {});
        child.unref();
      } else {
        child.off("error", onError);
      }
      resolve(opened);
    }

    function onError() {
      finish(false);
    }

    function onExit(code) {
      if (code !== 0) {
        finish(false);
      }
    }

    child.once("error", onError);
    child.once("exit", onExit);
    timer = setTimeout(() => finish(true), settleMs);
  });
}

async function waitForBrowserSession({ baseUrl, timeoutMs = 5 * 60_000 }) {
  const nonce = randomUUID();
  const allowedOrigins = new Set([
    baseUrl,
    baseUrl.replace("localhost", "127.0.0.1"),
    baseUrl.replace("127.0.0.1", "localhost"),
  ]);

  let resolved = false;
  let resolvePayload;
  let rejectPayload;
  const payloadPromise = new Promise((resolve, reject) => {
    resolvePayload = resolve;
    rejectPayload = reject;
  });

  const server = createServer((req, res) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== "POST" || req.url !== "/callback") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf-8");
        const payload = JSON.parse(body);
        const session = validateCallbackPayload(payload, nonce);
        resolved = true;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          ok: true,
          message: "CLI login complete. Return to the terminal.",
        }));
        resolvePayload(session);
      } catch (error) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          error: error instanceof Error ? error.message : "Invalid callback payload",
        }));
      }
    });
  });

  await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  if (!port) {
    server.close();
    throw new Error("Failed to allocate a CLI login callback port");
  }

  const loginUrl = new URL(`${baseUrl}/login`);
  loginUrl.searchParams.set("next", "/");
  loginUrl.searchParams.set("cliCallback", buildBrowserCallbackUrl(port));
  loginUrl.searchParams.set("cliNonce", nonce);

  const opened = await openBrowser(loginUrl.toString());
  if (!opened) {
    console.log(`[innoclaw] Open this URL in your browser to sign in:\n${loginUrl.toString()}`);
  }

  console.log("[innoclaw] Waiting for browser login...");

  const timeout = setTimeout(() => {
    if (!resolved) {
      rejectPayload(new Error("Timed out waiting for browser login"));
    }
  }, timeoutMs);

  try {
    return await payloadPromise;
  } finally {
    clearTimeout(timeout);
    server.close();
  }
}

export function createSessionManager(baseUrl, apiClientFactory) {
  let session = null;

  async function load() {
    const store = await loadStore();
    session = store.sessions[baseUrl] ?? null;
    return session;
  }

  async function persist(nextSession) {
    const store = await loadStore();
    if (nextSession) {
      store.sessions[baseUrl] = nextSession;
    } else {
      delete store.sessions[baseUrl];
    }
    await saveStore(store);
    session = nextSession;
    return session;
  }

  function getCookieHeader() {
    if (!session?.cookies) {
      return "";
    }
    return COOKIE_NAMES
      .map((name) => {
        const value = session.cookies[name];
        if (typeof value !== "string" || value.length === 0) {
          return null;
        }
        return `${name}=${value}`;
      })
      .filter((value) => typeof value === "string")
      .join("; ");
  }

  async function updateFromResponse(response) {
    const setCookies = getResponseSetCookies(response);
    if (!setCookies.length) {
      return session;
    }

    const nextCookies = { ...(session?.cookies ?? {}) };
    let changed = false;

    for (const raw of setCookies) {
      const parsed = parseCookieNameValue(raw);
      if (!parsed || !isKnownCookie(parsed.name)) {
        continue;
      }
      nextCookies[parsed.name] = parsed.value;
      changed = true;
    }

    if (!changed) {
      return session;
    }

    const nextSession = {
      ...(session ?? {}),
      cookies: nextCookies,
      expiresAt: nextCookies.innoclaw_session_expires ?? session?.expiresAt ?? null,
      updatedAt: new Date().toISOString(),
    };
    return persist(nextSession);
  }

  const apiClient = apiClientFactory({
    getCookieHeader,
    onResponse: updateFromResponse,
  });

  async function ensureAuthenticated({ interactive = true } = {}) {
    try {
      await apiClient.requestJson("/api/workspaces", { timeoutMs: 5_000 });
      return session;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error;
      }
    }

    if (session) {
      await persist(null);
    }

    if (!interactive) {
      throw new Error("Authentication required. Run `innoclaw auth login` or `innoclaw` to complete browser sign-in.");
    }

    const browserSession = await waitForBrowserSession({ baseUrl });
    await persist(browserSession);
    try {
      await apiClient.requestJson("/api/workspaces", { timeoutMs: 5_000 });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await persist(null);
        throw new Error("Browser sign-in completed, but the CLI session was rejected. Please try again.");
      }
      throw error;
    }
    return session;
  }

  async function revoke() {
    try {
      if (session) {
        await apiClient.requestJson("/api/auth/logout", {
          method: "POST",
          body: {},
          timeoutMs: 10_000,
        });
      }
    } catch {
      // Clear local state even if the server session is already invalid.
    } finally {
      await persist(null);
    }
  }

  async function getAuthStatus() {
    try {
      const { payload } = await apiClient.requestJson("/api/auth/me", { timeoutMs: 5_000 });
      return {
        authenticated: true,
        user: payload.user,
        session: payload.session,
      };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return {
          authenticated: false,
          user: session?.user ?? null,
          session: session ? { expiresAt: session.expiresAt } : null,
        };
      }
      throw error;
    }
  }

  return {
    apiClient,
    load,
    getSession: () => session,
    getCookieHeader,
    ensureAuthenticated,
    getAuthStatus,
    updateFromResponse,
    revoke,
    clear: () => persist(null),
    save: persist,
  };
}
