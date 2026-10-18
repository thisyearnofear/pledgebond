/**
 * Ecosystem Section Component
 * Reusable section for displaying ecosystem projects with consistent styling
 */

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Card } from '../common/Card';
import Button from '../common/Button';
import { getEcosystemConfig } from '../../config/ecosystems';
import { ProjectPreviewCard, ProjectDetailCard, ProjectGridCard } from '../projects/ProjectCard';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowTopRightOnSquareIcon,
  FunnelIcon,
  ViewColumnsIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline';

const VIEW_MODES = {
  preview: { component: ProjectPreviewCard, cols: 'md:grid-cols-2 lg:grid-cols-4' },
  detail: { component: ProjectDetailCard, cols: 'md:grid-cols-2 lg:grid-cols-3' },
  grid: { component: ProjectGridCard, cols: 'md:grid-cols-2 lg:grid-cols-3' }
};

export default function EcosystemSection({
  ecosystem,
  projects = [],
  totalProjects = 0,
  isExpanded = true,
  onToggle,
  viewMode = 'preview',
  showControls = false,
  onProjectClick,
  className = ''
}) {
  const router = useRouter();
  const [localViewMode, setLocalViewMode] = useState(viewMode);
  const [showFilters, setShowFilters] = useState(false);
  
  const ecosystemConfig = getEcosystemConfig(ecosystem);
  
  if (!ecosystemConfig) {
    return null;
  }

  const ProjectComponent = VIEW_MODES[localViewMode]?.component || ProjectPreviewCard;
  const gridCols = VIEW_MODES[localViewMode]?.cols || 'md:grid-cols-2 lg:grid-cols-4';

  const handleExploreClick = (e) => {
    e.stopPropagation();
    router.push(ecosystemConfig.route);
  };

  const handleProjectClick = (project) => {
    if (onProjectClick) {
      onProjectClick(project);
    } else {
      // Default behavior - navigate to project detail
      router.push(`/projects/${ecosystem}/${project.slug}`);
    }
  };

  return (
    <Card className={`overflow-hidden ${className}`}>
      {/* Section Header */}
      <div 
        className={`p-6 bg-gradient-to-r ${ecosystemConfig.bgGradient} ${ecosystemConfig.borderColor} border-l-4 ${onToggle ? 'cursor-pointer' : ''}`}
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Ecosystem Icon & Info */}
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold"
              style={{ backgroundColor: ecosystemConfig.color }}
            >
              {ecosystemConfig.icon}
            </div>
            
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{ecosystemConfig.name}</h3>
              <p className="text-gray-600 dark:text-gray-400">{ecosystemConfig.description}</p>
              
              {/* Features */}
              <div className="flex items-center space-x-2 mt-2">
                {ecosystemConfig.features.slice(0, 3).map((feature, index) => (
                  <span 
                    key={index}
                    className="px-2 py-1 bg-white bg-opacity-70 text-xs text-gray-700 dark:text-gray-300 rounded-full"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-4">
            {/* Stats */}
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {isExpanded ? projects.length : totalProjects}
                {!isExpanded && totalProjects > projects.length && (
                  <span className="text-lg text-gray-600 dark:text-gray-400">/{totalProjects}</span>
                )}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">projects</div>
            </div>
            
            {/* Explore Button */}
            <Button
              onClick={handleExploreClick}
              variant="outline"
              className="flex items-center space-x-2 bg-white bg-opacity-80 hover:bg-opacity-100"
            >
              <span>Explore</span>
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </Button>

            {/* Expand/Collapse */}
            {onToggle && (
              <div className="p-2">
                {isExpanded ? (
                  <ChevronDownIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                ) : (
                  <ChevronRightIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section Controls */}
      {isExpanded && showControls && (
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* View Mode Toggle */}
              <div className="flex items-center space-x-1 bg-white rounded-lg p-1">
                {Object.entries(VIEW_MODES).map(([mode, config]) => (
                  <button
                    key={mode}
                    onClick={() => setLocalViewMode(mode)}
                    className={`p-2 rounded-md transition-colors ${
                      localViewMode === mode
                        ? 'bg-blue-100 text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-100'
                    }`}
                    title={`${mode} view`}
                  >
                    {mode === 'preview' && <Squares2X2Icon className="w-4 h-4" />}
                    {mode === 'detail' && <ViewColumnsIcon className="w-4 h-4" />}
                    {mode === 'grid' && <ViewColumnsIcon className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Additional Controls */}
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2"
              >
                <FunnelIcon className="w-4 h-4" />
                <span>Filters</span>
              </Button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Filters for {ecosystemConfig.name} projects would go here
              </div>
            </div>
          )}
        </div>
      )}

      {/* Projects Content */}
      {isExpanded && (
        <div className="p-6">
          {projects.length === 0 ? (
            <EmptyState ecosystem={ecosystemConfig} />
          ) : (
            <>
              {/* Projects Grid */}
              <div className={`grid gap-4 ${gridCols} mb-6`}>
                {projects.map(project => (
                  <ProjectComponent
                    key={project.slug}
                    project={project}
                    onClick={() => handleProjectClick(project)}
                    showEcosystem={false}
                  />
                ))}
              </div>
              
              {/* Show More Button */}
              {totalProjects > projects.length && (
                <div className="text-center">
                  <Button
                    onClick={handleExploreClick}
                    variant="outline"
                    className="flex items-center space-x-2"
                  >
                    <span>
                      View all {totalProjects} {ecosystemConfig.shortName} projects
                    </span>
                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * Empty State Component
 */
function EmptyState({ ecosystem }) {
  return (
    <div className="text-center py-10">
      <div className="text-5xl mb-3">{ecosystem.icon}</div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
        No {ecosystem.shortName} projects yet
      </h3>
      <p className="text-gray-500 dark:text-gray-400 mb-5 text-sm max-w-md mx-auto">
        {ecosystem.dataSource === 'dynamic' 
          ? `Submit a project to the ${ecosystem.shortName} ecosystem, or try our AI agents to analyze any GitHub repo.`
          : `Projects will appear here once they're added. In the meantime, try our AI agents!`
        }
      </p>
      
      <div className="flex flex-wrap items-center justify-center gap-3">
        {ecosystem.dataSource === 'dynamic' && (
          <Button
            onClick={() => window.location.href = '/projects/new'}
            variant="outline"
            className="text-sm"
          >
            Submit Project
          </Button>
        )}
        <Button
          onClick={() => window.location.href = '/back'}
          className="bg-teal-600 hover:bg-teal-700 text-white text-sm"
        >
          ⚡ Try AI Agents
        </Button>
      </div>
    </div>
  );
}

/**
 * Ecosystem Stats Component
 */
export function EcosystemStats({ projects = [], className = '' }) {
  const stats = {
    total: projects.length,
    active: projects.filter(p => p.stats?.isActive).length,
    avgHealth: projects.length > 0 
      ? Math.round(projects.reduce((sum, p) => sum + (p.stats?.healthScore || 0), 0) / projects.length)
      : 0,
    totalCommits: projects.reduce((sum, p) => sum + (p.stats?.commits || 0), 0)
  };

  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      <div className="text-center">
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.active}</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">Active</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.avgHealth}%</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">Avg Health</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.totalCommits}</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">Commits</div>
      </div>
    </div>
  );
}
