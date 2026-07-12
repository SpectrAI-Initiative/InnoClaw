export interface BootstrapAdminCliArgs {
  email: string;
  name: string;
}

export function parseBootstrapAdminArgs(
  args: string[],
): BootstrapAdminCliArgs {
  let email = "";
  let name = "Administrator";

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument !== "--email" && argument !== "--name") {
      throw new Error(`Unknown argument: ${argument}`);
    }

    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${argument} requires a value`);
    }

    if (argument === "--email") {
      email = value;
    } else {
      name = value;
    }
    index += 1;
  }

  if (!email) {
    throw new Error("--email is required");
  }

  return { email, name };
}

export async function readPasswordFromStream(
  stream: NodeJS.ReadableStream,
): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const password = Buffer.concat(chunks)
    .toString("utf8")
    .replace(/\r?\n$/, "");
  if (!password) {
    throw new Error("Administrator password must be provided on stdin");
  }

  return password;
}
