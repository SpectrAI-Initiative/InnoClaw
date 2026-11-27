export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  allowHttp: boolean;
  scope: string;
  requireNonce: boolean;
  requireEmailVerified: boolean;
  endpoints: { authorization: string; token: string; jwks: string; userinfo: string } | null;
}

export function validateEndpoint(value: string, allowHttp: boolean): URL {
  const url = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.hash ||
      (url.protocol !== "https:" && !(allowHttp && loopback && url.protocol === "http:"))) {
    throw new Error("OIDC endpoints require HTTPS (HTTP is allowed only for explicit loopback testing)");
  }
  return url;
}

// Tencent OneID publishes no discovery document, so its endpoints are configured
// explicitly. Standard providers are still supported through OIDC discovery.
function readEndpoints(allowHttp: boolean): OidcConfig["endpoints"] {
  const raw = [process.env.AUTH_OIDC_AUTHORIZE_URL, process.env.AUTH_OIDC_TOKEN_URL,
    process.env.AUTH_OIDC_JWKS_URL].map((value) => value?.trim() ?? "");
  const set = raw.filter(Boolean).length;
  if (set === 0) return null;
  if (set !== raw.length) throw new Error("Setting one AUTH_OIDC_*_URL requires authorize, token and jwks");
  const [authorization, token, jwks] = raw;
  for (const value of raw) validateEndpoint(value, allowHttp);
  const userinfo = process.env.AUTH_OIDC_USERINFO_URL?.trim() ?? "";
  if (userinfo) validateEndpoint(userinfo, allowHttp);
  return { authorization, token, jwks, userinfo };
}

const flag = (name: string, fallback: boolean) => {
  const value = process.env[name]?.trim();
  if (value === undefined || value === "") return fallback;
  if (value !== "true" && value !== "false") throw new Error(`${name} must be true or false`);
  return value === "true";
};

export function getOidcConfig(): OidcConfig | null {
  if (process.env.AUTH_OIDC_ENABLED !== "true") return null;
  const required = (name: string) => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Missing ${name}`);
    return value;
  };
  const allowHttp = process.env.AUTH_OIDC_ALLOW_HTTP === "true";
  const config = {
    issuer: required("AUTH_OIDC_ISSUER"),
    clientId: required("AUTH_OIDC_CLIENT_ID"),
    clientSecret: required("AUTH_OIDC_CLIENT_SECRET"),
    redirectUri: required("AUTH_OIDC_REDIRECT_URI"),
    allowHttp,
    scope: process.env.AUTH_OIDC_SCOPE?.trim() || "openid",
    requireNonce: flag("AUTH_OIDC_REQUIRE_NONCE", true),
    requireEmailVerified: flag("AUTH_OIDC_REQUIRE_EMAIL_VERIFIED", true),
  };
  const issuer = validateEndpoint(config.issuer, allowHttp);
  const redirect = validateEndpoint(config.redirectUri, allowHttp);
  const endpoints = readEndpoints(allowHttp);
  if (redirect.protocol === "https:" && process.env.AUTH_COOKIE_SECURE === "false") {
    throw new Error("HTTPS OIDC requires secure application session cookies");
  }
  if (issuer.search || issuer.hash || redirect.search || redirect.hash ||
      redirect.pathname !== "/api/auth/oidc/callback") {
    throw new Error("Invalid OIDC issuer or callback URL");
  }
  return { ...config, endpoints };
}
