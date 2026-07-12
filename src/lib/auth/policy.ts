function parseOptionalBoolean(
  name: string,
  raw: string | undefined,
): boolean | undefined {
  if (raw === undefined || raw.trim() === "") {
    return undefined;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }

  throw new Error(`${name} must be either true or false`);
}

export function isSingleAdminMode(): boolean {
  return (
    parseOptionalBoolean("AUTH_SINGLE_ADMIN", process.env.AUTH_SINGLE_ADMIN) ??
    false
  );
}

export function shouldUseSecureAuthCookies(): boolean {
  return (
    parseOptionalBoolean(
      "AUTH_COOKIE_SECURE",
      process.env.AUTH_COOKIE_SECURE,
    ) ?? process.env.NODE_ENV === "production"
  );
}
