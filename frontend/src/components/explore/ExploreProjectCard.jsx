/**
 * ExploreProjectCard — Grid card for a single project in the Projects tab.
 * Shows: image, name, ecosystem, category, description, tags (top 3),
 * stats (commits/stars/funding), and a quality score bar.
 */

import { BookmarkIcon as BookmarkSolid } from "@heroicons/react/24/solid";
import { BookmarkIcon as BookmarkOutline } from "@heroicons/react/24/outline";
import { ECOSYSTEM_CONFIGS } from "@/config/ecosystems";
import { getProjectQuality } from "@/lib/projects/projectQuality";

function qualityColor(score) {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-400";
  return "bg-gray-300";
}

function qualityTextColor(score) {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
  return "text-gray-400 dark:text-gray-500";
}

/**
 * Quality badge — shows a progress bar with score, or "New" when the project
 * has no GitHub stats loaded (quality < 25 with no commits/stars), avoiding
 * a misleadingly low percentage that looks like a data bug.
 */
function QualityBadge({ project, quality }) {
  const hasGithubStats = (project.stats?.commits || 0) > 0 || (project.stats?.stars || 0) > 0 || project.stats?.healthScore;
  if (quality.score < 25 && !hasGithubStats) {
    return <span className="text-xs font-medium text-blue-500 dark:text-blue-400">New</span>;
  }
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${qualityColor(quality.score)}`} style={{ width: `${quality.score}%` }} />
      </div>
      <span className={`text-xs font-medium ${qualityTextColor(quality.score)}`}>{quality.score}%</span>
    </div>
  );
}

export default function ExploreProjectCard({ project, isBookmarked, onToggleBookmark, onClick }) {
  const ecosystemConfig = ECOSYSTEM_CONFIGS[project.ecosystem];
  const quality = getProjectQuality(project);

  return (
    <div
      onClick={onClick}
      className="bg-surface rounded-xl border border-default overflow-hidden cursor-pointer hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-700 transition-all duration-200 group"
    >
      {project.imageUrl ? (
        <div className="h-32 overflow-hidden">
          <img
            src={project.imageUrl}
            alt={project.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="h-16 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600" />
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-primary dark:text-white text-sm truncate">{project.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {ecosystemConfig && (
                <span className="text-xs text-secondary flex items-center gap-1">
                  {ecosystemConfig.icon} {ecosystemConfig.shortName}
                </span>
              )}
              {project.category && <span className="text-xs text-tertiary">· {project.category}</span>}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleBookmark(); }}
            className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${
              isBookmarked
                ? "text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20"
                : "text-muted opacity-0 group-hover:opacity-100 hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
            }`}
            title={isBookmarked ? "Remove bookmark" : "Bookmark project"}
          >
            {isBookmarked ? <BookmarkSolid className="w-4 h-4" /> : <BookmarkOutline className="w-4 h-4" />}
          </button>
        </div>

        {project.description && (
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-3 min-h-[2rem]">
            {project.description}
          </p>
        )}

        {Array.isArray(project.tags) && project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {project.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-[10px] font-medium">
                {tag}
              </span>
            ))}
            {project.tags.length > 3 && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">+{project.tags.length - 3}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 text-xs text-secondary">
            {project.stats?.commits > 0 && <span>{project.stats.commits} commits</span>}
            {project.stats?.stars > 0 && <span>{project.stats.stars} ★</span>}
            {project.lookingForFunding && <span className="text-blue-600 dark:text-blue-400 font-medium">Funding</span>}
          </div>
          <QualityBadge project={project} quality={quality} />
        </div>
      </div>
    </div>
  );
}
