/**
 * ProjectEditorHeader — top card with title, draft status, checklist, and
 * submit/improve actions, plus the inline banners (error, success,
 * listing suggestions, duplicate, conflict).
 */

import Link from "next/link";
import { ExclamationTriangleIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { Card } from "@/components/common/Card";
import Button from "@/components/common/Button";

export default function ProjectEditorHeader({
  isEditMode,
  draftSaved,
  lastCloudSave,
  checklist,
  completedCount,
  allRequired,
  improvingListing,
  onImproveListing,
  saving,
  isNewProject,
  error,
  success,
  listingSuggestions,
  onApplySuggestion,
  duplicateWarning,
  existingProjectConflict,
  onResolveConflict,
}) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {isEditMode ? "Edit project" : "Claim your win"}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Keep it crisp. Links + contract address are the minimum viable proof.
          </p>
          {!isEditMode && draftSaved && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className={`w-1.5 h-1.5 rounded-full ${draftSaved === "cloud" ? "bg-green-500" : "bg-blue-500"}`} />
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {draftSaved === "cloud"
                  ? `Draft saved${lastCloudSave ? ` at ${lastCloudSave.toLocaleTimeString()}` : ""}`
                  : "Draft saved locally"}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!isEditMode && (
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex items-center gap-1">
                {checklist.map((item, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-colors ${item.done ? "bg-green-500" : "bg-gray-300"}`}
                    title={item.label}
                  />
                ))}
              </div>
              <span className={`text-xs font-medium ${allRequired ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}>
                {completedCount}/{checklist.length}
              </span>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onImproveListing}
            loading={improvingListing}
            leftIcon={<SparklesIcon className="w-4 h-4" />}
          >
            Improve listing
          </Button>
          {isNewProject ? null : (
            <Button type="submit" loading={saving}>
              {isEditMode ? "Save" : "Submit"}
            </Button>
          )}
        </div>
      </div>

      {!isEditMode && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">What makes your project look great to backers:</p>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc pl-5">
            <li><strong>Clear description</strong> — What does it do, who is it for, what&apos;s onchain? (2-3 sentences minimum)</li>
            <li><strong>GitHub repo</strong> — Public repos with recent commits boost your health score significantly</li>
            <li><strong>Correct ecosystem</strong> — Pick the chain you&apos;re building on so backers can filter to you</li>
            <li><strong>Website or Twitter</strong> — Social links increase backer confidence by up to 10 points</li>
            <li><strong>Milestones</strong> — Concrete deliverables backers can track (&ldquo;Ship v1 by May 10&rdquo; not &ldquo;Build stuff&rdquo;)</li>
          </ul>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">{error}</div>
      )}

      {success && (
        <div className="mt-4 bg-green-50 border border-green-200 text-green-800 dark:text-green-300 p-4 rounded-lg">{success}</div>
      )}

      {listingSuggestions.length > 0 && (
        <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-sm font-semibold text-indigo-950">Suggested listing improvements</p>
          <div className="mt-3 space-y-3">
            {listingSuggestions.map((suggestion, index) => (
              <div key={`${suggestion.field}-${index}`} className="rounded-md bg-white p-3 border border-indigo-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{suggestion.field}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{suggestion.suggested}</p>
                    {suggestion.reason && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{suggestion.reason}</p>
                    )}
                  </div>
                  {suggestion.canApplyAutomatically && (
                    <Button type="button" size="sm" variant="outline" onClick={() => onApplySuggestion(suggestion)}>
                      Apply
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {duplicateWarning && !existingProjectConflict && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Possible duplicate detected</p>
              <p className="text-sm text-amber-700 mt-1">
                A project with this GitHub URL already exists:{" "}
                <Link href={`/projects/${duplicateWarning.ecosystem || "base"}/${duplicateWarning.slug}`} className="underline font-medium">
                  {duplicateWarning.name}
                </Link>
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                If this is yours, you can edit the existing project instead of creating a duplicate.
              </p>
            </div>
          </div>
        </div>
      )}

      {existingProjectConflict && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Project name already exists</h3>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                A project named <strong>{existingProjectConflict.name}</strong> already exists.
              </p>
              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() =>
                    onResolveConflict?.(`/projects/${existingProjectConflict.ecosystem || "base"}/${existingProjectConflict.slug}`)
                  }
                  variant={existingProjectConflict.isOwner ? undefined : "secondary"}
                >
                  {existingProjectConflict.isOwner ? "Go to my project" : "View existing project"}
                </Button>
                <Button variant="secondary" onClick={() => onResolveConflict?.("rename")}>
                  Rename my project
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
