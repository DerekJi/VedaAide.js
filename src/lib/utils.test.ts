import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn()", () => {
  it("returns empty string for no args", () => {
    expect(cn()).toBe("");
  });

  it("returns the class name for a single string", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("merges multiple class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("deduplicates/overrides conflicting Tailwind classes", () => {
    // tailwind-merge should keep only the last p- class
    const result = cn("p-2", "p-4");
    expect(result).toBe("p-4");
  });

  it("handles undefined and false values gracefully", () => {
    expect(cn("foo", undefined, false, "bar")).toBe("foo bar");
  });

  it("handles conditional class objects", () => {
    expect(cn({ foo: true, bar: false })).toBe("foo");
  });
});
