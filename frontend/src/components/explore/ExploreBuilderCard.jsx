/**
 * ExploreBuilderCard — Card for a single builder in the Builders tab.
 * Includes the follow button inline (uses useFollow + ConfirmModal) since
 * it's only ever rendered here.
 */

import { useState } from "react";
import useFollow from "@/hooks/useFollow.js";
import { useToastActions } from "@/components/common/Toast";
import { ConfirmModal } from "@/components/common/Modal";
import { CodeBracketIcon, StarIcon } from "@heroicons/react/24/outline";
import { ECOSYSTEM_CONFIGS } from "@/config/ecosystems";

function ExploreBuilderFollowButton({ builder, currentUserId }) {
  const isSelf = currentUserId && builder.uid === currentUserId;
  const toast = useToastActions();
  const [showUnfollowModal, setShowUnfollowModal] = useState(false);
  const { following, loading, toggleFollow } = useFollow(
    isSelf ? null : builder.uid,
    false,
    builder.followerCount || 0,
    (error, newFollowing) => {
      const name = builder.displayName || builder.githubUsername;
      if (error) {
        toast.error(`Failed to update follow status for ${name}: ${error.message || error}`);
      } else if (newFollowing) {
        toast.success(`Started following ${name}`);
      } else {
        toast.success(`Unfollowed ${name}`);
      }
    },
  );

  if (!currentUserId || isSelf) return null;
  const name = builder.displayName || builder.githubUsername || "this builder";

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); if (following) setShowUnfollowModal(true); else toggleFollow(); }}
        disabled={loading}
        className={`ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${
          following
            ? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-red-50 hover:text-red-600 dark:text-red-400 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow"
        }`}
      >
        {following ? "Following" : "Follow"}
      </button>
      <ConfirmModal
        isOpen={showUnfollowModal}
        onClose={() => setShowUnfollowModal(false)}
        onConfirm={async () => { setShowUnfollowModal(false); toggleFollow(); }}
        title={`Unfollow @${name}?`}
        message={`You will no longer see ${name}'s activity in your feed.`}
        confirmText="Unfollow"
        cancelText="Cancel"
        variant="danger"
      />
    </>
  );
}

function healthTier(score) {
  if (score >= 80) return "top";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  return "low";
}

const TIER_COLORS = {
  top: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  good: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
  fair: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  low: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
};

export default function ExploreBuilderCard({ builder, onClick, currentUserId }) {
  const [imgError, setImgError] = useState(false);
  const primaryEco = builder.ecosystems?.[0];
  const extraEcosystems = builder.ecosystems?.length > 1 ? builder.ecosystems.length - 1 : 0;
  const tier = healthTier(builder.averageHealth || 0);

  return (
    <div
      onClick={onClick}
      className="bg-surface rounded-xl border border-default overflow-hidden cursor-pointer hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-700 transition-all duration-200 group"
    >
      <div className={`h-2 ${
        tier === "top" ? "bg-gradient-to-r from-green-400 to-emerald-500" :
        tier === "good" ? "bg-gradient-to-r from-yellow-400 to-amber-500" :
        tier === "fair" ? "bg-gradient-to-r from-orange-300 to-orange-400" :
        "bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-500"
      }`} />

      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          {builder.photoURL && !imgError ? (
            <img
              src={builder.photoURL}
              alt={builder.displayName}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100 dark:ring-gray-700 flex-shrink-0"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {builder.displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-primary dark:text-white text-sm truncate">{builder.displayName}</h3>
            <p className="text-xs text-secondary truncate">@{builder.githubUsername}</p>
          </div>
        </div>

        {builder.bio && (
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-3 min-h-[2rem]">{builder.bio}</p>
        )}

        <div className="flex items-center gap-3 text-xs text-secondary mb-3">
          <span className="flex items-center gap-1">
            <CodeBracketIcon className="w-3.5 h-3.5" />
            {builder.projectCount} {builder.projectCount === 1 ? "project" : "projects"}
          </span>
          {builder.totalStars > 0 && (
            <span className="flex items-center gap-1">
              <StarIcon className="w-3.5 h-3.5" /> {builder.totalStars}
            </span>
          )}
          {builder.followerCount > 0 && <span>{builder.followerCount} followers</span>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {primaryEco && ECOSYSTEM_CONFIGS[primaryEco] && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-[10px] font-medium">
              {ECOSYSTEM_CONFIGS[primaryEco].icon} {ECOSYSTEM_CONFIGS[primaryEco].shortName}
            </span>
          )}
          {extraEcosystems > 0 && <span className="text-[10px] text-tertiary">+{extraEcosystems} more</span>}
          {builder.averageHealth > 0 && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${TIER_COLORS[tier]}`}>
              {builder.averageHealth}%
            </span>
          )}
          <ExploreBuilderFollowButton builder={builder} currentUserId={currentUserId} />
        </div>
      </div>
    </div>
  );
}
