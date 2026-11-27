export const AUTH_SESSION_COOKIE = "INNOSCALE_session";
export const AUTH_SESSION_EXPIRES_COOKIE = "INNOSCALE_session_expires";
export const AUTH_SESSION_SIGNATURE_COOKIE = "INNOSCALE_session_sig";

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
