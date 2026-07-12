import path from "node:path";
import Database from "better-sqlite3";
import { bootstrapAdministrator } from "../src/lib/auth/bootstrap-admin";
import {
  parseBootstrapAdminArgs,
  readPasswordFromStream,
} from "../src/lib/auth/bootstrap-admin-cli";

function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_URL?.replace(/^file:/, "");
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), "data", "innoclaw.db");
}

async function main(): Promise<void> {
  if (process.stdin.isTTY) {
    throw new Error("Administrator password must be piped on stdin");
  }

  const args = parseBootstrapAdminArgs(process.argv.slice(2));
  const password = await readPasswordFromStream(process.stdin);
  const sqlite = new Database(resolveDatabasePath());

  try {
    const result = bootstrapAdministrator(sqlite, {
      email: args.email,
      name: args.name,
      password,
    });
    const action = result.status === "created" ? "created" : "already exists";
    process.stdout.write(`Administrator ${action}: ${result.email}\n`);
  } finally {
    sqlite.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`Administrator bootstrap failed: ${message}\n`);
  process.exitCode = 1;
});
