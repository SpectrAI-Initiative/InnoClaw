import { describe, expect, it } from "vitest";
import { conclusionFilesFromToolInputs } from "./conclusion-files";

describe("conclusionFilesFromToolInputs", () => {
  it("keeps markdown and html paths and drops everything else", () => {
    expect(conclusionFilesFromToolInputs([
      { filePath: "/work/report.md" },
      { filePath: "/work/report.md" },
      { filePath: "/work/table.csv" },
      { command: "ls" },
      { filePath: "notes\\summary.html" },
      null,
    ])).toEqual([
      { path: "/work/report.md", name: "report.md" },
      { path: "notes\\summary.html", name: "summary.html" },
    ]);
  });
});
