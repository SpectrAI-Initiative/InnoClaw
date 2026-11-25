import mysql from "mysql2/promise";
import { bootstrapAdministrator } from "../src/lib/auth/bootstrap-admin";
import {
  parseBootstrapAdminArgs,
  readPasswordFromStream,
} from "../src/lib/auth/bootstrap-admin-cli";

function createPoolFromEnv(): mysql.Pool {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw || !raw.startsWith("mysql://")) {
    throw new Error(
      "DATABASE_URL must be set to a mysql:// connection string (run the app once first so migrations create the tables)",
    );
  }
  return mysql.createPool({ uri: raw, connectionLimit: 1, charset: "utf8mb4" });
}

async function main(): Promise<void> {
  if (process.stdin.isTTY) {
    throw new Error("Administrator password must be piped on stdin");
  }

  const args = parseBootstrapAdminArgs(process.argv.slice(2));
  const password = await readPasswordFromStream(process.stdin);
  const pool = createPoolFromEnv();

  try {
    const result = await bootstrapAdministrator(pool, {
      email: args.email,
      name: args.name,
      password,
    });
    const action = result.status === "created" ? "created" : "already exists";
    process.stdout.write(`Administrator ${action}: ${result.email}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`Administrator bootstrap failed: ${message}\n`);
  process.exitCode = 1;
});
