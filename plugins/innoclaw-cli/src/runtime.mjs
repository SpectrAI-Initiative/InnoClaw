import path from "node:path";
import { fileURLToPath } from "node:url";

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

export function normalizeBaseUrl(value) {
  const raw = typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "http://localhost:3000";
  return trimTrailingSlash(raw);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const APP_ROOT = path.resolve(__dirname, "../../..");
export const DEFAULT_WORKSPACE_CWD = process.cwd();
export const DEFAULT_BASE_URL = normalizeBaseUrl(
  process.env.INNOCLAW_BASE_URL || "http://localhost:3000",
);

export function getWorkspaceName(folderPath) {
  const cleaned = path.resolve(folderPath);
  const base = path.basename(cleaned);
  return base && base !== path.sep ? base : cleaned;
}

export function isLocalBaseUrl(baseUrl) {
  try {
    const parsed = new URL(baseUrl);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function getBaseUrlCandidates(baseUrl) {
  try {
    const parsed = new URL(baseUrl);
    const candidates = [trimTrailingSlash(parsed.toString())];

    if (parsed.hostname === "localhost") {
      parsed.hostname = "127.0.0.1";
      candidates.push(trimTrailingSlash(parsed.toString()));
    } else if (parsed.hostname === "127.0.0.1") {
      parsed.hostname = "localhost";
      candidates.push(trimTrailingSlash(parsed.toString()));
    }

    return [...new Set(candidates)];
  } catch {
    return [normalizeBaseUrl(baseUrl)];
  }
}
