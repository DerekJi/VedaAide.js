import { describe, it, expect } from "vitest";
import { cosineSimilarity } from "@/lib/vector-store/cosine-similarity";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("returns 0 for zero vector", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });

  it("throws if dimensions differ", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow("dimension mismatch");
  });

  it("handles single-element vectors", () => {
    expect(cosineSimilarity([5], [10])).toBeCloseTo(1);
  });

  it("returns correct similarity for non-unit vectors", () => {
    const a = [1, 2, 3];
    const b = [2, 4, 6]; // parallel to a
    expect(cosineSimilarity(a, b)).toBeCloseTo(1);
  });
});
