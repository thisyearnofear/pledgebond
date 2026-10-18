import { getProjectQuality } from '@/lib/projects/projectQuality';
import { generateProjectSlug, normalizeProjectInput } from '@/lib/projects/projectNormalize';
import { ProjectGridCard } from './ProjectCard';

export default function ProjectPreviewPanel({ form, imageUrl, githubImport }) {
  const project = normalizeProjectInput({ ...form, imageUrl });
  const quality = getProjectQuality(project);
  const stats = githubImport
    ? {
        commits: 0,
        stars: githubImport.stars || 0,
        forks: githubImport.forks || 0,
        issues: githubImport.openIssues || 0,
        healthScore: quality.score,
        isActive: Boolean(githubImport.pushedAt),
        lastCommit: githubImport.pushedAt || null
      }
    : {
        commits: 0,
        stars: 0,
        forks: 0,
        issues: 0,
        healthScore: quality.score,
        isActive: false
      };

  const previewProject = {
    ...project,
    slug: project.name ? generateProjectSlug(project.name) : 'your-project',
    stats
  };

  return (
    <aside className="space-y-4 lg:sticky lg:top-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Live preview</h3>
          <span className="text-xs font-medium text-gray-500">{quality.tier}</span>
        </div>
        <ProjectGridCard project={previewProject} />
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Listing quality</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Signals backers can quickly trust.</p>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{quality.score}</div>
        </div>

        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden mb-4">
          <div
            className={`h-full ${quality.score >= 80 ? 'bg-green-500' : quality.score >= 55 ? 'bg-blue-500' : 'bg-amber-500'}`}
            style={{ width: `${quality.score}%` }}
          />
        </div>

        <div className="space-y-2">
          {quality.items.map((item) => (
            <div key={item.id} className="flex items-start gap-2 text-xs">
              <span className={`mt-0.5 h-2 w-2 rounded-full ${item.done ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
              <span className={item.done ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500'}>
                {item.done ? item.label : item.action}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
