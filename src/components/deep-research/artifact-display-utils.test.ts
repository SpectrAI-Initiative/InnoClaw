import { describe, expect, it } from "vitest";
import {
  normalizeDisplayList,
  truncateDisplayList,
} from "./artifact-display-utils";

describe("artifact-display-utils", () => {
  it("normalizes author lists from strings, objects, and arrays", () => {
    expect(normalizeDisplayList("Alice")).toEqual(["Alice"]);
    expect(normalizeDisplayList({ name: "Bob" })).toEqual(["Bob"]);
    expect(normalizeDisplayList(["Alice", { name: "Bob" }, "", { nope: true }])).toEqual(["Alice", "Bob"]);
  });

  it("truncates normalized display lists safely", () => {
    expect(truncateDisplayList(["Alice", "Bob"], 4)).toBe("Alice, Bob");
    expect(truncateDisplayList(["Alice", "Bob", "Carol", "Dave", "Eve"], 4)).toBe("Alice, Bob, Carol, Dave +1 more");
  });
});
