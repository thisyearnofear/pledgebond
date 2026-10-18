/**
 * Builder Project Growth
 *
 * Shows the builder their Firestore-based projects alongside quality scores,
 * missing actions, milestone progress, and quick edit/view/share actions.
 * Sits alongside DeveloperDashboard (on-chain projects) on the /build Projects tab.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@/stores/authStore';
import { Card, CardHeader, CardTitle } from '@/components/common/Card';
import Button from '@/components/common/Button';
import { LoadingSpinner } from '@/components/common/LoadingStates';
import { getProjectQuality } from '@/lib/projects/projectQuality';
import { getEcosystemConfig } from '@/config/ecosystems';
import Link from 'next/link';
import QuickEditDrawer from '@/components/projects/QuickEditDrawer';
import { ProofBadgeGroup } from '@/components/common/ProofBadge';
import { computeBuilderBadges, computeProjectBadges } from '@/lib/badges/computeBadges';
import { trackEvent } from '@/lib/analytics';
import {
  SparklesIcon,
  ArrowTopRightOnSquareIcon,
  PencilSquareIcon,
  ShareIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  DocumentTextIcon,
  ChartBarIcon,
  LightBulbIcon,
  ClockIcon,
  ArchiveBoxArrowDownIcon,
} from '@heroicons/react/24/outline';

export default function BuilderProjectGrowth() {
  const { currentUser } = useUser();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedProject, setExpandedProject] = useState(null);
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [quickEditProject, setQuickEditProject] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function loadProjects() {
      setLoading(true);
      setError(null);
      try {
        const { db } = await import('@/lib/firebase/clientApp');
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const q = query(
          collection(db, 'projects'),
          where('submittedBy', '==', currentUser.uid)
        );
        const snap = await getDocs(q);
        if (!cancelled) {
          setProjects(
            snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          );
        }
      } catch (e) {
        console.warn('Failed to load builder projects:', e);
        if (!cancelled) setError(e.message || 'Failed to load projects');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadProjects();
    return () => { cancelled = true; };
  }, [currentUser]);

  // Aggregate missing items across all projects for the global checklist
  const aggregateMissing = useCallback(() => {
    const counts = {};
    const labels = {};
    for (const project of projects) {
      const quality = getProjectQuality(project);
      for (const item of quality.missing) {
        counts[item.id] = (counts[item.id] || 0) + 1;
        labels[item.id] = { label: item.label, action: item.action };
      }
    }
    // Sort by most projects missing this item
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([id, count]) => ({
        id,
        count,
        total: projects.length,
        ...(labels[id] || {}),
      }));
  }, [projects]);

  // Fetch follower count for the current builder
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    async function loadFollowers() {
      try {
        const res = await fetch(`/api/follows?targetUserId=${encodeURIComponent(currentUser.uid)}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setFollowerCount(data.followerCount || 0);
        }
      } catch {
        // Silently fail — non-critical UI feature
      }
    }
    loadFollowers();
    return () => { cancelled = true; };
  }, [currentUser]);

  const missingSummary = aggregateMissing();
  const hasProjects = projects.length > 0;

  // Compute builder badges from project data
  const builderBadges = useMemo(() => {
    if (!currentUser || projects.length === 0) return [];
    const avgHealth = projects.reduce((sum, p) => sum + (p.stats?.healthScore || 0), 0) / projects.length;

    // Derive verified wins from hackathon claims on the projects we already have
    const verifiedWins = projects.reduce((sum, p) => {
      if (!Array.isArray(p.hackathons)) return sum;
      return sum + p.hackathons.filter(
        (h) =>
          (h.outcome === 'winner' || h.outcome === 'bounty winner') &&
          (h.payoutVerifiedAt || h.payoutAt || h.payoutTxHash)
      ).length;
    }, 0);

    return computeBuilderBadges({
      user: {
        verifiedWinner: verifiedWins > 0,
        winnerData: { totalWins: verifiedWins },
      },
      projects,
      stats: { avgHealth: Math.round(avgHealth) },
      followerCount,
    });
  }, [currentUser, projects, followerCount]);

  // Track badge views (once per mount)
  const trackedRef = React.useRef(false);
  useEffect(() => {
    if (trackedRef.current) return;
    if (!builderBadges || builderBadges.length === 0) return;
    trackedRef.current = true;
    trackEvent("badge_viewed", {
      page: "builder-dashboard",
      badge_ids: builderBadges.map((b) => b.id),
      badge_tiers: builderBadges.map((b) => b.tier || "default"),
      count: builderBadges.length,
    });
  }, [builderBadges]);

  // Compute project-level badges for each project
  const projectBadgesMap = useMemo(() => {
    const map = {};
    for (const p of projects) {
      map[p.id] = computeProjectBadges(p);
    }
    return map;
  }, [projects]);

  const handleShare = async (slug, ecosystem) => {
    const url = `${window.location.origin}/projects/${ecosystem}/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 2000);
    } catch {
      // Fallback
      window.prompt('Copy project URL:', url);
    }
  };

  // Filter archived vs active
  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);
  const visibleProjects = showArchived ? projects : activeProjects;

  const handleQuickEditSaved = useCallback((updatedProject) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? { ...p, ...updatedProject } : p))
    );
  }, []);

  // ── Empty state ──
  if (!loading && !hasProjects) {
    return (
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <ChartBarIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            PROJECT GROWTH
          </h2>
          <Link href="/projects/new">
            <Button size="sm" variant="outline" leftIcon={<DocumentTextIcon className="w-4 h-4" />}>
              New Project
            </Button>
          </Link>
        </div>
        <Card className="p-12 bg-gradient-to-br from-slate-50 to-emerald-50 border-2 border-dashed border-slate-300 text-center">
          <div className="w-20 h-20 bg-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <ChartBarIcon className="w-10 h-10 text-slate-400 dark:text-slate-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">No Projects Yet</h3>
          <p className="text-slate-600 dark:text-slate-400 max-w-lg mx-auto mb-6">
            Submit your first project to start tracking quality scores, milestones, and listing improvements.
          </p>
          <Link href="/projects/new">
            <Button leftIcon={<DocumentTextIcon className="w-5 h-5" />}>
              Submit Your First Project
            </Button>
          </Link>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <ChartBarIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          PROJECT GROWTH
          {archivedProjects.length > 0 && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`ml-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                showArchived
                  ? 'bg-slate-200 text-slate-700 dark:text-slate-300'
                  : 'bg-slate-100 text-slate-500 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              <ArchiveBoxArrowDownIcon className="w-3 h-3" />
              {archivedProjects.length} archived
            </button>
          )}
        </h2>
        <Link href="/projects/new">
          <Button size="sm" variant="outline" leftIcon={<DocumentTextIcon className="w-4 h-4" />}>
            New Project
          </Button>
        </Link>
      </div>

      {/* Badge Progression — earned badges and next unlocks */}
      {builderBadges.length > 0 && (
        <Card className="p-5 border border-indigo-200 bg-gradient-to-r from-indigo-50/40 to-white">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <SparklesIcon className="w-6 h-6 text-indigo-700" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-indigo-900 text-lg mb-1">Your Badges</h3>
              <p className="text-indigo-600 dark:text-indigo-400 text-sm mb-3">
                {builderBadges.length} badge{builderBadges.length !== 1 ? 's' : ''} earned across your projects.
                Complete more signals to unlock additional recognition.
              </p>
              <ProofBadgeGroup
                badges={builderBadges}
                size="md"
                max={5}
                className="gap-2"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Global Improve Checklist */}
      {missingSummary.length > 0 && (
        <Card className="p-6 border border-amber-200 bg-amber-50/50">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <LightBulbIcon className="w-6 h-6 text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-amber-900 text-lg mb-1">Improve Your Listings</h3>
              <p className="text-amber-700 text-sm mb-4">
                {missingSummary.length} signal{missingSummary.length !== 1 ? 's' : ''} missing across your projects.
                Filling these helps backers and verifiers trust your work faster.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {missingSummary.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-amber-100 text-sm"
                  >
                    <ExclamationCircleIcon className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-slate-800 dark:text-slate-200 font-medium">{item.label}</span>
                      <span className="text-slate-400 dark:text-slate-500 ml-1 text-xs">
                        ({item.count}/{item.total})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <Card className="p-6 bg-red-50 border border-red-200">
          <div className="flex items-start gap-3">
            <ExclamationCircleIcon className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div>
              <p className="font-bold text-red-900 mb-1">Failed to load projects</p>
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Project Cards */}
      {!loading && hasProjects && (
        <div className="grid grid-cols-1 gap-4">
          {visibleProjects.map((project) => {
            const quality = getProjectQuality(project);
            const ecosystemConfig = getEcosystemConfig(project.ecosystem);
            const missing = quality.missing.slice(0, 3);
            const missingCount = quality.missing.length;
            const isExpanded = expandedProject === project.id;
            const slug = project.slug || project.id;
            const ecosystem = project.ecosystem || 'base';

            return (
              <Card
                key={project.id}
                className={`border transition-all duration-200 ${
                  quality.tier === 'Launch-ready'
                    ? 'border-emerald-200 bg-gradient-to-r from-emerald-50/30 to-white'
                    : quality.tier === 'Strong'
                    ? 'border-blue-200'
                    : 'border-slate-200'
                }`}
              >
                <div className="p-5">
                  {/* Top row: name, ecosystem, status */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/projects/${ecosystem}/${slug}`}
                          className="text-lg font-bold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:text-blue-400 transition-colors truncate"
                        >
                          {project.name || slug}
                        </Link>
                        {ecosystemConfig && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ecosystemConfig.bgColor} ${ecosystemConfig.textColor}`}
                          >
                            <span>{ecosystemConfig.icon}</span>
                            <span>{ecosystemConfig.shortName}</span>
                          </span>
                        )}
                        {project.status && project.status !== 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            <ClockIcon className="w-3 h-3" />
                            {String(project.status).replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      {project.description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                    </div>

                    {/* Quality score badge */}
                    <div className="flex-shrink-0 text-center">
                      <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                          quality.score >= 85
                            ? 'bg-emerald-100'
                            : quality.score >= 65
                            ? 'bg-blue-100'
                            : quality.score >= 40
                            ? 'bg-amber-100'
                            : 'bg-slate-100'
                        }`}
                      >
                        <span
                          className={`text-xl font-black ${
                            quality.score >= 85
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : quality.score >= 65
                              ? 'text-blue-700 dark:text-blue-300'
                              : quality.score >= 40
                              ? 'text-amber-700'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {quality.score}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider mt-1 block ${
                          quality.score >= 85
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : quality.score >= 65
                            ? 'text-blue-600 dark:text-blue-400'
                            : quality.score >= 40
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {quality.tier}
                      </span>
                    </div>
                  </div>

                  {/* Project badges */}
                  {projectBadgesMap[project.id]?.length > 0 && (
                    <div className="mb-3">
                      <ProofBadgeGroup
                        badges={projectBadgesMap[project.id]}
                        size="sm"
                        max={3}
                        noAnimation
                      />
                    </div>
                  )}

                  {/* Quality bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        quality.score >= 85
                          ? 'bg-emerald-500'
                          : quality.score >= 65
                          ? 'bg-blue-500'
                          : quality.score >= 40
                          ? 'bg-amber-500'
                          : 'bg-slate-300'
                      }`}
                      style={{ width: `${quality.score}%` }}
                    />
                  </div>

                  {/* Missing actions (compact) */}
                  {missing.length > 0 && (
                    <div className="space-y-1.5 mb-4">
                      {missing.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                          <ExclamationCircleIcon className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
                          <span className="truncate">{item.action}</span>
                        </div>
                      ))}
                      {missingCount > 3 && (
                        <button
                          onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                          className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-300 font-medium ml-5"
                        >
                          +{missingCount - 3} more
                        </button>
                      )}
                    </div>
                  )}

                  {/* Expanded: show all missing + milestone preview */}
                  {isExpanded && (
                    <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        All missing signals
                      </p>
                      {quality.missing.map((item) => (
                        <div key={item.id} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <ExclamationCircleIcon className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium">{item.label}</span>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{item.action}</p>
                          </div>
                        </div>
                      ))}

                      {Array.isArray(project.milestones) && project.milestones.length > 0 && (
                        <div className="pt-3 border-t border-slate-200">
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Milestones ({project.milestones.length})
                          </p>
                          <div className="space-y-1.5">
                            {project.milestones.slice(0, 3).map((m, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                                <CheckCircleIcon className="w-4 h-4 text-slate-300 dark:text-slate-500 flex-shrink-0 mt-0.5" />
                                <span className="text-xs line-clamp-2">{String(m)}</span>
                              </div>
                            ))}
                            {project.milestones.length > 3 && (
                              <p className="text-xs text-slate-400 dark:text-slate-500 ml-6">
                                +{project.milestones.length - 3} more
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {project.lookingForFunding && project.fundingAmount && (
                        <div className="pt-3 border-t border-slate-200">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium">
                            <SparklesIcon className="w-3.5 h-3.5" />
                            Seeking ${project.fundingAmount}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<PencilSquareIcon className="w-3.5 h-3.5" />}
                      onClick={() => setQuickEditProject(project)}
                    >
                      Edit
                    </Button>
                    <Link href={`/projects/${ecosystem}/${slug}`}>
                      <Button size="sm" variant="ghost" leftIcon={<ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />}>
                        View
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<ShareIcon className="w-3.5 h-3.5" />}
                      onClick={() => handleShare(slug, ecosystem)}
                    >
                      {copiedSlug === slug ? 'Copied!' : 'Share'}
                    </Button>
                    <button
                      onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                      className="ml-auto text-xs text-slate-400 hover:text-slate-600 dark:text-slate-400 font-medium transition-colors"
                    >
                      {isExpanded ? 'Less' : 'Details'}
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {/* Quick Edit Drawer */}
      {quickEditProject && (
        <QuickEditDrawer
          project={quickEditProject}
          onClose={() => setQuickEditProject(null)}
          onSaved={handleQuickEditSaved}
        />
      )}
    </section>
  );
}
