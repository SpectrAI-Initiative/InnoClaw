import { NextRequest, NextResponse } from "next/server";
import { getOidcConfig, isKeycloakMode } from "./config";
import { authorizationUrl, digest, exchange, OIDC_COOKIE, randomValue, resolveMetadata, TRANSACTION_SECONDS } from "./protocol";
import { oidcRepository } from "./repository";
import { attachAuthCookies, createAuthSession } from "../server";
import { isAuthDisabled } from "../mode";
import { resolveRoleAwareRedirectPath } from "../redirect-policy";
import { resolveSafeRedirectPath } from "../cli-handoff";
import { isSingleAdminMode } from "../policy";

function noCache(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

// A route handler cannot reconstruct the browser-facing origin behind a proxy:
// Next.js takes the scheme from X-Forwarded-Proto but the host from its own bind
// address, so an absolute redirect here resolves to the container address.
// Relative locations let the browser keep the host it actually used.
function redirectTo(location: string) {
  return noCache(new NextResponse(null, { status: 307, headers: { location } }));
}

export async function startOidc(request: NextRequest) {
  // The entry point is a link, so failures return to the login page instead of JSON.
  const unavailable = () => redirectTo("/login?oidc_unavailable=1");
  try {
    const config = getOidcConfig();
    if (!config || isAuthDisabled() || isSingleAdminMode()) return unavailable();
    if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) throw new Error("Strong AUTH_SECRET required");
    const metadata = await resolveMetadata(config);
    const state = randomValue();
    const binding = randomValue();
    const tx = { stateHash: digest(state), bindingHash: digest(binding), nonce: randomValue(), verifier: randomValue(),
      returnTo: resolveSafeRedirectPath(request.nextUrl.searchParams.get("next"), "/"),
      expiresAt: Date.now() + TRANSACTION_SECONDS * 1000 };
    await oidcRepository.save(tx);
    const target = new URL(authorizationUrl(config, metadata, state, tx));
    if (isKeycloakMode() && request.nextUrl.searchParams.get("action") === "register") {
      target.pathname = target.pathname.replace(/\/auth$/, "/registrations");
    }
    const response = NextResponse.redirect(target);
    response.cookies.set(OIDC_COOKIE, binding, { httpOnly: true, sameSite: "lax", path: "/api/auth/oidc",
      secure: config.redirectUri.startsWith("https:"), maxAge: TRANSACTION_SECONDS });
    return noCache(response);
  } catch {
    return unavailable();
  }
}

export async function callbackOidc(request: NextRequest) {
  let response: NextResponse;
  let secure = true;
  try {
    const config = getOidcConfig();
    if (!config || isAuthDisabled() || isSingleAdminMode()) throw new Error("OIDC unavailable");
    secure = config.redirectUri.startsWith("https:");
    const params = request.nextUrl.searchParams;
    const state = params.get("state");
    const binding = request.cookies.get(OIDC_COOKIE)?.value;
    if (!state || !binding || params.getAll("state").length !== 1 || params.getAll("code").length > 1) throw new Error("Invalid callback");
    // Consume before exchanging the code: callbacks are single-use across instances.
    const tx = await oidcRepository.consume(digest(state), digest(binding));
    if (!tx || params.has("error") || !params.get("code")) throw new Error("Invalid or expired login");
    const identity = await exchange(config, params.get("code")!, tx);
    const user = await oidcRepository.resolve(identity);
    const session = await createAuthSession(user.id);
    const destination = resolveRoleAwareRedirectPath(tx.returnTo, user.role, "/");
    response = attachAuthCookies(NextResponse.redirect(new URL(destination, new URL(config.redirectUri).origin)), session);
  } catch {
    // Fixed public message: never echo tokens, codes, provider errors or account existence.
    response = redirectTo("/login?oidc_error=1");
  }
  response.cookies.set(OIDC_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/api/auth/oidc", secure, maxAge: 0 });
  return noCache(response);
}
