import React from "react";
import {
  TrophyIcon,
  CheckBadgeIcon,
  ShieldCheckIcon,
  FireIcon,
  SparklesIcon,
  RocketLaunchIcon,
  GlobeAltIcon,
  UserGroupIcon,
  StarIcon,
  ScaleIcon,
} from "@heroicons/react/24/outline";
import { getTierStyles } from "@/lib/badges/computeBadges";

/**
 * Map badge category/type to an icon component.
 */
const BADGE_ICONS = {
  "verified-winner": TrophyIcon,
  "verified-win": CheckBadgeIcon,
  "proof-complete": ShieldCheckIcon,
  "partial-proof": ShieldCheckIcon,
  "proof-builder": CheckBadgeIcon,
  "multi-ecosystem": GlobeAltIcon,
  prolific: StarIcon,
  "community-trusted": UserGroupIcon,
  "high-velocity": FireIcon,
  "high-health": FireIcon,
  "early-builder": SparklesIcon,
  "verified-payouts": RocketLaunchIcon,
  "community-tested": UserGroupIcon,
  "jury-verified": ScaleIcon,
};

/**
 * ProofBadge — a reusable badge icon with styled tooltip popup,
 * configurable tier styling, and micro-animations.
 *
 * @param {object} props
 * @param {string} props.id        — Badge type identifier (e.g., "verified-winner")
 * @param {string} props.label     — Short display text (e.g., "Verified Winner")
 * @param {string} [props.tier]    — "gold" | "silver" | "bronze" | "default"
 * @param {string} [props.description] — Tooltip text explaining the badge
 * @param {string} [props.size]    — "sm" | "md" | "lg"
 * @param {boolean} [props.showLabel] — Whether to show the label alongside the icon
 * @param {number} [props.animationIndex] — Staggered index for entrance animation
 * @param {boolean} [props.noAnimation] — Disable entrance animation
 * @param {string} [props.className] — Additional CSS classes
 */
export default function ProofBadge({
  id,
  label,
  tier = "default",
  description,
  size = "sm",
  showLabel = true,
  animationIndex = 0,
  noAnimation = false,
  className = "",
}) {
  const styles = getTierStyles(tier);
  const IconComponent = BADGE_ICONS[id] || TrophyIcon;
  const isGold = tier === "gold";

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2",
  };
  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  return (
    <span
      className={`group relative inline-flex ${className} ${!noAnimation ? 'animate-badge-pop' : ''}`}
      style={{ animationDelay: noAnimation ? undefined : `${animationIndex * 80}ms` }}
    >
      {/* Badge pill */}
      <span
        className={`relative inline-flex items-center rounded-full border font-semibold cursor-default transition-all duration-200 group-hover:scale-105 group-hover:shadow-md ${styles.bg} ${styles.text} ${styles.border} ${sizeClasses[size]} ${isGold ? 'gold-badge-glow' : ''}`}
        title={description || label}
      >
        {/* Gold shimmer overlay */}
        {isGold && <span className="gold-badge-shimmer absolute inset-0 rounded-full pointer-events-none" />}

        <IconComponent className={`${iconSizes[size]} ${styles.icon} relative z-10`} />
        {showLabel && <span className="relative z-10">{label}</span>}
      </span>

      {/* Sparkle decoration for gold badges */}
      {isGold && (
        <svg
          className="gold-sparkle"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 0l1.5 5.5L15 7.5l-5.5 2L8 15l-1.5-5.5L1 7.5l5.5-2z" />
        </svg>
      )}

      {/* Styled tooltip popup — appears on hover */}
      {description && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg shadow-lg text-xs leading-relaxed whitespace-nowrap max-w-[220px] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
          role="tooltip"
        >
          {description}
          {/* Arrow */}
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-100"
          />
        </span>
      )}
    </span>
  );
}

/**
 * ProofBadgeGroup — renders a horizontal cluster of ProofBadge components.
 * Handles the "more badges" overflow and responsive wrapping.
 * Each badge gets a staggered entrance animation based on its index.
 *
 * @param {object} props
 * @param {object[]} props.badges  — Array of badge objects from computeBadges
 * @param {string} [props.size]    — "sm" | "md" | "lg"
 * @param {number} [props.max]     — Max badges to show before collapsing
 * @param {boolean} [props.noAnimation] — Disable entrance animations
 * @param {string} [props.className] — Additional CSS classes
 */
export function ProofBadgeGroup({
  badges = [],
  size = "sm",
  max = 4,
  noAnimation = false,
  className = "",
}) {
  if (!badges || badges.length === 0) return null;

  const visible = badges.slice(0, max);
  const overflow = badges.length - max;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {visible.map((badge, idx) => (
        <ProofBadge
          key={badge.id}
          id={badge.id}
          label={badge.label}
          tier={badge.tier}
          description={badge.description}
          size={size}
          animationIndex={idx}
          noAnimation={noAnimation}
        />
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60"
          title={badges.slice(max).map((b) => `${b.label}: ${b.description}`).join("\n")}
        >
          +{overflow} more
        </span>
      )}
    </div>
  );
}


