import { describe, expect, it } from "vitest";

import {
  getLatexEngineCandidates,
  refineLatexSourceForCompilation,
} from "./latex-compiler";

describe("getLatexEngineCandidates", () => {
  it("prefers XeLaTeX-compatible engines for CJK content", () => {
    expect(getLatexEngineCandidates(true)).toEqual(["xelatex", "lualatex", "pdflatex"]);
  });

  it("prefers pdfLaTeX for non-CJK content", () => {
    expect(getLatexEngineCandidates(false)).toEqual(["pdflatex", "xelatex", "lualatex"]);
  });
});

describe("refineLatexSourceForCompilation", () => {
  it("removes a missing conference style package with options", () => {
    const tex = [
      "\\documentclass{article}",
      "\\usepackage[preprint]{neurips_2025}",
      "\\usepackage{amsmath}",
      "\\begin{document}",
      "Body",
      "\\end{document}",
    ].join("\n");
    const log = "! LaTeX Error: File `neurips_2025.sty' not found.";

    const refined = refineLatexSourceForCompilation(tex, log);

    expect(refined.notes).toEqual(["removed missing package neurips_2025"]);
    expect(refined.texContent).not.toContain("\\usepackage[preprint]{neurips_2025}");
    expect(refined.texContent).toContain("% removed unavailable package: neurips_2025");
    expect(refined.texContent).toContain("\\usepackage{amsmath}");
  });

  it("removes only packages reported missing in the compiler log", () => {
    const tex = [
      "\\documentclass{article}",
      "\\usepackage{algorithm}",
      "\\usepackage{booktabs}",
      "\\begin{document}",
      "Body",
      "\\end{document}",
    ].join("\n");
    const log = "! LaTeX Error: File `algorithm.sty' not found.";

    const refined = refineLatexSourceForCompilation(tex, log);

    expect(refined.notes).toEqual(["removed missing package algorithm"]);
    expect(refined.texContent).not.toContain("\\usepackage{algorithm}");
    expect(refined.texContent).toContain("\\usepackage{booktabs}");
  });

  it("does not change source when the missing file is not a used package", () => {
    const tex = [
      "\\documentclass{article}",
      "\\usepackage{amsmath}",
      "\\begin{document}",
      "Body",
      "\\end{document}",
    ].join("\n");
    const log = "! LaTeX Error: File `custom-template.sty' not found.";

    const refined = refineLatexSourceForCompilation(tex, log);

    expect(refined.notes).toEqual([]);
    expect(refined.texContent).toBe(tex);
  });
});

