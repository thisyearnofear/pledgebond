/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useProjectFilters from "@/hooks/useProjectFilters";

const projects = [
  { id: "1", name: "One", ecosystem: "base", health: 90, confidence: 50 },
  { id: "2", name: "Two", ecosystem: "solana", health: 70, confidence: 80 },
  { id: "3", name: "Three", ecosystem: "base", health: 60, confidence: 40 },
];

describe("useProjectFilters", () => {
  it("returns a health-sorted shortlist with limit", () => {
    const { result } = renderHook(() => useProjectFilters(projects, { limit: 2 }));
    expect(result.current.filteredProjects).toHaveLength(2);
    expect(result.current.filteredProjects[0].id).toBe("1");
    expect(result.current.totalMatches).toBe(3);
  });

  it("clears filters", () => {
    const { result } = renderHook(() => useProjectFilters(projects, { limit: null }));
    act(() => {
      result.current.setSearchQuery("Two");
      result.current.setFilterEcosystem("solana");
    });
    expect(result.current.totalMatches).toBe(1);
    act(() => result.current.clearFilters());
    expect(result.current.searchQuery).toBe("");
    expect(result.current.filterEcosystem).toBe("all");
    expect(result.current.totalMatches).toBe(3);
  });

  it("prioritizes scout recommendations", () => {
    const { result } = renderHook(() =>
      useProjectFilters(projects, { limit: null, scoutProjects: [{ id: "3" }] }),
    );
    expect(result.current.filteredProjects[0].id).toBe("3");
  });
});
