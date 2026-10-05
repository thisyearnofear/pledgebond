/**
 * ProjectEditor — Multi-step form for creating and editing projects.
 *
 * Orchestration only. State and handlers live here; visual sections are
 * extracted into `components/projects/editor/`. Draft persistence, image
 * upload, and GitHub auto-import are extracted into dedicated hooks.
 */

import { useEffect, useMemo, useState } from "react";

import { useUser } from "@/stores/authStore";
import { useBuilderCredit } from "@/stores/walletStore";
import { Card } from "@/components/common/Card";
import Button from "@/components/common/Button";
import { LoadingSpinner } from "@/components/common/LoadingStates";
import { getAllEcosystems, getEcosystemConfig } from "@/config/ecosystems";
import ProjectPreviewPanel from "@/components/projects/ProjectPreviewPanel";
import WinnerGate from "@/components/projects/WinnerGate";
import useWinnerStatus from "@/hooks/useWinnerStatus";
import { useProjectDraft, loadLocalDraft } from "@/hooks/useProjectDraft";
import { useProjectImage } from "@/hooks/useProjectImage";
import { useGithubImport } from "@/hooks/useGithubImport";
import { normalizeProjectInput, validateProjectInput } from "@/lib/projects/projectNormalize";
import { parseGitHubRepoUrl } from "@/lib/projects/githubRepo";
import { ArchiveBoxArrowDownIcon } from "@heroicons/react/24/outline";

import {
  ProjectEditorHeader,
  ProjectEditorBasics,
  ProjectEditorProof,
  ProjectEditorReview,
  ProjectEditorCelebration,
  ProjectEditorStepNav,
} from "@/components/projects/editor";

const DEFAULT_CATEGORIES = [
  { id: "defi", name: "DeFi" },
  { id: "nft", name: "NFTs" },
  { id: "gaming", name: "Gaming" },
  { id: "social", name: "Social" },
  { id: "infrastructure", name: "Infrastructure" },
  { id: "dao", name: "DAO" },
  { id: "other", name: "Other" },
];

const EMPTY_HACKATHON = () => ({
  name: "",
  url: "",
  outcome: "",
  payoutAt: "",
  notes: "",
  track: "",
  prizeAmount: "",
  payoutWallet: "",
  payoutTxHash: "",
  announcementUrl: "",
  submissionUrl: "",
  evidenceUrl: "",
  judgingNotes: "",
  proofType: "",
  repoUrl: "",
  contractAddress: "",
  verificationStatus: "self_attested",
});

export default function ProjectEditor({ projectSlug }) {
  const { currentUser } = useUser();
  const { isVerified, pendingClaim, loading: winnerLoading, error: winnerError, submitClaim } = useWinnerStatus();
  const { connected, activeChainFamily } = useBuilderCredit();

  const githubUsername = currentUser?.reloadUserInfo?.screenName
    || currentUser?.providerData?.find((p) => p.providerId === "github.com")?.displayName?.toLowerCase().replace(/\s/g, '')
    || null;

  const isEditMode = Boolean(projectSlug);
  const draft = isEditMode ? null : loadLocalDraft();

  const [loading, setLoading] = useState(Boolean(projectSlug));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [submittedSlug, setSubmittedSlug] = useState(null);
  const [existingProjectConflict, setExistingProjectConflict] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [improvingListing, setImprovingListing] = useState(false);
  const [listingSuggestions, setListingSuggestions] = useState([]);
  const [wizardStep, setWizardStep] = useState(1);
  const [projectOwners, setProjectOwners] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const [form, setForm] = useState(() => ({
    name: draft?.name || "",
    description: draft?.description || "",
    githubUrl: draft?.githubUrl || "",
    ecosystem: draft?.ecosystem || (activeChainFamily === "solana" ? "solana" : "base"),
    category: draft?.category || "",
    contractAddress: draft?.contractAddress || "",
    deploymentTxHash: draft?.deploymentTxHash || "",
    website: draft?.website || "",
    twitter: draft?.twitter || "",
    discord: draft?.discord || "",
    teamMembers: draft?.teamMembers || [{ address: "", share: 100 }],
    tags: draft?.tags || "",
    isOpenSource: draft?.isOpenSource ?? true,
    lookingForFunding: draft?.lookingForFunding || false,
    fundingAmount: draft?.fundingAmount || "",
    milestones: draft?.milestones || [""],
    hackathons: draft?.hackathons || [],
    launchOnBags: draft?.launchOnBags || false,
    bagsTokenMetadata: draft?.bagsTokenMetadata || { name: "", symbol: "", description: "" },
    liveUrl: draft?.liveUrl || "",
    otherCategoryDetail: draft?.otherCategoryDetail || "",
    accentColor: draft?.accentColor || null,
    archived: draft?.archived || false,
  }));

  const draftCtl = useProjectDraft({ form, imageUrl: "", isEditMode, currentUser, projectSlug });
  const image = useProjectImage({
    projectSlug,
    currentUser,
    initialHero: draft?.imageUrl || "",
    initialGallery: draft?.media || [],
  });
  const github = useGithubImport({
    githubUrl: form.githubUrl,
    isEditMode,
    githubUsername,
    setForm,
    setError,
  });

  useEffect(() => {
    if (!projectSlug) return;
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/projects/${projectSlug}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load project");
        }
        const project = await res.json();
        if (cancelled) return;
        setProjectOwners(Array.isArray(project.owners) ? project.owners : []);
        if (currentUser?.uid) {
          const { db } = await import('@/lib/firebase/clientApp');
          const { doc, getDoc } = await import('firebase/firestore');
          const adminSnap = await getDoc(doc(db, 'admins', currentUser.uid));
          if (!cancelled) setIsAdmin(adminSnap.exists());
        }
        setForm({
          name: project.name || "",
          description: project.description || "",
          githubUrl: project.githubUrl
            ? project.githubUrl
            : project.owner && project.repo
              ? `https://github.com/${project.owner}/${project.repo}`
              : "",
          ecosystem: project.ecosystem || "base",
          category: project.category || "",
          contractAddress: project.contractAddress || "",
          deploymentTxHash: project.deploymentTxHash || "",
          website: project.website || "",
          twitter: project.twitter || "",
          discord: project.discord || "",
          teamMembers:
            Array.isArray(project.teamMembers) && project.teamMembers.length
              ? project.teamMembers.map((m) => (typeof m === "string" ? { address: m, share: 0 } : m))
              : [{ address: "", share: 100 }],
          tags: Array.isArray(project.tags) ? project.tags.join(", ") : project.tags || "",
          isOpenSource: project.isOpenSource === undefined ? true : Boolean(project.isOpenSource),
          lookingForFunding: Boolean(project.lookingForFunding),
          fundingAmount: project.fundingAmount || "",
          milestones:
            Array.isArray(project.milestones) && project.milestones.length ? project.milestones : [""],
          hackathons: Array.isArray(project.hackathons) ? project.hackathons : [],
          liveUrl: project.liveUrl || "",
          otherCategoryDetail: project.otherCategoryDetail || "",
          accentColor: project.accentColor || null,
          archived: Boolean(project.archived),
        });
        image.setImageUrl(project.imageUrl || "");
        if (Array.isArray(project.media)) image.setGalleryMedia(project.media);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load project");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [projectSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const canEdit = useMemo(() => {
    if (!currentUser) return false;
    if (!isEditMode) return true;
    return isAdmin || projectOwners.includes(currentUser.uid);
  }, [currentUser, isAdmin, isEditMode, projectOwners]);

  const ecosystemOptions = useMemo(
    () => getAllEcosystems().filter((e) => e.dataSource !== "special"),
    [],
  );

  const ecosystemConfig = useMemo(
    () => getEcosystemConfig(form.ecosystem),
    [form.ecosystem],
  );

  const categoryOptions = useMemo(() => {
    if (Array.isArray(ecosystemConfig?.categories) && ecosystemConfig.categories.length) {
      return ecosystemConfig.categories.map((id) => ({ id, name: id.toUpperCase() }));
    }
    return DEFAULT_CATEGORIES;
  }, [ecosystemConfig]);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const updateArrayItem = (field, index, value) =>
    setForm((prev) => ({ ...prev, [field]: prev[field].map((item, i) => (i === index ? value : item)) }));
  const addArrayItem = (field, value = "") =>
    setForm((prev) => ({ ...prev, [field]: [...prev[field], value] }));
  const removeArrayItem = (field, index) =>
    setForm((prev) => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));

  const addHackathon = () =>
    setForm((prev) => ({
      ...prev,
      hackathons: [
        ...(prev.hackathons || []),
        { ...EMPTY_HACKATHON(), repoUrl: prev.githubUrl || "", contractAddress: prev.contractAddress || "" },
      ],
    }));
  const updateHackathon = (index, field, value) =>
    setForm((prev) => ({
      ...prev,
      hackathons: prev.hackathons.map((h, i) => (i === index ? { ...h, [field]: value } : h)),
    }));
  const removeHackathon = (index) =>
    setForm((prev) => ({ ...prev, hackathons: prev.hackathons.filter((_, i) => i !== index) }));

  const validate = () => {
    const normalized = normalizeProjectInput({ ...form, imageUrl: image.imageUrl, media: image.galleryMedia });
    const projectValidation = validateProjectInput(normalized);
    if (!projectValidation.isValid) return projectValidation.errors[0];
    if (githubUsername) {
      const parsed = parseGitHubRepoUrl(form.githubUrl);
      if (parsed && parsed.owner.toLowerCase() !== githubUsername.toLowerCase()) {
        return `GitHub URL must be under your account (${githubUsername})`;
      }
    }
    return null;
  };

  const handleImproveListing = async () => {
    setImprovingListing(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "listing_improvement",
          project: normalizeProjectInput({ ...form, imageUrl: image.imageUrl, media: image.galleryMedia }),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to review listing");
      setListingSuggestions(Array.isArray(body.analysis?.suggestions) ? body.analysis.suggestions : []);
    } catch (e) {
      setError(e.message || "Failed to review listing");
    } finally {
      setImprovingListing(false);
    }
  };

  const applySuggestion = (suggestion) => {
    if (!suggestion?.field || suggestion.suggested === undefined) return;
    if (suggestion.field === "description") setField("description", String(suggestion.suggested));
    if (suggestion.field === "website" || suggestion.field === "liveUrl") setField("website", String(suggestion.suggested));
    if (suggestion.field === "twitter") setField("twitter", String(suggestion.suggested));
    setListingSuggestions((prev) => prev.filter((item) => item !== suggestion));
  };

  const handleResolveConflict = (action) => {
    if (action === "rename") {
      setExistingProjectConflict(null);
      return;
    }
    if (typeof action === "string") window.location.href = action;
  };

  const handleDelete = async () => {
    if (!isEditMode || !projectSlug) return;
    if (!window.confirm("Are you sure you want to delete this project? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/projects/${projectSlug}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete project");
      }
      window.location.href = "/profile";
    } catch (e) {
      setError(e.message || "Failed to delete project");
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!currentUser) { setError("Please sign in to save a project."); return; }
    if (!canEdit) { setError("You do not have permission to edit this project."); return; }
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    const cleaned = normalizeProjectInput({ ...form, imageUrl: image.imageUrl || null, media: image.galleryMedia });
    const projectInput = { ...cleaned };
    delete projectInput.owner;
    delete projectInput.repo;

    try {
      if (isEditMode) {
        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/projects/${projectSlug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...projectInput, imageUrl: image.imageUrl || null }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to update project");
        }
        setSuccess("Project updated");
        setTimeout(() => {
          window.location.href = `/projects/${cleaned.ecosystem}/${projectSlug}`;
        }, 600);
        return;
      }

      let bagsLaunch = null;
      if (cleaned.ecosystem === "solana" && form.launchOnBags) {
        if (!connected || activeChainFamily !== "solana") {
          throw new Error("Please connect your Solana wallet to launch a Bags token.");
        }
        try {
          const { solanaBagsService } = await import("@/services/SolanaBagsService");
          bagsLaunch = await solanaBagsService.launchBagsToken(form.bagsTokenMetadata);
        } catch (err) {
          throw new Error(`Bags token launch failed: ${err.message}`);
        }
      }

      const token = await currentUser.getIdToken();
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...projectInput,
          imageUrl: image.imageUrl || null,
          launchOnBags: form.launchOnBags,
          bagsTokenAddress: bagsLaunch?.mint || null,
          builderSnsDomain: cleaned.builderSnsDomain || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setExistingProjectConflict(body.existingProject || { name: cleaned.name });
        setError(null);
        return;
      }
      if (!res.ok) throw new Error(body.error || "Failed to submit project");
      const result = body;

      draftCtl.clearDraft();
      const createdSlug = result.projectSlug;
      setSubmittedSlug(createdSlug);
      import("@/services/TorqueService").then(({ torqueService }) => {
        torqueService.trackProjectSubmitted(form.ecosystem === "solana" && connected ? "solana-wallet" : "unknown", {
          name: cleaned.name,
          ecosystem: cleaned.ecosystem,
          category: cleaned.category,
          slug: createdSlug,
        });
      }).catch(() => {});
      setShowCelebration(true);
    } catch (e) {
      setError(e.message || "Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  if (!currentUser) {
    return (
      <Card className="p-6">
        <div className="text-gray-700 dark:text-gray-300">Please sign in to continue.</div>
      </Card>
    );
  }
  if (!canEdit) {
    return (
      <Card className="p-6">
        <div className="text-red-700 dark:text-red-300">You do not have permission to edit this project.</div>
      </Card>
    );
  }
  if (!isEditMode && !winnerLoading && !isVerified) {
    return <WinnerGate onSubmitClaim={submitClaim} loading={winnerLoading} pendingClaim={pendingClaim} error={winnerError} />;
  }

  const checklist = [
    { label: "Project name", done: Boolean(form.name?.trim()) },
    { label: "Description", done: Boolean(form.description?.trim() && form.description.trim().length >= 20) },
    { label: "GitHub repo", done: Boolean(form.githubUrl?.trim() && form.githubUrl.includes("github.com")) },
    { label: "Ecosystem", done: Boolean(form.ecosystem) },
    { label: "Category", done: Boolean(form.category) },
  ];
  const completedCount = checklist.filter((c) => c.done).length;
  const allRequired = checklist.every((c) => c.done);

  const showStep1 = isEditMode || wizardStep === 1;
  const showStep2 = isEditMode || wizardStep === 2;
  const showStep3 = isEditMode ? false : wizardStep === 3;
  const isNewProject = !isEditMode;

  return (
    <form onSubmit={handleSave}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <ProjectEditorHeader
            isEditMode={isEditMode}
            isNewProject={isNewProject}
            draftSaved={draftCtl.draftSaved}
            lastCloudSave={draftCtl.lastCloudSave}
            checklist={checklist}
            completedCount={completedCount}
            allRequired={allRequired}
            improvingListing={improvingListing}
            onImproveListing={handleImproveListing}
            saving={saving}
            error={error}
            success={success}
            listingSuggestions={listingSuggestions}
            onApplySuggestion={applySuggestion}
            duplicateWarning={github.duplicateWarning}
            existingProjectConflict={existingProjectConflict}
            onResolveConflict={handleResolveConflict}
          />

          {isNewProject && <ProjectEditorStepNav wizardStep={wizardStep} setWizardStep={setWizardStep} showContinue={wizardStep < 3} />}

          {showCelebration && submittedSlug && (
            <ProjectEditorCelebration
              slug={submittedSlug}
              ecosystem={form.ecosystem}
              name={form.name}
              currentUser={currentUser}
            />
          )}

          {showStep1 && (
            <ProjectEditorBasics
              form={form}
              setField={setField}
              ecosystemOptions={ecosystemOptions}
              categoryOptions={categoryOptions}
              ecosystemConfig={ecosystemConfig}
              imageUrl={image.imageUrl}
              setImageUrl={image.setImageUrl}
              uploadingImage={image.uploadingImage}
              imageError={image.imageError}
              onHeroUpload={image.handleHeroUpload}
              galleryMedia={image.galleryMedia}
              onGalleryUpload={image.handleGalleryUpload}
              onAddVideoUrl={image.handleAddVideoUrl}
              onRemoveMedia={image.handleRemoveMedia}
              fetchingGithub={github.fetchingGithub}
            />
          )}

          {showStep2 && (
            <ProjectEditorProof
              form={form}
              setField={setField}
              updateArrayItem={updateArrayItem}
              addArrayItem={addArrayItem}
              removeArrayItem={removeArrayItem}
              addHackathon={addHackathon}
              updateHackathon={updateHackathon}
              removeHackathon={removeHackathon}
            />
          )}

          {showStep3 && <ProjectEditorReview form={form} ecosystemConfig={ecosystemConfig} />}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!isEditMode && (
                <div className="flex sm:hidden items-center gap-1.5">
                  {checklist.map((item, i) => (
                    <div key={i} className={`w-2 h-2 rounded-full transition-colors ${item.done ? "bg-green-500" : "bg-gray-300"}`} title={item.label} />
                  ))}
                  <span className={`text-xs font-medium ml-1 ${allRequired ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}>
                    {completedCount}/{checklist.length}
                  </span>
                </div>
              )}
              {isEditMode && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setField("archived", !form.archived)}
                    className={form.archived ? "text-emerald-600 dark:text-emerald-400 border-emerald-300 hover:bg-emerald-50" : "text-amber-600 dark:text-amber-400 border-amber-300 hover:bg-amber-50"}
                    leftIcon={<ArchiveBoxArrowDownIcon className="w-4 h-4" />}
                  >
                    {form.archived ? "Unarchive" : "Archive"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleDelete} loading={deleting} className="text-red-600 dark:text-red-400 border-red-300 hover:bg-red-50">
                    Delete
                  </Button>
                </>
              )}
              {draftCtl.hasDraft && !isEditMode && (
                <button
                  type="button"
                  onClick={() => { draftCtl.clearDraft(); window.location.reload(); }}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:text-red-400 underline"
                >
                  Clear saved draft
                </button>
              )}
            </div>
            {(!isEditMode && wizardStep === 3) || isEditMode ? (
              <Button type="submit" loading={saving} disabled={!isEditMode && !allRequired}>
                {isEditMode ? "Save changes" : "Submit project"}
              </Button>
            ) : null}
          </div>
        </div>

        <ProjectPreviewPanel
          form={form}
          imageUrl={image.imageUrl}
          githubImport={github.imported}
        />
      </div>
    </form>
  );
}
