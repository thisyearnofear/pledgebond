import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Card } from '../common/Card';
import Button from '../common/Button';
import { LoadingSpinner } from '../common/LoadingStates';
import TrendingProjects from '../projects/TrendingProjects';
import {
  FunnelIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  ViewColumnsIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline';

import { ECOSYSTEM_CONFIGS as CORE_ECOSYSTEM_CONFIGS } from '@/config/ecosystems';

const ECOSYSTEM_CONFIGS = CORE_ECOSYSTEM_CONFIGS;

const VIEW_MODES = {
  unified: { name: 'Unified View', icon: Squares2X2Icon },
  separated: { name: 'Separated View', icon: ViewColumnsIcon }
};

export default function UnifiedDashboard({ projects, loading, onProjectSelect }) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState('separated');
  const [activeFilters, setActiveFilters] = useState({
    ecosystems: Object.keys(projects || {}).length ? Object.keys(projects) : ['celo', 'base'],
    search: '',
    sortBy: 'recent',
    showActive: false
  });
  const [filteredProjects, setFilteredProjects] = useState({});

  useEffect(() => {
    filterAndGroupProjects();
  }, [projects, activeFilters]);

  const filterAndGroupProjects = () => {
    if (!projects) return;

    const filtered = {};
    
    Object.entries(projects).forEach(([ecosystem, projectList]) => {
      if (!activeFilters.ecosystems.includes(ecosystem)) return;
      
      let filteredList = projectList;
      
      // Search filter
      if (activeFilters.search) {
        const searchTerm = activeFilters.search.toLowerCase();
        filteredList = filteredList.filter(project =>
          project.name?.toLowerCase().includes(searchTerm) ||
          project.description?.toLowerCase().includes(searchTerm) ||
          project.owner?.toLowerCase().includes(searchTerm)
        );
      }
      
      // Active projects filter
      if (activeFilters.showActive) {
        filteredList = filteredList.filter(project => project.stats?.isActive);
      }
      
      // Sort projects
      filteredList.sort((a, b) => {
        switch (activeFilters.sortBy) {
          case 'name':
            return (a.name || a.slug).localeCompare(b.name || b.slug);
          case 'commits':
            return (b.stats?.commits || 0) - (a.stats?.commits || 0);
          case 'health':
            return (b.stats?.healthScore || 0) - (a.stats?.healthScore || 0);
          case 'recent':
          default:
            return new Date(b.stats?.lastCommit || 0) - new Date(a.stats?.lastCommit || 0);
        }
      });
      
      filtered[ecosystem] = filteredList;
    });
    
    setFilteredProjects(filtered);
  };

  const toggleEcosystem = (ecosystem) => {
    setActiveFilters(prev => ({
      ...prev,
      ecosystems: prev.ecosystems.includes(ecosystem)
        ? prev.ecosystems.filter(e => e !== ecosystem)
        : [...prev.ecosystems, ecosystem]
    }));
  };

  const getTotalCount = () => {
    return Object.values(filteredProjects).reduce((sum, projects) => sum + projects.length, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Project Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {getTotalCount()} projects across {activeFilters.ecosystems.length} ecosystems
          </p>
        </div>
        
        {/* View Mode Toggle */}
        <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg">
          {Object.entries(VIEW_MODES).map(([mode, config]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-white text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-100'
              }`}
            >
              <config.icon className="w-4 h-4" />
              <span>{config.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search projects..."
                value={activeFilters.search}
                onChange={(e) => setActiveFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Ecosystem Filters */}
          <div className="flex items-center space-x-2">
            <FunnelIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            {Object.entries(ECOSYSTEM_CONFIGS).map(([key, config]) => (
              <button
                key={key}
                onClick={() => toggleEcosystem(key)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeFilters.ecosystems.includes(key)
                    ? `${config.bgColor} ${config.textColor} ${config.borderColor} border`
                    : 'bg-gray-100 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                <span>{config.icon}</span>
                <span>{config.name}</span>
              </button>
            ))}
          </div>

          {/* Sort & Filter Options */}
          <select
            value={activeFilters.sortBy}
            onChange={(e) => setActiveFilters(prev => ({ ...prev, sortBy: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="recent">Most Recent</option>
            <option value="name">Name A-Z</option>
            <option value="commits">Most Commits</option>
            <option value="health">Health Score</option>
          </select>

          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={activeFilters.showActive}
              onChange={(e) => setActiveFilters(prev => ({ ...prev, showActive: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <span>Active only</span>
          </label>
        </div>
      </Card>

      {/* Trending Projects (if no filters applied) */}
      {!activeFilters.search && !activeFilters.showActive && (
        <TrendingProjects 
          projects={Object.values(projects || {}).flat()} 
          viewMode={viewMode}
          limit={3}
        />
      )}

      {/* Projects Display */}
      {viewMode === 'separated' ? (
        <SeparatedView 
          projects={filteredProjects} 
          onProjectSelect={onProjectSelect}
        />
      ) : (
        <UnifiedView 
          projects={filteredProjects} 
          onProjectSelect={onProjectSelect}
        />
      )}
    </div>
  );
}

function SeparatedView({ projects, onProjectSelect }) {
  return (
    <div className="space-y-8">
      {Object.entries(projects).map(([ecosystem, projectList]) => {
        const config = ECOSYSTEM_CONFIGS[ecosystem];
        if (!projectList.length) return null;

        return (
          <div key={ecosystem}>
            {/* Ecosystem Header */}
            <div className={`${config.bgColor} ${config.borderColor} border-l-4 p-4 rounded-lg mb-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{config.icon}</span>
                  <div>
                    <h3 className={`text-lg font-semibold ${config.textColor}`}>
                      {config.name} Ecosystem
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {projectList.length} projects
                    </p>
                  </div>
                </div>
                <EcosystemStats projects={projectList} />
              </div>
            </div>

            {/* Projects Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projectList.map(project => (
                <ProjectCard
                  key={project.slug}
                  project={project}
                  ecosystem={ecosystem}
                  onClick={() => onProjectSelect(project)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UnifiedView({ projects, onProjectSelect }) {
  const allProjects = Object.entries(projects).flatMap(([ecosystem, projectList]) =>
    projectList.map(project => ({ ...project, ecosystem }))
  );

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {allProjects.map(project => (
        <ProjectCard
          key={`${project.ecosystem}-${project.slug}`}
          project={project}
          ecosystem={project.ecosystem}
          onClick={() => onProjectSelect(project)}
          showEcosystem={true}
        />
      ))}
    </div>
  );
}

function EcosystemStats({ projects }) {
  const stats = {
    total: projects.length,
    active: projects.filter(p => p.stats?.isActive).length,
    avgHealth: Math.round(
      projects.reduce((sum, p) => sum + (p.stats?.healthScore || 0), 0) / projects.length
    )
  };

  return (
    <div className="flex items-center space-x-4 text-sm">
      <div className="text-center">
        <div className="font-semibold text-gray-900 dark:text-gray-100">{stats.active}</div>
        <div className="text-gray-600 dark:text-gray-400">Active</div>
      </div>
      <div className="text-center">
        <div className="font-semibold text-gray-900 dark:text-gray-100">{stats.avgHealth}%</div>
        <div className="text-gray-600 dark:text-gray-400">Health</div>
      </div>
    </div>
  );
}

function ProjectCard({ project, ecosystem, onClick, showEcosystem = false }) {
  const config = ECOSYSTEM_CONFIGS[ecosystem];
  
  return (
    <Card 
      className="p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
            {project.name || project.slug}
          </h4>
          {showEcosystem && (
            <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
              <span>{config.icon}</span>
              <span>{config.name}</span>
            </div>
          )}
        </div>
        {project.stats?.isActive && (
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        )}
      </div>

      <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
        {project.description || `${project.owner}/${project.repo}`}
      </p>

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center space-x-3">
          <span>{project.stats?.commits || 0} commits</span>
          <span>{project.stats?.stars || 0} stars</span>
        </div>
        {project.stats?.healthScore && (
          <div className={`px-2 py-1 rounded-full ${
            project.stats.healthScore >= 80 ? 'bg-green-100 text-green-800 dark:text-green-300' :
            project.stats.healthScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {project.stats.healthScore}% health
          </div>
        )}
      </div>
    </Card>
  );
}
