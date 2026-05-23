import { describe, expect, it } from "vitest";
import {
  containsCJK,
  buildCJKPreamble,
  renderLaTeXPreamble,
  getDefaultTemplate,
  getTemplate,
  listAvailableTemplates,
  renderLaTeXFigure,
  renderLaTeXTable,
} from "./latex-templates";

// =============================================================
// containsCJK
// =============================================================
describe("containsCJK", () => {
  it("detects Chinese characters", () => {
    expect(containsCJK("这是中文文本")).toBe(true);
  });

  it("detects Chinese in mixed text", () => {
    expect(containsCJK("Transformer 是一种深度学习架构")).toBe(true);
  });

  it("detects Japanese characters", () => {
    expect(containsCJK("これは日本語です")).toBe(true);
  });

  it("detects Korean characters", () => {
    expect(containsCJK("한국어 텍스트")).toBe(true);
  });

  it("returns false for pure English", () => {
    expect(containsCJK("This is English text")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(containsCJK("")).toBe(false);
  });

  it("returns false for numbers and symbols", () => {
    expect(containsCJK("12345 !@#$%")).toBe(false);
  });

  it("detects Chinese in LaTeX commands", () => {
    expect(containsCJK("\\title{中文标题}")).toBe(true);
  });
});

// =============================================================
// buildCJKPreamble
// =============================================================
describe("buildCJKPreamble", () => {
  it("returns a non-empty string", () => {
    const preamble = buildCJKPreamble();
    expect(preamble.length).toBeGreaterThan(0);
  });

  it("contains ctex usepackage directive", () => {
    const preamble = buildCJKPreamble();
    expect(preamble).toContain("\\usepackage");
    expect(preamble).toContain("ctex");
  });

  it("contains CJK font settings", () => {
    const preamble = buildCJKPreamble();
    expect(preamble).toContain("\\setCJKmainfont");
    expect(preamble).toContain("Songti SC");
    expect(preamble).toContain("\\setCJKsansfont");
    expect(preamble).toContain("PingFang SC");
    expect(preamble).toContain("\\setCJKmonofont");
    expect(preamble).toContain("STFangsong");
  });

  it("contains the CJK comment header", () => {
    const preamble = buildCJKPreamble();
    expect(preamble).toContain("CJK (Chinese/Japanese/Korean) support");
  });

  it("generates valid LaTeX preamble fragment", () => {
    const preamble = buildCJKPreamble();
    // Should NOT contain raw JavaScript escape artifacts
    expect(preamble).not.toContain("\\\\");
    // Should contain actual LaTeX commands
    expect(preamble).toContain("\\usepackage");
    expect(preamble).toContain("\\setCJKmainfont");
  });
});

// =============================================================
// renderLaTeXPreamble with CJK
// =============================================================
describe("renderLaTeXPreamble with CJK", () => {
  const template = getDefaultTemplate();

  it("does not include CJK preamble when cjkEnabled is false", () => {
    const preamble = renderLaTeXPreamble(template, {
      title: "Test Paper",
      authors: "Author One",
      abstract: "An abstract.",
    }, false);

    expect(preamble).not.toContain("\\setCJKmainfont");
    expect(preamble).not.toContain("ctex");
  });

  it("does not include CJK preamble when cjkEnabled is undefined", () => {
    const preamble = renderLaTeXPreamble(template, {
      title: "Test Paper",
      authors: "Author One",
      abstract: "An abstract.",
    });

    expect(preamble).not.toContain("\\setCJKmainfont");
  });

  it("includes CJK preamble when cjkEnabled is true", () => {
    const preamble = renderLaTeXPreamble(template, {
      title: "测试论文",
      authors: "作者",
      abstract: "摘要内容",
    }, true);

    expect(preamble).toContain("\\usepackage");
    expect(preamble).toContain("ctex");
    expect(preamble).toContain("\\setCJKmainfont");
  });

  it("preserves Chinese characters in title when CJK enabled", () => {
    const preamble = renderLaTeXPreamble(template, {
      title: "深度学习在自然语言处理中的应用",
      authors: "张三, 李四",
      abstract: "本文综述了深度学习在NLP中的应用。",
    }, true);

    expect(preamble).toContain("深度学习在自然语言处理中的应用");
    expect(preamble).toContain("张三");
    expect(preamble).toContain("李四");
    expect(preamble).toContain("本文综述了深度学习在NLP中的应用");
  });

  it("generates valid document structure with CJK", () => {
    const preamble = renderLaTeXPreamble(template, {
      title: "Test",
      authors: "Author",
      abstract: "Abstract",
    }, true);

    expect(preamble).toContain("\\documentclass");
    expect(preamble).toContain("\\begin{document}");
    expect(preamble).toContain("\\begin{abstract}");
    expect(preamble).toContain("\\end{abstract}");
    expect(preamble).toContain("\\maketitle");
  });
});

// =============================================================
// Template availability
// =============================================================
describe("template availability", () => {
  it("lists all three conference templates", () => {
    const templates = listAvailableTemplates();
    expect(templates).toHaveLength(3);
  });

  it("returns valid templates by name", () => {
    expect(getTemplate("neurips_2025").name).toBe("neurips_2025");
    expect(getTemplate("iclr_2026").name).toBe("iclr_2026");
    expect(getTemplate("icml_2026").name).toBe("icml_2026");
  });

  it("getDefaultTemplate returns NeurIPS 2025", () => {
    expect(getDefaultTemplate().name).toBe("neurips_2025");
  });
});

// =============================================================
// Figure and Table rendering
// =============================================================
describe("figure and table rendering", () => {
  it("renders a LaTeX figure", () => {
    const fig = renderLaTeXFigure({
      filename: "results.png",
      caption: "Results overview",
      label: "fig:results",
    });
    expect(fig).toContain("\\begin{figure}");
    expect(fig).toContain("\\includegraphics");
    expect(fig).toContain("results.png");
    expect(fig).toContain("\\caption{Results overview}");
    expect(fig).toContain("\\label{fig:results}");
    expect(fig).toContain("\\end{figure}");
  });

  it("renders a LaTeX table", () => {
    const tbl = renderLaTeXTable({
      caption: "Comparison",
      label: "tab:comparison",
      headers: ["Model", "Accuracy"],
      rows: [["BERT", "0.92"], ["GPT", "0.88"]],
    });
    expect(tbl).toContain("\\begin{table}");
    expect(tbl).toContain("\\caption{Comparison}");
    expect(tbl).toContain("\\label{tab:comparison}");
    expect(tbl).toContain("Model & Accuracy");
    expect(tbl).toContain("BERT & 0.92");
    expect(tbl).toContain("\\end{table}");
  });
});
