export const AUTH_SESSION_COOKIE = "innoclaw_session";
export const AUTH_SESSION_EXPIRES_COOKIE = "innoclaw_session_expires";
export const AUTH_SESSION_SIGNATURE_COOKIE = "innoclaw_session_sig";

export const AUTH_SESSION_DAYS = 30;
export const AUTH_SESSION_REFRESH_DAYS = 7;

export const AUTH_PUBLIC_PATHS = new Set([
  "/login",
  "/register",
]);

export const AUTH_PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/bot/feishu",
  "/api/bot/wechat",
];
