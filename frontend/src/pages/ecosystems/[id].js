import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useEnhancedGithub } from '@/providers/Github/EnhancedGithubProvider';
import { useUser } from '@/stores/authStore';
import { Card } from '@/components/common/Card';
import Button from '@/components/common/Button';
import { LoadingSpinner } from '@/components/common/LoadingStates';
import { ProjectDetailCard, ProjectGridCard, ProjectListItem } from '@/components/projects/ProjectCard';
import TrendingProjects from '@/components/projects/TrendingProjects';
import PortLeaderboard from '@/components/ecosystems/PortLeaderboard';
import { getEcosystemConfig } from '@/config/ecosystems';
import { filterProjects, sortProjects, calculateProjectStats } from '@/utils/projectUtils';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ViewColumnsIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

const VIEW_MODES = {
  grid: { name: 'Grid', icon: Squares2X2Icon, component: ProjectGridCard, cols: 'md:grid-cols-2 lg:grid-cols-3' },
  detail: { name: 'Detail', icon: ViewColumnsIcon, component: ProjectDetailCard, cols: 'md:grid-cols-2' },
  list: { name: 'List', icon: ListBulletIcon, component: ProjectListItem, cols: 'grid-cols-1' }
};

export default function EcosystemPage() {
  const router = useRouter();
  const { id } = router.query;
  const { projectData, loading } = useEnhancedGithub();
  const { userProfile } = useUser();

  const [viewMode, setViewMode] = useState('grid');
  const [filters, setFilters] = useState({
    search: '', season: 'all', activeOnly: false, minHealthScore: 0, sortBy: 'name', sortOrder: 'asc'
  });

  const ecosystemConfig = id ? getEcosystemConfig(id) : null;
  const projects = (id && projectData?.[id]) || [];

  const processedProjects = useMemo(() => {
    let filtered = projects;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(s) || p.slug?.toLowerCase().includes(s) ||
        p.description?.toLowerCase().includes(s) || p.owner?.toLowerCase().includes(s)
      );
    }
    if (filters.season !== 'all') {
      filtered = filtered.filter(p => p.season === parseInt(filters.season));
    }
    filtered = filterProjects(filtered, { activeOnly: filters.activeOnly, minHealthScore: filters.minHealthScore });
    return sortProjects(filtered, filters.sortBy, filters.sortOrder);
  }, [projects, filters]);

  const stats = useMemo(() => calculateProjectStats(processedProjects), [processedProjects]);

  const handleFilterChange = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));
  const handleProjectClick = (project) => router.push(`/projects/${id}/${project.slug}`);

  if (!id || loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-lg text-gray-600 dark:text-gray-400">Loading {id || ''} projects...</span>
      </div>
    );
  }

  if (!ecosystemConfig) {
    return <div className="py-16 text-center text-gray-600 dark:text-gray-400">Ecosystem not found.</div>;
  }

  const ViewComponent = VIEW_MODES[viewMode].component;
  const gridCols = VIEW_MODES[viewMode].cols;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <Button onClick={() => router.back()} variant="outline" className="flex items-center space-x-2">
            <ArrowLeftIcon className="w-4 h-4" /><span>Back</span>
          </Button>
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold"
              style={{ backgroundColor: ecosystemConfig.color }}>
              {ecosystemConfig.icon}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-primary">{ecosystemConfig.name}</h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">{ecosystemConfig.longDescription}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-6">
          {ecosystemConfig.features?.map((feature, i) => (
            <span key={i} className={`px-3 py-1 rounded-full text-sm font-medium ${ecosystemConfig.bgColor} ${ecosystemConfig.textColor}`}>
              {feature}
            </span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card className="p-4 text-center"><div className="text-2xl font-bold text-primary">{stats.total}</div><div className="text-sm text-gray-600 dark:text-gray-400">Total</div></Card>
        <Card className="p-4 text-center"><div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.active}</div><div className="text-sm text-gray-600 dark:text-gray-400">Active</div></Card>
        <Card className="p-4 text-center"><div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalCommits}</div><div className="text-sm text-gray-600 dark:text-gray-400">Commits</div></Card>
        <Card className="p-4 text-center"><div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.averageHealth}%</div><div className="text-sm text-gray-600 dark:text-gray-400">Avg Health</div></Card>
        <Card className="p-4 text-center"><div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.totalStars}</div><div className="text-sm text-gray-600 dark:text-gray-400">Stars</div></Card>
      </div>

      {/* Port Details & Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Port Identity & Rules */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-primary mb-4 flex items-center">
              <span className="mr-2">📜</span> Port Rules & Requirements
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ul className="space-y-3">
                {ecosystemConfig.submissionRequirements?.map((req, i) => (
                  <li key={i} className="flex items-start text-sm text-gray-600 dark:text-gray-400">
                    <span className="text-blue-500 dark:text-blue-400 mr-2 mt-0.5">•</span>
                    {req}
                  </li>
                ))}
              </ul>
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-2">Ecosystem Benefits</h4>
                <ul className="space-y-2">
                  {ecosystemConfig.features?.map((f, i) => (
                    <li key={i} className="text-xs text-blue-600 dark:text-blue-400 flex items-center">
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <PortLeaderboard projects={projects} ecosystem={id} />
        </div>
      </div>

      {/* Controls */}
      <Card className="p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input type="text" placeholder={`Search ${ecosystemConfig.name} projects...`}
                value={filters.search} onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            {id === 'celo' && (
              <select value={filters.season} onChange={(e) => handleFilterChange('season', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg">
                <option value="all">All Seasons</option>
                <option value="1">Season 1</option><option value="2">Season 2</option><option value="3">Season 3</option>
              </select>
            )}
            <select value={filters.sortBy} onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg">
              <option value="name">Name</option><option value="commits">Commits</option>
              <option value="stars">Stars</option><option value="health">Health</option><option value="recent">Recent</option>
            </select>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
              {Object.entries(VIEW_MODES).map(([mode, config]) => (
                <button key={mode} onClick={() => setViewMode(mode)} title={config.name}
                  className={`p-2 rounded-md transition-colors ${viewMode === mode ? 'bg-white text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-primary'}`}>
                  <config.icon className="w-4 h-4" />
                </button>
              ))}
            </div>
            <Button variant="outline" className="flex items-center space-x-2">
              <FunnelIcon className="w-4 h-4" /><span>Filters</span>
            </Button>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center space-x-2">
              <input type="checkbox" checked={filters.activeOnly} onChange={(e) => handleFilterChange('activeOnly', e.target.checked)} className="rounded border-gray-300" />
              <span className="text-sm">Active only</span>
            </label>
            <div className="flex items-center space-x-2">
              <span className="text-sm">Min Health:</span>
              <input type="range" min="0" max="100" step="10" value={filters.minHealthScore}
                onChange={(e) => handleFilterChange('minHealthScore', parseInt(e.target.value))} className="w-24" />
              <span className="text-sm font-medium">{filters.minHealthScore}%</span>
            </div>
            <select value={filters.sortOrder} onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-sm">
              <option value="asc">Ascending</option><option value="desc">Descending</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Trending */}
      {!filters.search && filters.season === 'all' && !filters.activeOnly && filters.minHealthScore === 0 && (
        <TrendingProjects projects={projects} ecosystem={id} viewMode={viewMode} limit={3} />
      )}

      {/* Projects */}
      {processedProjects.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-6xl mb-4">{ecosystemConfig.icon}</div>
          <h3 className="text-lg font-medium text-primary mb-2">No projects found</h3>
          <p className="text-gray-600 dark:text-gray-400">Try adjusting your filters to see more projects.</p>
        </Card>
      ) : (
        <div className={`grid gap-6 ${gridCols}`}>
          {processedProjects.map(project => (
            <ViewComponent key={project.slug} project={project} onClick={() => handleProjectClick(project)} showEcosystem={false} />
          ))}
        </div>
      )}

      {/* CTA */}
      {userProfile && !userProfile.onboardingComplete && (
        <Card className="p-6 mt-8 bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-primary mb-2">Won a hackathon like these?</h3>
              <p className="text-gray-600 dark:text-gray-400">Claim your win and bridge the unpaid prize with a USDC loan — paid in hours, not 90 days.</p>
            </div>
            <Button onClick={() => router.push('/build')} className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white whitespace-nowrap">
              Claim Your Win
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
