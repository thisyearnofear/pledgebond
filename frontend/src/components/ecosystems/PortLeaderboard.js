import React from 'react';
import Link from 'next/link';

/**
 * PortLeaderboard Component
 * Displays ranked projects based on Shipping Velocity
 * Shipping Velocity = (commits_last_30_days * 1) + (milestones_completed * 10)
 */
const PortLeaderboard = ({ projects, ecosystem }) => {
  if (!projects || projects.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">No projects found in this port yet.</p>
      </div>
    );
  }

  // Calculate velocity and sort
  const rankedProjects = projects
    .map(project => {
      // In a real app, we'd use commits from last 30 days. 
      // For now, we use total commits as a proxy if last 30 days is not available.
      const commits = project.stats?.commits || project.commits || 0;
      const milestones = project.milestonesCompleted || (project.milestones?.filter(m => m.completed).length) || 0;
      const velocity = (commits * 1) + (milestones * 10);
      return { ...project, velocity };
    })
    .sort((a, b) => b.velocity - a.velocity)
    .slice(0, 10);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Port Leaderboard</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Top ships by shipping velocity</p>
      </div>
      
      <div className="divide-y divide-gray-100">
        {rankedProjects.map((project, index) => (
          <div key={project.id || project.slug} className="px-6 py-4 flex items-center hover:bg-gray-50 transition-colors">
            <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full font-bold text-xs ${
              index === 0 ? 'bg-yellow-100 text-yellow-700' : 
              index === 1 ? 'bg-gray-100 text-gray-700 dark:text-gray-300' : 
              index === 2 ? 'bg-orange-100 text-orange-700 dark:text-orange-300' : 
              'text-gray-400 dark:text-gray-500'
            }`}>
              {index + 1}
            </div>
            
            <div className="ml-4 flex-grow">
              <Link 
                href={`/projects/${ecosystem}/${project.slug || project.id}`}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-300 line-clamp-1"
              >
                {project.name}
              </Link>
              <div className="flex items-center mt-1">
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {project.stats?.commits || project.commits || 0} commits
                </span>
                <span className="mx-1 text-gray-300 dark:text-gray-500">•</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {project.milestonesCompleted || (project.milestones?.filter(m => m.completed).length) || 0} milestones
                </span>
              </div>
            </div>
            
            <div className="flex-shrink-0 text-right">
              <div className="text-sm font-bold text-gray-900 dark:text-gray-100">{project.velocity}</div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">Velocity</div>
            </div>
          </div>
        ))}
      </div>
      
      {projects.length > 10 && (
        <div className="px-6 py-3 bg-gray-50 text-center border-t border-gray-100">
          <Link href={`/ecosystems/${ecosystem}`} className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-300">
            View All Ships
          </Link>
        </div>
      )}
    </div>
  );
};

export default PortLeaderboard;
