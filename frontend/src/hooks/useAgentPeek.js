/**
 * useAgentPeek — free cached-agent summaries for project surfaces.
 *
 * Reads /api/agent/peek (cache-only, no inference, no payment) and shows
 * the first paying caller's Underwriter run to everyone else. 204s are
 * cached per session+project so an uncached project never re-polls.
 *
 * Surfaces: backer ProjectCard badge, project detail page. The goal is
 * "agents felt, not visited" — cached intelligence renders inline.
 */

import { useEffect, useState } from "react";

/** @type {Map<string, object | null>} session-level memo: projectId → peek or null */
const sessionPeeks = new Map();

/**
 * @param {string|null} projectId
 * @returns {{ peek: object | null, loading: boolean }}
 */
export default function useAgentPeek(projectId) {
  const [peek, setPeek] = useState(() => (projectId ? sessionPeeks.get(projectId) ?? null : null));
  const [loading, setLoading] = useState(() => Boolean(projectId) && !sessionPeeks.has(projectId));

  useEffect(() => {
    if (!projectId) return;

    // Already resolved this session (or known-uncached) — no fetch.
    if (sessionPeeks.has(projectId)) {
      setPeek(sessionPeeks.get(projectId) ?? null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/agent/peek?projectId=${encodeURIComponent(projectId)}`)
      .then(async (res) => {
        if (res.status === 204) return null; // nothing cached yet
        if (!res.ok) return null;
        try {
          const data = await res.json();
          return data?.success ? data : null;
        } catch {
          return null;
        }
      })
      .then((data) => {
        sessionPeeks.set(projectId, data);
        if (!cancelled) {
          setPeek(data);
          setLoading(false);
        }
      })
      .catch(() => {
        sessionPeeks.set(projectId, null);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { peek, loading };
}
