/**
 * Cross-platform dependency check script.
 *
 * Verifies that critical native/optional dependencies are installed
 * before `dev` or `build` runs. If any are missing it exits with a
 * clear error telling the user to run `npm install` (or `npm ci` in CI).
 */

const deps = ["rehype-sanitize", "better-sqlite3"];

const missing = deps.filter((dep) => {
  try {
    require.resolve(dep);
    return false;
  } catch {
    return true;
  }
});

if (missing.length > 0) {
  console.error(
    `\n  Missing dependencies: ${missing.join(", ")}.\n  Run "npm install" (or "npm ci" in CI) first.\n`
  );
  process.exit(1);
}
