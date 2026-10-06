/**
 * AnalyzePanel — project analysis flow (formerly /analyze page body).
 */

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import useAnalyzeProjects from "@/hooks/useAnalyzeProjects";
import useAnalyzeProject from "@/hooks/useAnalyzeProject";
import {
  AnalyzeHeader,
  ProjectSearch,
  ProjectGrid,
  AnalysisResult,
  AnalysisLoading,
  AnalysisError,
} from "@/components/analyze";

export default function AnalyzePanel() {
  const router = useRouter();
  const { projects, filtered, loading, searchQuery, setSearchQuery } = useAnalyzeProjects();
  const analyze = useAnalyzeProject();
  const autoRunRef = useRef(null);

  useEffect(() => {
    if (!router.isReady || loading) return;
    const rawId = Array.isArray(router.query.project)
      ? router.query.project[0]
      : router.query.project;
    if (!rawId || autoRunRef.current === rawId) return;
    const match = projects.find((p) => p.id === rawId);
    if (match) {
      autoRunRef.current = rawId;
      analyze.run(match);
    }
  }, [router.isReady, router.query.project, projects, loading, analyze.run]);

  return (
    <div className="space-y-6">
      <AnalyzeHeader compact />
      <ProjectSearch value={searchQuery} onChange={setSearchQuery} />

      <div>
        <h2 className="text-lg font-bold text-text-primary mb-4">Select a Project</h2>
        <ProjectGrid
          projects={filtered}
          loading={loading}
          selectedId={analyze.selected?.id}
          analyzing={analyze.loading}
          onSelect={analyze.run}
          searchQuery={searchQuery}
        />
      </div>

      {analyze.error && <AnalysisError message={analyze.error} />}
      {analyze.loading && <AnalysisLoading name={analyze.selected?.name} />}
      {analyze.result && !analyze.loading && (
        <AnalysisResult name={analyze.selected?.name} result={analyze.result} />
      )}
    </div>
  );
}
