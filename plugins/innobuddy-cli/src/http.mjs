import { getBaseUrlCandidates, isLocalBaseUrl } from "./runtime.mjs";

export class ApiError extends Error {
  constructor(message, { status = 500, payload = null, response = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.response = response;
  }
}

function createTimeoutSignal(timeoutMs) {
  if (!timeoutMs || timeoutMs <= 0) {
    return null;
  }
  return AbortSignal.timeout(timeoutMs);
}

async function parseResponsePayload(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }
  return response.text().catch(() => "");
}

function buildErrorMessage(response, payload) {
  if (payload && typeof payload === "object" && typeof payload.error === "string") {
    return payload.error;
  }
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }
  return `${response.status} ${response.statusText}`;
}

/**
 * @param {{
 *   baseUrl: string,
 *   getCookieHeader?: () => string | null | undefined | Promise<string | null | undefined>,
 *   onResponse?: (response: Response) => void | Promise<void>,
 * }} options
 */
export function createApiClient({ baseUrl, getCookieHeader, onResponse }) {
  async function request(path, {
    method = "GET",
    body,
    headers = {},
    timeoutMs = 30_000,
    redirect = "follow",
  } = {}) {
    const finalHeaders = new Headers(headers);
    const cookieHeader = await getCookieHeader?.();
    if (cookieHeader) {
      finalHeaders.set("cookie", cookieHeader);
    }

    let requestBody = body;
    if (
      body !== undefined &&
      body !== null &&
      typeof body === "object" &&
      !(body instanceof Uint8Array) &&
      !(body instanceof ArrayBuffer) &&
      !(body instanceof FormData) &&
      !(body instanceof URLSearchParams)
    ) {
      if (!finalHeaders.has("content-type")) {
        finalHeaders.set("content-type", "application/json");
      }
      requestBody = JSON.stringify(body);
    }

    const requestOptions = {
      method,
      headers: finalHeaders,
      body: requestBody,
      redirect,
      signal: createTimeoutSignal(timeoutMs),
    };

    const candidates = isLocalBaseUrl(baseUrl)
      ? getBaseUrlCandidates(baseUrl)
      : [baseUrl];

    let lastError = null;
    let response = null;

    for (const candidate of candidates) {
      try {
        response = await fetch(`${candidate}${path}`, requestOptions);
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!response) {
      throw lastError instanceof Error ? lastError : new Error(`Failed to reach ${baseUrl}${path}`);
    }

    await onResponse?.(response);
    return response;
  }

  async function requestJson(path, options = {}) {
    const response = await request(path, options);
    const payload = await parseResponsePayload(response);
    if (!response.ok) {
      throw new ApiError(buildErrorMessage(response, payload), {
        status: response.status,
        payload,
        response,
      });
    }
    return { response, payload };
  }

  async function requestText(path, options = {}) {
    const response = await request(path, options);
    const payload = await response.text().catch(() => "");
    if (!response.ok) {
      throw new ApiError(buildErrorMessage(response, payload), {
        status: response.status,
        payload,
        response,
      });
    }
    return { response, payload };
  }

  return {
    request,
    requestJson,
    requestText,
  };
}
