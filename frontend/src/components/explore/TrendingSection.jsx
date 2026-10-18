/**
 * TrendingSection — Top-of-page hero card showing the top 3 trending
 * projects. Dismissable; uses a gradient orange-amber backdrop with
 * decorative blurred circles.
 */

import { ArrowTrendingUpIcon, SparklesIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolid } from "@heroicons/react/24/solid";
import { BookmarkIcon as BookmarkOutline } from "@heroicons/react/24/outline";

function scoreDotColor(score) {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  return "bg-orange-500";
}

export default function TrendingSection({ projects, onDismiss, onProjectClick, isBookmarked, onToggleBookmark }) {
  return (
    <div className="mb-6">
      <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-900/20 dark:via-amber-900/20 dark:to-yellow-900/20 rounded-2xl border-2 border-orange-200 dark:border-orange-800 p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-200/20 dark:bg-orange-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-200/20 dark:bg-amber-500/10 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-600 text-white shadow-lg shadow-orange-200">
                <ArrowTrendingUpIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-primary dark:text-white flex items-center gap-2">
                  Trending Now <SparklesIcon className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                </h2>
                <p className="text-xs text-secondary">Most active and highest quality projects right now</p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
              title="Dismiss"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {projects.map((project, index) => (
              <div
                key={project.slug}
                onClick={() => onProjectClick(project)}
                className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-4 cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 border border-orange-100 dark:border-orange-800/50 group relative"
              >
                <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center shadow-lg z-10">
                  {index + 1}
                </div>

                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-primary dark:text-white text-sm truncate pr-2">{project.name}</h3>
                    <p className="text-xs text-secondary">{project.ecosystem?.toUpperCase()}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-full">
                      {project.trendingScore}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleBookmark(project.slug); }}
                      className={`p-1 rounded-md transition-colors ${
                        isBookmarked(project.slug)
                          ? "text-amber-500 hover:text-amber-600 dark:text-amber-400"
                          : "text-muted hover:text-amber-400 opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {isBookmarked(project.slug) ? <BookmarkSolid className="w-4 h-4" /> : <BookmarkOutline className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-3 min-h-[2rem]">
                  {project.description || "Active project"}
                </p>

                <div className="flex items-center gap-3 text-xs text-secondary pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${scoreDotColor(project.trendingScore)}`} />
                    Score {project.trendingScore}
                  </span>
                  {project.stats?.commits > 0 && <span>{project.stats.commits} commits</span>}
                  {project.stats?.healthScore && <span>{project.stats.healthScore}% health</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
