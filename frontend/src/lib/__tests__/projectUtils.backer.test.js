import { describe, it, expect } from "vitest";
import {
  filterBackerProjects,
  sortBackerProjects,
  prioritizeScoutProjects,
} from "@/utils/projectUtils";

const sampleProjects = [
  { id: "a", name: "Alpha", ecosystem: "base", health: 80, confidence: 70, createdAt: "2024-01-01" },
  { id: "b", name: "Beta Solana", ecosystem: "solana", health: 90, confidence: 60, createdAt: "2024-06-01" },
  { id: "c", name: "Gamma", ecosystem: "base", health: 50, confidence: 90, createdAt: "2023-01-01" },
];

describe("filterBackerProjects", () => {
  it("filters by search and ecosystem", () => {
    const result = filterBackerProjects(sampleProjects, {
      search: "solana",
      ecosystem: "all",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b");
  });
});

describe("sortBackerProjects", () => {
  it("sorts by health descending by default", () => {
    const sorted = sortBackerProjects(sampleProjects, "health");
    expect(sorted.map((p) => p.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts by confidence", () => {
    const sorted = sortBackerProjects(sampleProjects, "confidence");
    expect(sorted[0].id).toBe("c");
  });
});

describe("prioritizeScoutProjects", () => {
  it("puts scout matches first", () => {
    const ordered = prioritizeScoutProjects(sampleProjects, [{ id: "c" }, { slug: "a" }]);
    expect(ordered.map((p) => p.id)).toEqual(["a", "c", "b"]);
  });

  it("returns input unchanged when scout list is empty", () => {
    expect(prioritizeScoutProjects(sampleProjects, [])).toEqual(sampleProjects);
  });
});
