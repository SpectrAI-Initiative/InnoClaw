import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hashText,
  readSkillTranslationCache,
  skillTranslationKey,
  writeSkillTranslationCache,
} from "./skill-translation-cache";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: memoryStorage() });
});
afterEach(() => vi.unstubAllGlobals());

describe("skill translation cache", () => {
  it("keys entries by skill id and description content", () => {
    expect(skillTranslationKey("s1", "abc")).toBe(`s1:${hashText("abc")}`);
    expect(skillTranslationKey("s1", "abc")).not.toBe(skillTranslationKey("s1", "abd"));
  });

  it("round-trips and merges entries per locale", () => {
    writeSkillTranslationCache("zh", { a: "一" });
    writeSkillTranslationCache("zh", { b: "二" });
    expect(readSkillTranslationCache("zh")).toEqual({ a: "一", b: "二" });
    expect(readSkillTranslationCache("ja")).toEqual({});
  });

  it("tolerates corrupt data and missing storage", () => {
    window.localStorage.setItem("InnoScale.skillDescriptionTranslations.v1.zh", "{not json");
    expect(readSkillTranslationCache("zh")).toEqual({});
    vi.stubGlobal("window", undefined);
    expect(readSkillTranslationCache("zh")).toEqual({});
    expect(() => writeSkillTranslationCache("zh", { a: "一" })).not.toThrow();
  });
});
