/**
 * Next.js instrumentation — runs once when the server starts.
 *
 * Used to initialise long-running services that must live alongside
 * the Next.js process, such as the Feishu WebSocket client.
 */


export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
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
    runMigrations();

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
