import { describe, expect, it } from "vitest";
import { buildPaperRoastPrompt } from "@/lib/ai/paper-prompts";
import {
  ROAST_PAPER_HEADING_PREFIX,
  parseRoastPaperHeading,
  parseRoastPaperHeadingLine,
} from "./roast-format";

const TITLE = "Laser Processing for Energy Applications";

describe("roast paper headings", () => {
  it("parses the current `论文：` heading (full- or half-width colon)", () => {
    expect(parseRoastPaperHeading(`论文：${TITLE}`)).toBe(TITLE);
    expect(parseRoastPaperHeading(`论文: ${TITLE}`)).toBe(TITLE);
    expect(parseRoastPaperHeadingLine(`### 论文：${TITLE}`)).toBe(TITLE);
  });

  it("still parses legacy `📄` headings from saved roasts", () => {
    expect(parseRoastPaperHeading(`📄 ${TITLE}`)).toBe(TITLE);
    expect(parseRoastPaperHeadingLine(`### 📄 ${TITLE}`)).toBe(TITLE);
  });

  it("ignores other headings such as triage tiers", () => {
    expect(parseRoastPaperHeading("必读")).toBeNull();
    expect(parseRoastPaperHeadingLine("## 分流表")).toBeNull();
    expect(parseRoastPaperHeadingLine(`#### 论文：${TITLE}`)).toBeNull();
  });
});

describe("buildPaperRoastPrompt", () => {
  const prompt = buildPaperRoastPrompt([
    { title: TITLE, authors: ["A"], publishedDate: "2026-11-16", source: "arxiv", abstract: "A book chapter." },
  ]);

  it("contains no emoji and explicitly forbids them", () => {
    expect(prompt).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(prompt).toContain("不要使用任何 emoji");
  });

  it("asks for the heading format the UI parser understands", () => {
    expect(prompt).toContain(`### ${ROAST_PAPER_HEADING_PREFIX}论文原始英文标题`);
    expect(parseRoastPaperHeadingLine(`### ${ROAST_PAPER_HEADING_PREFIX}${TITLE}`)).toBe(TITLE);
  });

  it("requires evidence-based criticism and a text verdict", () => {
    expect(prompt).toContain("每个质疑都要指向摘要中的具体内容");
    expect(prompt).toContain("**判决**");
    expect(prompt).toContain("不要在输出中出现\"不对\"");
  });
});
