import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

import { useUser } from "@/stores/authStore";
import { useApp } from "@/stores/profileStore";
import { useEnhancedGithub } from "@/providers/Github/EnhancedGithubProvider";
import { Card } from "@/components/common/Card";
import Button from "@/components/common/Button";
import { LoadingSpinner } from "@/components/common/LoadingStates";
import { getEcosystemConfig } from "@/config/ecosystems";
import { db as clientDb } from "@/lib/firebase/clientApp";
import { collection, getDocs, limit, orderBy, query, where, getDoc, doc } from "firebase/firestore";
import { getGitHubUrl } from "@/utils/projectUtils";
import ethosService from "@/services/EthosService";
import { EthosScoreBadge } from "@/components/ethos";
import ShipsLog from "@/components/projects/ShipsLog";
import LeaderboardRankBadge from "@/components/common/LeaderboardRankBadge";
import ProofBadge, { ProofBadgeGroup } from "@/components/common/ProofBadge";
import { computeProjectBadges } from "@/lib/badges/computeBadges";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import { SkeletonDetailPage } from "@/components/common/LoadingStates";
import BackerActivity from "@/components/projects/BackerActivity";
import { ProjectHero, ProjectMilestoneTimeline, ProjectProofPanel } from "@/components/projects/ProjectShowcase";
import BuilderIdentityPanel from "@/components/projects/BuilderIdentityPanel";
import ProjectLinksPanel from "@/components/projects/ProjectLinksPanel";
import ProjectBackerSummary from "@/components/projects/ProjectBackerSummary";
import EnhancedDetailsSection from "@/components/projects/EnhancedDetailsSection";

import GenlayerVerdictCard from "@/components/genlayer/GenlayerVerdictCard";
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  TagIcon,
  CurrencyDollarIcon,
  ShieldExclamationIcon,
  CheckBadgeIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";

export default function ProjectDetailPage() {
  const router = useRouter();
  const { ecosystem, slug } = router.query;
  const { currentUser } = useUser();
  const { getProject, loadProjectDetails } = useEnhancedGithub();
  const { trackProjectInteraction, trackEcosystemInteraction, updatePreference, getAdaptiveSettings } = useApp();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [recentFeedback, setRecentFeedback] = useState([]);
  const [isAdminClient, setIsAdminClient] = useState(false);
  const [ownerEthosUser, setOwnerEthosUser] = useState(null);
  const [ownerEthosLoading, setOwnerEthosLoading] = useState(false);
  const [verifiedClaims, setVerifiedClaims] = useState(null);
  const [claimsVerifying, setClaimsVerifying] = useState(false);
  const [genlayer, setGenlayer] = useState(null);
  const [genlayerLoading, setGenlayerLoading] = useState(false);
  const [expandedClaim, setExpandedClaim] = useState(null);
  // Adaptive density: beginners get the first claim expanded + hints;
  // intermediate+ get everything collapsed. Resolved at mount (never mid-render)
  // and overridable via the density toggle (preferredComplexity).
  const adaptive = useMemo(() => getAdaptiveSettings(), [getAdaptiveSettings]);

  // Compute badges from project data
  const projectBadges = useMemo(() => {
    if (!project) return [];
    return computeProjectBadges(project);
  }, [project]);

  useEffect(() => {
    if (!ecosystem || !slug) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const data = await getProject(slug, ecosystem);
        if (!data) throw new Error("Project not found");

        if (!cancelled) {
          setProject(data);
          // Feed the ecosystem learning loop (favorites + ranking).
          try {
            trackProjectInteraction(String(slug), String(data.ecosystem || ecosystem || ""));
            updatePreference("lastVisitedEcosystem", String(data.ecosystem || ecosystem || ""));
          } catch {}
          // Beginners see the first claim expanded once; everyone else collapsed.
          if (adaptive.showHints && expandedClaim === null && Array.isArray(data.hackathons) && data.hackathons.length > 0) {
            setExpandedClaim(0);
          }
        }

        // Load recent feedback previews (client-side, 5 latest)
        try {
          const q = query(
            collection(clientDb, 'feedback'),
            where('projectSlug', '==', String(slug)),
            orderBy('createdAt', 'desc'),
            limit(5)
          );
          const snaps = await getDocs(q);
          if (!cancelled) {
            const items = snaps.docs.map(d => ({ id: d.id, ...d.data() }));
            setRecentFeedback(items);
          }
        } catch (_) {
          if (!cancelled) setRecentFeedback([]);
        }

        // Opportunistically load extra details (issues/PRs) in the background.
        loadProjectDetails(slug, ecosystem).catch(() => {});

        // Verify hackathon claims
        if (Array.isArray(data.hackathons) && data.hackathons.length > 0) {
          setClaimsVerifying(true);
          fetch('/api/agent/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'claim_verification', project: { hackathons: data.hackathons } }),
          })
            .then(r => r.json().catch(() => ({})))
            .then(body => {
              if (!cancelled && body.success && body.analysis?.claims) {
                setVerifiedClaims(body.analysis.claims);
              }
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setClaimsVerifying(false); });

          // GenLayer jury: resolve first milestone with public evidence (mock-safe)
          const firstEvidence = data.hackathons.find((h) => h.evidenceUrl || h.url || h.submissionUrl);
          const evidenceUrl = firstEvidence?.evidenceUrl || firstEvidence?.url || firstEvidence?.submissionUrl;
          if (evidenceUrl) {
            setGenlayerLoading(true);
            fetch('/api/agent/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'genlayer_verdict',
                description: `${data.name || slug} — ${firstEvidence?.name || 'milestone delivery'}`,
                evidenceUrl,
                criteria: 'Deliverable exists at the evidence URL and meets the stated outcome.',
              }),
            })
              .then(r => r.json().catch(() => ({})))
              .then(body => { if (!cancelled && body.success) setGenlayer({ ...body.analysis, evidenceUrl }); })
              .catch(() => {})
              .finally(() => { if (!cancelled) setGenlayerLoading(false); });
          }
        }
        
        // Fetch Ethos score for project owner
        if (data.ownerWalletAddress && !cancelled) {
          setOwnerEthosLoading(true);
          try {
            const ethosData = await ethosService.getScoresByAddress(data.ownerWalletAddress);
            if (!cancelled) setOwnerEthosUser(ethosData);
          } catch (e) {
            console.error('Failed to fetch owner Ethos score:', e);
          } finally {
            if (!cancelled) setOwnerEthosLoading(false);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load project");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [ecosystem, slug]);

  // Client-side admin check (server still enforces)
  useEffect(() => {
    let cancelled = false;
    async function checkAdmin() {
      try {
        if (!currentUser?.uid) { setIsAdminClient(false); return; }
        const snap = await getDoc(doc(clientDb, 'admins', currentUser.uid));
        const admin = snap.exists();
        if (!cancelled) setIsAdminClient(Boolean(admin));
      } catch {
        if (!cancelled) setIsAdminClient(false);
      }
    }
    checkAdmin();
    return () => { cancelled = true; };
  }, [currentUser?.uid]);

  const ecosystemConfig = useMemo(
    () => getEcosystemConfig(project?.ecosystem || ecosystem),
    [project?.ecosystem, ecosystem]
  );

  const githubUrl = useMemo(() => (project ? getGitHubUrl(project) : null), [
    project,
  ]);

  const canEdit = useMemo(() => {
    return Boolean(currentUser && (isAdminClient || project?.owners?.includes(currentUser.uid)));
  }, [currentUser, isAdminClient, project?.owners]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SkeletonDetailPage />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold text-primary mb-2">
            Couldn’t load project
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <Button variant="outline" onClick={() => router.push("/explore")}>
            Back to projects
          </Button>
        </Card>
      </div>
    );
  }

  if (!project) return null;

  const title = project.name || project.slug;

  return (
    <>
      <Head>
        <title>
          {title}
          {ecosystemConfig?.shortName ? ` • ${ecosystemConfig.shortName}` : ""}
        </title>
        <meta
          name="description"
          content={project.description || `${title} — a ${ecosystemConfig?.shortName || ecosystem} project on PledgeBond.`}
        />
        <meta property="og:title" content={`${title}${ecosystemConfig?.shortName ? ` • ${ecosystemConfig.shortName}` : ""} — PledgeBond`} />
        <meta
          property="og:description"
          content={project.description ? `${project.description.slice(0, 200)}${project.description.length > 200 ? "..." : ""}` : `${title} on ${ecosystemConfig?.shortName || ecosystem}`}
        />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`https://pledgebond.com/projects/${ecosystem}/${slug}`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${title}${ecosystemConfig?.shortName ? ` • ${ecosystemConfig.shortName}` : ""} — PledgeBond`} />
        <meta
          name="twitter:description"
          content={project.description?.slice(0, 200) || `${title} on ${ecosystemConfig?.shortName || ecosystem}`}
        />
        {(() => {
          const ogParams = new URLSearchParams({
            type: "project",
            name: title || "",
            ecosystem: project.ecosystem || ecosystem || "",
            description: (project.description || "").slice(0, 300),
            stars: String(project.stats?.stars || 0),
            health: String(project.stats?.healthScore || project.stats?.velocity || 0),
            verified: project.verified ? "true" : "false",
          });
          // Add top badge labels for OG image rendering
          if (projectBadges.length > 0) {
            ogParams.set("badges", projectBadges.slice(0, 5).map((b) => b.label).join(","));
          }
          return (
            <>
              <meta property="og:image" content={`/api/og?${ogParams.toString()}`} />
              <meta name="twitter:image" content={`/api/og?${ogParams.toString()}`} />
            </>
          );
        })()}
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <Breadcrumbs items={[
            { label: "Explore", href: "/explore" },
            { label: ecosystemConfig?.shortName || ecosystem, href: `/explore?ecosystem=${ecosystem}` },
            { label: title },
          ]} />
          <DensityToggle adaptive={adaptive} updatePreference={updatePreference} />
          
          <ProjectHero
            project={project}
            ecosystemConfig={ecosystemConfig}
            title={title}
            githubUrl={githubUrl}
            canEdit={canEdit}
            onEdit={() => router.push(`/projects/${project.ecosystem || ecosystem}/${slug}/edit`)}
            onOpen={(url) => window.open(url, "_blank", "noopener,noreferrer")}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <ProjectMilestoneTimeline milestones={project.milestones} />

              <EnhancedDetailsSection project={project} />

              {project.lookingForFunding && project.fundingAmount && (
                <Card className="p-5 border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-10 h-10 bg-emerald-200 rounded-xl flex items-center justify-center">
                      <CurrencyDollarIcon className="w-6 h-6 text-emerald-700 dark:text-emerald-300" />
                    </span>
                    <div>
                      <h2 className="text-lg font-bold text-primary">Seeking funding</h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        This project is looking for ${Number(project.fundingAmount).toLocaleString()} in support
                      </p>
                    </div>
                  </div>
                  {Array.isArray(project.milestones) && project.milestones.length > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 ml-[3.25rem]">
                      {project.milestones.length} milestone{project.milestones.length > 1 ? 's' : ''} defined
                    </p>
                  )}
                </Card>
              )}

              <BackerActivity projectSlug={slug} />
              
              <ShipsLog projectSlug={slug} canEdit={canEdit} />
              
              <Card className="p-6 border-0 shadow-lg rounded-2xl overflow-hidden">
                <h2 className="text-xl font-bold text-primary mb-6 flex items-center gap-2">
                  <span className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <ClockIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </span>
                  Recent tester submissions
                </h2>
                {recentFeedback.length > 0 ? (
                  <div className="space-y-4">
                    {recentFeedback.map((f) => (
                      <div key={f.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-amber-200 transition-all">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${f.status === 'accepted' ? 'bg-green-100 text-green-700 dark:text-green-300' : f.status === 'rejected' ? 'bg-red-100 text-red-700 dark:text-red-300' : 'bg-gray-100 text-gray-700 dark:text-gray-300'}`}>{f.status || 'submitted'}</span>
                              {f.status === 'accepted' && f.acceptedAt && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:text-blue-300">Paid</span>
                              )}
                              {f.taskId && <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Task: {f.taskId}</span>}
                            </div>
                            <p className="text-gray-700 dark:text-gray-300 mt-3 line-clamp-3">{f.message}</p>
                            {Array.isArray(f.attachments) && f.attachments.length > 0 && (
                              <div className="flex flex-wrap items-center gap-2 mt-3">
                                {f.attachments.slice(0,3).map((u, idx) => (
                                  <AttachmentThumb key={idx} url={u} />
                                ))}
                              </div>
                            )}
                          </div>
                          <Button variant="outline" size="sm" onClick={() => router.push(`/feedback?project=${encodeURIComponent(slug)}`)} className="shrink-0">
                            Give feedback
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-gray-500 dark:text-gray-400 text-lg">No recent submissions.</p>
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-6">
              <ProjectProofPanel project={project} />

              {project?.slug && (
                <Card className="p-5 border-0 shadow-lg rounded-2xl overflow-hidden">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                    <span className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center">
                      <TrophyIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </span>
                    Leaderboard
                  </h2>
                  <LeaderboardRankBadge
                    type="project"
                    identifier={project.slug}
                    ecosystem={project.ecosystem}
                    showLink
                  />
                </Card>
              )}

              {projectBadges.length > 0 && (
                <Card className="p-5 border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-amber-50 to-yellow-50">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-8 h-8 bg-amber-200 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.746 3.746 0 0121 12z" />
                      </svg>
                    </span>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Badges</span>
                  </div>
                  <ProofBadgeGroup badges={projectBadges} size="sm" max={5} />
                </Card>
              )}

              <ProjectLinksPanel project={project} />


              <BuilderIdentityPanel
                project={project}
                ownerEthosUser={ownerEthosUser}
                ownerEthosLoading={ownerEthosLoading}
                EthosScoreBadge={EthosScoreBadge}
              />

              <ProjectBackerSummary
                project={project}
                onFeedback={() => router.push(`/feedback?project=${encodeURIComponent(slug)}`)}
              />
            </div>
          </div>

          <Card className="p-6 border-0 shadow-lg rounded-2xl overflow-hidden">
            <h2 className="text-xl font-bold text-primary mb-6 flex items-center gap-2">
              <span className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center">
                <TagIcon className="w-6 h-6 text-pink-600 dark:text-pink-400" />
              </span>
              Hackathons
            </h2>

            {Array.isArray(project.hackathons) && project.hackathons.length > 0 ? (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {project.hackathons.length} tracked
                  {verifiedClaims?.some((c) => c.onChainVerification?.verified || c.jury?.verdict === "DELIVERED")
                    ? " · verified" : claimsVerifying ? " · verifying…" : ""}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.hackathons.map((h, idx) => {
                  const vc = verifiedClaims?.[idx];
                  const open = expandedClaim === idx;
                  return (
                  <div key={idx} className="p-5 bg-gray-50 rounded-xl border border-gray-100 hover:border-pink-200 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-bold text-primary text-lg">
                            {h.name || `Hackathon ${idx + 1}`}
                          </h3>
                          <ClaimVerificationBadge claim={vc} loading={claimsVerifying} />
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                          {h.outcome ? `Outcome: ${h.outcome}` : "Outcome: —"}
                          {h.prizeAmount ? ` · ${h.prizeAmount}` : ""}
                        </p>
                        {open && (
                          <div className="mt-1">
                        {h.track && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Track: {h.track}</p>
                        )}
                        {h.payoutWallet && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-all">Payout wallet: {h.payoutWallet}</p>
                        )}
                        {h.payoutTxHash && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-all">Payout tx: {h.payoutTxHash}</p>
                        )}
                        {h.contractAddress && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-all">Contract / deployment: {h.contractAddress}</p>
                        )}
                        {h.notes && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{h.notes}</p>
                        )}
                        {h.judgingNotes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Judge / reviewer context: {h.judgingNotes}</p>
                        )}
                          </div>
                        )}
                        {idx === 0 && (genlayer || genlayerLoading) && (
                          <div className="mt-3">
                            {genlayerLoading && !genlayer ? (
                              <p className="text-xs text-gray-500 dark:text-gray-400" aria-live="polite">⚖️ Jury reading evidence…</p>
                            ) : (
                              <GenlayerVerdictCard
                                verdict={genlayer.genlayer}
                                creditSignal={genlayer.creditSignal}
                                contractAddress={genlayer.genlayer?.contractAddress}
                                evidenceUrl={genlayer.evidenceUrl}
                              />
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <button
                          onClick={() => setExpandedClaim(open ? null : idx)}
                          aria-expanded={open}
                          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
                        >
                          {open ? "Less" : "Details"}
                        </button>
                        {open && vc && (
                          <button
                            onClick={() => {
                              const s = vc;
                              alert(
                                `Signals: ${s.signals?.join(', ') || 'none'}\nMissing: ${s.missing?.join(', ') || 'none'}\nCredibility: ${s.credibility || 'unknown'}\nScore: ${s.signalScore || 0}/100`
                              );
                            }}
                            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 underline"
                            title="View verification details"
                          >
                            Signals
                          </button>
                        )}
                        {open && h.url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(h.url, "_blank", "noopener,noreferrer")
                            }
                            rightIcon={<ArrowTopRightOnSquareIcon className="w-4 h-4" />}
                          >
                            Link
                          </Button>
                        )}
                        {open && h.submissionUrl && h.submissionUrl !== h.url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(h.submissionUrl, "_blank", "noopener,noreferrer")
                            }
                          >
                            Submission
                          </Button>
                        )}
                        {open && h.announcementUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(h.announcementUrl, "_blank", "noopener,noreferrer")
                            }
                          >
                            Announcement
                          </Button>
                        )}
                        {open && h.evidenceUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(h.evidenceUrl, "_blank", "noopener,noreferrer")
                            }
                          >
                            Evidence
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-10">
                <p className="text-gray-500 dark:text-gray-400 text-lg">No hackathon submissions tracked yet.</p>
              </div>
            )}
          </Card>

          <Card className="p-6 border-0 shadow-lg rounded-2xl overflow-hidden">
            <h2 className="text-xl font-bold text-primary mb-2 flex items-center gap-2">
              <span className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                <TagIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </span>
              Earn by testing
            </h2>
            {Array.isArray(project.testerTasks) && project.testerTasks.length > 0 ? (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {project.testerTasks.length} open ·{" "}
                  {Math.max(...project.testerTasks.map((t) => Number(t.rewardUSDC || 0)))} USDC top reward
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.testerTasks.map((t) => {
                  const taskOpen = expandedClaim === `task-${t.id}`;
                  return (
                  <div key={t.id} className="p-5 bg-gray-50 rounded-xl border border-gray-100 hover:border-yellow-200 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-primary text-lg">{t.title}</h3>
                        <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold mt-1">
                          {Number(t.rewardUSDC || 0)} USDC
                        </p>
                        {taskOpen && (
                          <>
                            {t.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t.description}</p>
                            )}
                            {Array.isArray(t.evidenceRequirements) && t.evidenceRequirements.length > 0 && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                Evidence: {t.evidenceRequirements.join(', ')}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <button
                          onClick={() => setExpandedClaim(taskOpen ? null : `task-${t.id}`)}
                          aria-expanded={taskOpen}
                          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
                        >
                          {taskOpen ? "Less" : "Details"}
                        </button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/feedback?project=${encodeURIComponent(slug)}&taskId=${encodeURIComponent(t.id)}`)}
                          className="shrink-0"
                        >
                          Submit evidence
                        </Button>
                      </div>
                    </div>
                  </div>
                  );
                })}
                </div>
              </>
            ) : null}
          </Card>

          {isAdminClient && (
            <details className="rounded-2xl border-2 border-red-200 bg-red-50 overflow-hidden">
              <summary className="p-5 cursor-pointer text-sm font-semibold text-red-900 list-none flex items-center gap-3">
                <span className="w-8 h-8 bg-red-200 rounded-xl flex items-center justify-center">
                  <CheckCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                </span>
                Admin controls
              </summary>
              <div className="px-6 pb-6">
              <p className="text-sm text-red-800 mb-6">Approve a tester reward by feedback ID. Server-side admin check is enforced.</p>

              <AdminApproveForm projectSlug={slug} />

              <div className="mt-8 pt-6 border-t border-red-200">
                <h3 className="text-lg font-semibold text-red-900 mb-3">Bulk approvals</h3>
                <p className="text-sm text-red-700 dark:text-red-300 mb-4">Paste JSON array or CSV with headers: feedbackId,projectSlug,taskId,destinationAddress,amount. Source wallet applies to all rows.</p>
                <BulkApproveForm projectSlug={slug} />
              </div>
              </div>
            </details>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * DensityToggle — explicit adaptivity control.
 * Essentials (collapsed) vs Everything (expanded). Persists to
 * preferredComplexity so getAdaptiveSettings() respects the override.
 */
function DensityToggle({ adaptive, updatePreference }) {
  const mode = adaptive?.defaultComplexity || "simple";
  const set = (v) => {
    try { updatePreference("preferredComplexity", v); } catch {}
  };
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400" role="group" aria-label="Detail density">
      <span className="font-medium">Show me:</span>
      <div className="inline-flex rounded-full border border-default p-0.5" role="tablist" aria-label="Density">
        {[
          { id: "simple", label: "Essentials" },
          { id: "advanced", label: "Everything" },
        ].map((o) => (
          <button
            key={o.id}
            role="tab"
            aria-selected={(mode === "advanced") === (o.id === "advanced")}
            onClick={() => set(o.id)}
            className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
              (mode === "advanced") === (o.id === "advanced")
                ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                : "hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AttachmentThumb({ url }) {
  try {
    const u = new URL(url);
    const host = u.host;
    const isImgur = host.includes('imgur.com');
    const isYouTube = host.includes('youtube.com') || host.includes('youtu.be');
    const isLoom = host.includes('loom.com');

    if (isImgur) {
      return (
        <a href={url} target="_blank" rel="noreferrer" className="block w-20 h-14 bg-gray-100 rounded overflow-hidden">
          <img src={url} alt="attachment" className="w-full h-full object-cover" />
        </a>
      );
    }
    if (isYouTube) {
      // best-effort thumbnail
      let id = '';
      if (u.searchParams.get('v')) id = u.searchParams.get('v');
      const pathParts = u.pathname.split('/').filter(Boolean);
      if (!id && pathParts.length) id = pathParts[pathParts.length-1];
      const thumb = id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
      return (
        <a href={url} target="_blank" rel="noreferrer" className="block w-20 h-14 bg-gray-100 rounded overflow-hidden">
          {thumb ? <img src={thumb} alt="video" className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">Video</div>}
        </a>
      );
    }
    if (isLoom) {
      return (
        <a href={url} target="_blank" rel="noreferrer" className="block w-20 h-14 bg-gray-100 rounded overflow-hidden">
          <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">Loom</div>
        </a>
      );
    }
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block w-20 h-14 bg-gray-100 rounded overflow-hidden">
        <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">Link</div>
      </a>
    );
  } catch {
    return null;
  }
}

function AdminApproveForm({ projectSlug }) {
  const router = useRouter();
  const [feedbackId, setFeedbackId] = React.useState('');
  const [taskId, setTaskId] = React.useState('');
  const [destinationAddress, setDestinationAddress] = React.useState('');
  const [sourceWalletId, setSourceWalletId] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [success, setSuccess] = React.useState(null);

  const prefillFromFeedback = async (id) => {
    try {
      if (!id) return;
      const res = await fetch(`/api/feedback?id=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.feedback && data.user && data.user.walletAddress) {
        setDestinationAddress(data.user.walletAddress);
      }
    } catch (_) {}
  };

  const onApprove = async () => {
    setError(null); setSuccess(null);
    try {
      setLoading(true);
      const res = await fetch('/api/funding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approveTesterReward',
          feedbackId,
          projectSlug,
          taskId,
          sourceWalletId,
          destinationAddress,
          amount: amount ? Number(amount) : undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Approval failed');
      setSuccess('Approved and payout initiated');
      setFeedbackId(''); setTaskId(''); setDestinationAddress(''); setAmount('');
    } catch (e) {
      setError(e.message || 'Approval failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-3 max-w-xl">
      {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}
      {success && <div className="text-sm text-green-700 dark:text-green-300">{success}</div>}
      <input className="border p-2 rounded" placeholder="Feedback ID" value={feedbackId} onChange={e=>{ setFeedbackId(e.target.value); prefillFromFeedback(e.target.value); }} />
      <input className="border p-2 rounded" placeholder="Task ID" value={taskId} onChange={e=>setTaskId(e.target.value)} />
      <input className="border p-2 rounded" placeholder="Source Wallet ID" value={sourceWalletId} onChange={e=>setSourceWalletId(e.target.value)} />
      <input className="border p-2 rounded" placeholder="Destination Address" value={destinationAddress} onChange={e=>setDestinationAddress(e.target.value)} />
      <input className="border p-2 rounded" placeholder="Amount (optional)" value={amount} onChange={e=>setAmount(e.target.value)} />
      <div>
        <Button loading={loading} onClick={onApprove}>Approve & Pay</Button>
      </div>
    </div>
  );
}

function BulkApproveForm({ projectSlug }) {
  const [bulkText, setBulkText] = React.useState('');
  const [sourceWalletId, setSourceWalletId] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState(null);

  const parseInput = () => {
    const text = bulkText.trim();
    if (!text) return [];
    // Try JSON array first
    if (text.startsWith('[')) {
      try {
        const arr = JSON.parse(text);
        if (Array.isArray(arr)) return arr.map((it) => ({ projectSlug, ...it }));
      } catch (_) {}
    }
    // Try CSV
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map((h) => h.trim());
    const idx = {
      feedbackId: headers.indexOf('feedbackId'),
      projectSlug: headers.indexOf('projectSlug'),
      taskId: headers.indexOf('taskId'),
      destinationAddress: headers.indexOf('destinationAddress'),
      amount: headers.indexOf('amount'),
    };
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      const row = {
        feedbackId: idx.feedbackId >= 0 ? cols[idx.feedbackId] : undefined,
        projectSlug: idx.projectSlug >= 0 ? cols[idx.projectSlug] : projectSlug,
        taskId: idx.taskId >= 0 ? cols[idx.taskId] : undefined,
        destinationAddress: idx.destinationAddress >= 0 ? cols[idx.destinationAddress] : undefined,
      };
      const amountStr = idx.amount >= 0 ? cols[idx.amount] : undefined;
      if (amountStr) {
        const n = Number(amountStr);
        if (!Number.isNaN(n)) row.amount = n;
      }
      rows.push(row);
    }
    return rows;
  };

  const onSubmit = async () => {
    setError(null); setResult(null);
    try {
      setLoading(true);
      const items = parseInput();
      if (!Array.isArray(items) || items.length === 0) {
        setError('No valid items parsed');
        setLoading(false);
        return;
      }
      const res = await fetch('/api/funding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulkApproveTesterRewards', items, sourceWalletId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Bulk approve failed');
      setResult(body.results || []);
      setBulkText('');
    } catch (e) {
      setError(e.message || 'Bulk approve failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-3 max-w-2xl">
      {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}
      {Array.isArray(result) && result.length > 0 && (
        <div className="text-sm">
          <div className="font-medium mb-1">Results</div>
          <ul className="space-y-1">
            {result.map((r, i) => (
              <li key={i} className={r.ok ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                {r.feedbackId || 'row'}: {r.ok ? 'ok' : r.error}
              </li>
            ))}
          </ul>
        </div>
      )}
      <textarea className="border p-2 rounded min-h-[120px]" placeholder="Paste JSON array or CSV here" value={bulkText} onChange={(e)=>setBulkText(e.target.value)} />
      <input className="border p-2 rounded" placeholder="Source Wallet ID" value={sourceWalletId} onChange={(e)=>setSourceWalletId(e.target.value)} />
      <div>
        <Button loading={loading} onClick={onSubmit}>Process batch</Button>
      </div>
    </div>
  );
}

function ClaimVerificationBadge({ claim, loading }) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 dark:text-gray-500 text-xs">
        <span className="w-3 h-3 rounded-full bg-gray-300 animate-pulse" />
        Verifying...
      </span>
    );
  }

  if (!claim) return null;

  if (claim.credibility === 'high') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 dark:text-green-300 text-xs font-medium border border-green-200">
        <CheckBadgeIcon className="w-3.5 h-3.5" />
        Verified
      </span>
    );
  }

  if (claim.credibility === 'medium') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
        <ShieldExclamationIcon className="w-3.5 h-3.5" />
        Partial
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:text-red-300 text-xs font-medium border border-red-200">
      <ShieldExclamationIcon className="w-3.5 h-3.5" />
      Unverified
    </span>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-primary font-mono text-right break-all">
        {value}
      </div>
    </div>
  );
}
