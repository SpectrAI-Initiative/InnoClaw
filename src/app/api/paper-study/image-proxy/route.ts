import { NextRequest } from "next/server";

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_HOSTS = [
  "arxiv.org",
  "ar5iv.labs.arxiv.org",
  "static.arxiv.org",
];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return new Response("Missing url parameter", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  // Only proxy from known academic hosts
  if (!ALLOWED_HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))) {
    return new Response("Host not allowed", { status: 403 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "InnoClaw/1.0 (Academic Research Tool; mailto:noreply@example.com)",
      },
    });

    if (!res.ok) {
      return new Response(`Upstream error: ${res.status}`, { status: 502 });
    }

    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_BYTES) {
      return new Response("Image too large", { status: 413 });
    }

    const contentType = res.headers.get("content-type") || "image/png";
    const buffer = await res.arrayBuffer();

    if (buffer.byteLength > MAX_BYTES) {
      return new Response("Image too large", { status: 413 });
    }

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return new Response("Upstream timeout", { status: 504 });
    }
    return new Response("Proxy error", { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
