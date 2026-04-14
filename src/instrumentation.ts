/**
 * Next.js instrumentation — runs once when the server starts.
 *
 * Used to initialise long-running services that must live alongside
 * the Next.js process, such as the Feishu WebSocket client.
 */


export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Merge NO_PROXY entries from .env.local into process.env.
    // A shell proxy script may set a no_proxy that is missing internal
    // domains (e.g. .pjh-service.org.cn). Next.js does not override
    // existing env vars from .env.local, so we merge them here.
    try {
      const fs = await import("fs");
      const path = await import("path");
      const dotenv = await import("dotenv");

      const envLocalPath = path.resolve(process.cwd(), ".env.local");
      if (fs.existsSync(envLocalPath)) {
        const parsed = dotenv.parse(
          fs.readFileSync(envLocalPath, "utf-8")
        );
        const sources = [
          process.env.no_proxy,
          process.env.NO_PROXY,
          parsed.no_proxy,
          parsed.NO_PROXY,
        ];
        const entries = new Set<string>();
        for (const src of sources) {
          if (!src) continue;
          for (const e of src.split(",")) {
            const t = e.trim();
            if (t) entries.add(t);
          }
        }
        if (entries.size > 0) {
          const merged = Array.from(entries).join(",");
          if (process.env.no_proxy !== undefined || parsed.no_proxy) {
            process.env.no_proxy = merged;
          }
          if (process.env.NO_PROXY !== undefined || parsed.NO_PROXY) {
            process.env.NO_PROXY = merged;
          }
          console.log(`[instrumentation] Merged no_proxy: ${merged}`);
        }
      }
    } catch {
      // Silently continue — proxy bypass is best-effort
    }

    // Set up HTTP proxy for all fetch() calls (AI SDK, etc.)
    // Reads HTTP_PROXY, HTTPS_PROXY, NO_PROXY env vars automatically.
    // proxyTunnel: false  →  use regular HTTP forward proxying for http:// targets
    //   instead of CONNECT tunneling. Many proxies restrict CONNECT to port 443,
    //   which causes 403 errors when the AI API endpoint is plain HTTP.
    //   HTTPS targets still use CONNECT tunneling as expected.
    const proxyUrl =
      process.env.HTTP_PROXY ||
      process.env.HTTPS_PROXY ||
      process.env.http_proxy ||
      process.env.https_proxy;
    if (proxyUrl) {
      try {
        const { setGlobalDispatcher, EnvHttpProxyAgent } = await import(
          "undici"
        );
        setGlobalDispatcher(new EnvHttpProxyAgent({ proxyTunnel: false }));
      } catch (error) {
        console.error(
          'Failed to import "undici" for HTTP proxy configuration. ' +
            "Proxy environment variables are set, but proxy support is disabled. " +
            'Please ensure "undici" is installed as a runtime dependency.',
          error
        );
      }
    }

    // Ensure .env.local exists (generate from .env.example if missing)
    const { ensureEnvLocal } = await import("@/lib/env-file");
    ensureEnvLocal();

    // Run database migrations
    const { runMigrations } = await import("@/lib/db/migrate");
    await runMigrations();

    // Start the Feishu WebSocket client (if configured)
    const { startFeishuWSClient } = await import(
      "@/lib/bot/feishu/ws-client"
    );
    startFeishuWSClient();

    // Start the daily report scheduler (auto-generate at midnight)
    const { startDailyReportScheduler } = await import(
      "@/lib/daily-report-scheduler"
    );
    startDailyReportScheduler();

    // Start the weekly report scheduler (auto-generate every Friday at noon)
    const { startWeeklyReportScheduler } = await import(
      "@/lib/weekly-report-scheduler"
    );
    startWeeklyReportScheduler();

    // Start the generic task scheduler (user-defined cron tasks)
    const { startTaskScheduler } = await import("@/lib/scheduler");
    startTaskScheduler();
  }
}
