import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  parseBootstrapAdminArgs,
  readPasswordFromStream,
} from "./bootstrap-admin-cli";

describe("bootstrap administrator CLI helpers", () => {
  it("parses the required email and optional display name", () => {
    expect(parseBootstrapAdminArgs([
      "--email",
      "admin@innoclaw.local",
      "--name",
      "Administrator",
    ])).toEqual({
      email: "admin@innoclaw.local",
      name: "Administrator",
    });
  });

  it("defaults the display name", () => {
    expect(parseBootstrapAdminArgs([
      "--email",
      "admin@innoclaw.local",
    ])).toEqual({
      email: "admin@innoclaw.local",
      name: "Administrator",
    });
  });

  it("rejects missing values and password arguments", () => {
    expect(() => parseBootstrapAdminArgs([])).toThrow("--email is required");
    expect(() => parseBootstrapAdminArgs(["--email"])).toThrow(
      "--email requires a value",
    );
    expect(() => parseBootstrapAdminArgs([
      "--email",
      "admin@innoclaw.local",
      "--password",
      "secret",
    ])).toThrow("Unknown argument: --password");
  });

  it("reads a password from stdin and removes one line ending", async () => {
    const password = await readPasswordFromStream(
      Readable.from(["correct-horse-battery-staple\r\n"]),
    );

    expect(password).toBe("correct-horse-battery-staple");
  });

  it("preserves intentional leading and internal whitespace", async () => {
    const password = await readPasswordFromStream(
      Readable.from([" leading space and internal words\n"]),
    );

    expect(password).toBe(" leading space and internal words");
  });

  it("rejects empty stdin", async () => {
    await expect(readPasswordFromStream(Readable.from([]))).rejects.toThrow(
      "Administrator password must be provided on stdin",
    );
  });
});
