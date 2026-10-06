/**
 * Project Card Components
 * Reusable project display components with different variants
 */

import React, { useMemo } from 'react';
import { useRouter } from 'next/router';
import { agentsHref } from '@/config/navigation';
import { Card } from '../common/Card';
import Button from '../common/Button';
import VelocityBadge from '../common/VelocityBadge';
import { getEcosystemConfig, getEcosystemClasses } from '../../config/ecosystems';
import { getGitHubUrl, calculateScoutingFlags } from '../../utils/projectUtils';
import ChainBadges from '../showcase/ChainBadges';
import SectorBadges from '../showcase/SectorBadges';
import AgentVerifiedBadge from '../common/AgentVerifiedBadge';
import AttestcoinBadge from '../common/AttestcoinBadge';
import { ProofBadgeGroup } from "../common/ProofBadge";
import { computeProjectBadges } from "../../lib/badges/computeBadges";
import {
  StarIcon,
  CodeBracketIcon,
  ExclamationCircleIcon,
  ArrowTopRightOnSquareIcon,
  CalendarIcon,
  UserGroupIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  TrophyIcon,
  MagnifyingGlassCircleIcon,
  Battery100Icon
} from '@heroicons/react/24/outline';

/**
 * Evolution tier helper based on project health score
 */
export const getEvolutionTier = (score = 0) => {
  if (score >= 90) return { 
    name: 'Admiral', 
    class: 'tier-admiral lighthouse-beam rope-border-gold', 
    icon: <TrophyIcon className="w-5 h-5 text-amber-500 dark:text-amber-400" /> 
  };
  if (score >= 75) return { 
    name: 'Captain', 
    class: 'tier-captain compass-rose', 
    icon: <ShieldCheckIcon className="w-5 h-5 text-purple-500 dark:text-purple-400" /> 
  };
  if (score >= 50) return { 
    name: 'Voyager', 
    class: 'tier-voyager anchor-accent', 
    icon: <RocketLaunchIcon className="w-5 h-5 text-blue-500 dark:text-blue-400" /> 
  };
  return { 
    name: 'Scout', 
    class: 'tier-scout', 
    icon: <UserGroupIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" /> 
  };
};

/**
 * Base Project Card - Foundation for all variants
 */
export const BaseProjectCard = ({ 
  project, 
  variant = 'default',
  showEcosystem = false,
  onClick,
  className = '',
  children 
}) => {
  const ecosystemConfig = getEcosystemConfig(project.ecosystem);
  const classes = getEcosystemClasses(project.ecosystem);
  
  return (
    <Card 
      className={`transition-all duration-200 hover:shadow-md ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </Card>
  );
};

/**
 * Project Preview Card - Minimal info for overview mode
 */
export const ProjectPreviewCard = ({ project, onClick }) => {
  const ecosystemConfig = getEcosystemConfig(project.ecosystem);
  
  return (
    <BaseProjectCard project={project} onClick={onClick} className="p-4">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate flex-1 pr-2">
          {project.name || project.slug}
        </h4>
        <div className="flex items-center gap-1 flex-shrink-0">
          <VelocityBadge velocity={project.stats?.velocity} />
          {project.stats?.isActive && (
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          )}
        </div>
      </div>
      
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>{project.stats?.commits || 0} commits</span>
        {ecosystemConfig && (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${ecosystemConfig.bgColor} ${ecosystemConfig.textColor}`}>
            {ecosystemConfig.shortName}
          </span>
        )}
      </div>
    </BaseProjectCard>
  );
};

/**
 * Project Detail Card - Full information display
 */
export const ProjectDetailCard = ({ project, showEcosystem = true, onClick }) => {
  const router = useRouter();
  const ecosystemConfig = getEcosystemConfig(project.ecosystem);
  const githubUrl = getGitHubUrl(project);
  const tier = getEvolutionTier(project.stats?.healthScore || 0);
  const scoutFlags = calculateScoutingFlags(project);
  
  const handleLinkClick = (e, url) => {
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  
  const projectBadges = useMemo(() => computeProjectBadges(project), [project]);

  return (
    <BaseProjectCard project={project} onClick={onClick} className={`p-6 relative overflow-hidden ${tier.class}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
              {project.name || project.slug}
            </h4>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:text-gray-200">
              {tier.icon}
              <span className="ml-1">{tier.name}</span>
            </span>
            {(project.stats?.healthScore > 80 || project.verifiedByAgent) && (
              <AgentVerifiedBadge size="sm" agentName={project.stats?.healthScore > 90 ? 'Underwriter' : 'Verifier'} />
            )}
            {project.attestcoin && (
              <AttestcoinBadge attestation={project.attestcoin.attestations?.[0]} size="sm" />
            )}
          </div>
          {showEcosystem && ecosystemConfig && (
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${ecosystemConfig.bgColor} ${ecosystemConfig.textColor}`}>
                <span>{ecosystemConfig.icon}</span>
                <span>{ecosystemConfig.shortName}</span>
              </span>
              {project.season && (
                <span className="px-2 py-1 bg-gray-100 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                  Season {project.season}
                </span>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {project.stats?.isActive && (
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          )}
          {project.lookingForFunding && (
            <div className="px-2 py-1 bg-blue-100 text-blue-800 dark:text-blue-300 text-xs rounded-full font-medium">
              Seeking Funding
            </div>
          )}
        </div>
      </div>

      {/* Project Image */}
      {project.imageUrl && (
        <div className="mb-4 rounded-lg overflow-hidden border border-gray-100">
          <img
            src={project.imageUrl}
            alt={project.name}
            className="w-full h-40 object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* AI Scouting Flags & Trade Winds */}
      {(scoutFlags.highVelocity || scoutFlags.underBacked) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {scoutFlags.isScoutChoice && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold animate-pulse">
              <MagnifyingGlassCircleIcon className="w-4 h-4" />
SCOUT&apos;S CHOICE
            </div>
          )}
          {scoutFlags.highVelocity && !scoutFlags.isScoutChoice && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 dark:text-green-300 rounded-lg text-[10px] font-bold uppercase">
              <Battery100Icon className="w-3.5 h-3.5" />
              High Velocity
            </div>
          )}
          {scoutFlags.underBacked && !scoutFlags.isScoutChoice && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 dark:text-blue-300 rounded-lg text-[10px] font-bold uppercase">
              <RocketLaunchIcon className="w-3.5 h-3.5" />
              Under-Backed
            </div>
          )}
        </div>
      )}

      {/* Description */}
      {project.description && (
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-3">
          {project.description}
        </p>
      )}

      {/* Badges */}
      <div className="mb-4 space-y-2">
        {projectBadges.length > 0 && (
          <ProofBadgeGroup badges={projectBadges} size="sm" max={3} className="mb-2" />
        )}
        {project.chains && project.chains.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase">Networks</div>
            <ChainBadges chains={project.chains} compact={true} />
          </div>
        )}
        {project.sectors && project.sectors.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase">Sectors</div>
            <SectorBadges sectors={project.sectors} compact={true} />
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
          <CodeBracketIcon className="w-4 h-4" />
          <span>{project.stats?.commits || 0} commits</span>
        </div>
        <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
          <StarIcon className="w-4 h-4" />
          <span>{project.stats?.stars || 0} stars</span>
        </div>
        <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
          <ExclamationCircleIcon className="w-4 h-4" />
          <span>{project.stats?.issues || 0} issues</span>
        </div>
        <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
          <UserGroupIcon className="w-4 h-4" />
          <span>{project.stats?.forks || 0} forks</span>
        </div>
      </div>

      {/* Health Score - Nanopayment Powered */}
      {project.stats?.healthScore ? (
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600 dark:text-gray-400">Health Score</span>
            <span className="font-medium">{project.stats.healthScore}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                project.stats.healthScore >= 80 ? 'bg-green-500' :
                project.stats.healthScore >= 60 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${project.stats.healthScore}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-1">
              🤖 AI Underwriter
            </span>
            <span className="text-indigo-600 dark:text-indigo-400 font-medium">0.05 USDC</span>
          </div>
        </div>
      ) : (
        <div className="mb-4 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-indigo-900">🤖 AI Health Analysis</p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400">Get AI-powered insights via nanopayment</p>
            </div>
            <Button
              size="sm"
              className="text-xs"
              onClick={(e) => {
                e.stopPropagation();
                router.push(agentsHref("analyze", project.id));
              }}
            >
              Analyze · $0.05
            </Button>
          </div>
        </div>
      )}

      {/* Hackathon proof summary */}
      {Array.isArray(project.hackathons) && project.hackathons.length > 0 && (
        <div className="mb-4 p-3 bg-pink-50 rounded-lg border border-pink-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-pink-800 dark:text-pink-300 uppercase tracking-wider">PledgeBond</span>
            <span className="text-xs text-pink-700 dark:text-pink-300 font-medium">{project.hackathons.length} claim{project.hackathons.length === 1 ? '' : 's'}</span>
          </div>
          <div className="space-y-1.5">
            {project.hackathons.slice(0, 2).map((hackathon, idx) => {
              const hasEvidence = Boolean(hackathon?.announcementUrl || hackathon?.submissionUrl || hackathon?.payoutTxHash || hackathon?.payoutWallet || hackathon?.evidenceUrl);
              return (
                <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <span className="font-medium text-pink-900 dark:text-pink-200 truncate">{hackathon?.name || `Hackathon ${idx + 1}`}</span>
                    {hackathon?.outcome ? <span className="text-pink-700 dark:text-pink-300"> · {hackathon.outcome}</span> : null}
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full ${hasEvidence ? 'bg-green-100 text-green-700 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:text-gray-400'}`}>
                    {hasEvidence ? 'Evidence attached' : 'Claim only'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Backer Market Section */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">Predictive Market</span>
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">82% Confidence</span>
        </div>
        <div className="flex items-center justify-between mb-2 text-sm">
          <span className="text-gray-600 dark:text-gray-400">Total Backed</span>
          <span className="font-bold text-gray-900 dark:text-gray-100">$2,450 USDC</span>
        </div>
        <Button 
          className="w-full py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          onClick={(e) => {
            e.stopPropagation();
            window.location.href = '/back';
          }}
        >
          🎲 Back this Builder
        </Button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
          {project.stats?.lastCommit && (
            <div className="flex items-center space-x-1">
              <CalendarIcon className="w-3 h-3" />
              <span>
                {new Date(project.stats.lastCommit).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {githubUrl && (
            <Button
              onClick={(e) => handleLinkClick(e, githubUrl)}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <ArrowTopRightOnSquareIcon className="w-3 h-3 mr-1" />
              GitHub
            </Button>
          )}
          {project.website && (
            <Button
              onClick={(e) => handleLinkClick(e, project.website)}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <ArrowTopRightOnSquareIcon className="w-3 h-3 mr-1" />
              Website
            </Button>
          )}
        </div>
      </div>
    </BaseProjectCard>
  );
};

/**
 * Project List Item - Compact horizontal layout
 */
export const ProjectListItem = ({ project, onClick }) => {
  const ecosystemConfig = getEcosystemConfig(project.ecosystem);
  const githubUrl = getGitHubUrl(project);
  
  return (
    <BaseProjectCard project={project} onClick={onClick} className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          {/* Project Info */}
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                {project.name || project.slug}
              </h4>
              {ecosystemConfig && (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${ecosystemConfig.bgColor} ${ecosystemConfig.textColor}`}>
                  {ecosystemConfig.icon} {ecosystemConfig.shortName}
                </span>
              )}
              {project.stats?.isActive && (
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              )}
            </div>
            {project.description && (
              <p className="text-gray-600 dark:text-gray-400 text-sm truncate">
                {project.description}
              </p>
            )}
          </div>
          
          {/* Stats */}
          <div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400">
            {Array.isArray(project.testerTasks) && project.testerTasks.length > 0 && (
              <div className="text-center">
                <div className="font-medium text-purple-700 dark:text-purple-300">{project.testerTasks.length}</div>
                <div className="text-xs text-purple-700 dark:text-purple-300">Tasks</div>
              </div>
            )}
            <div className="text-center">
              <div className="font-medium text-gray-900 dark:text-gray-100">{project.stats?.commits || 0}</div>
              <div className="text-xs">Commits</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-900 dark:text-gray-100">{project.stats?.stars || 0}</div>
              <div className="text-xs">Stars</div>
            </div>
            {project.stats?.healthScore && (
              <div className="text-center">
                <div className={`font-medium ${
                  project.stats.healthScore >= 80 ? 'text-green-600 dark:text-green-400' :
                  project.stats.healthScore >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {project.stats.healthScore}%
                </div>
                <div className="text-xs">Health</div>
              </div>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center space-x-2">
          {githubUrl && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                window.open(githubUrl, '_blank', 'noopener,noreferrer');
              }}
              variant="outline"
              size="sm"
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </BaseProjectCard>
  );
};

/**
 * Project Grid Card - Balanced layout for grid displays
 */
export const ProjectGridCard = ({ project, onClick }) => {
  const ecosystemConfig = getEcosystemConfig(project.ecosystem);
  const tier = getEvolutionTier(project.stats?.healthScore || 0);
  
  const projectBadges = useMemo(() => computeProjectBadges(project), [project]);

  return (
    <BaseProjectCard project={project} onClick={onClick} className={`p-5 h-full flex flex-col relative overflow-hidden ${tier.class}`}>
      {/* Project Image */}
      {project.imageUrl && (
        <div className="mb-3 -mx-5 -mt-5 overflow-hidden border-b border-gray-100">
          <img
            src={project.imageUrl}
            alt={project.name}
            className="w-full h-32 object-cover"
            loading="lazy"
          />
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
              {project.name || project.slug}
            </h4>
            <span title={tier.name}>{tier.icon}</span>
            <VelocityBadge velocity={project.stats?.velocity} />
          </div>
          {ecosystemConfig && (
            <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${ecosystemConfig.bgColor} ${ecosystemConfig.textColor}`}>
              <span>{ecosystemConfig.icon}</span>
              <span>{ecosystemConfig.shortName}</span>
            </span>
          )}
        </div>
        {project.stats?.isActive && (
          <div className="w-2 h-2 bg-green-500 rounded-full mt-1"></div>
        )}
      </div>

      {/* Description */}
      <div className="flex-1 mb-4">
        {project.description ? (
          <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-3">
            {project.description}
          </p>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm italic">
            {project.owner}/{project.repo}
          </p>
        )}
      </div>

      {/* Badges */}
      <div className="mb-4 space-y-2">
        {projectBadges.length > 0 && (
          <ProofBadgeGroup badges={projectBadges} size="sm" max={2} className="mb-2" />
        )}
        {project.chains && project.chains.length > 0 && (
          <ChainBadges chains={project.chains} compact={true} />
        )}
        {project.sectors && project.sectors.length > 0 && (
          <SectorBadges sectors={project.sectors} compact={true} />
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center text-sm mb-4">
        <div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">{project.stats?.commits || 0}</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">Commits</div>
        </div>
        {Array.isArray(project.testerTasks) && project.testerTasks.length > 0 && (
          <div>
            <div className="font-semibold text-purple-700 dark:text-purple-300">{project.testerTasks.length}</div>
            <div className="text-purple-700 dark:text-purple-300 text-xs">Tasks</div>
          </div>
        )}
        <div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">{project.stats?.stars || 0}</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">Stars</div>
        </div>
        <div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">{project.stats?.issues || 0}</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">Issues</div>
        </div>
      </div>

      {/* Health Score */}
      {project.stats?.healthScore && (
        <div className="mt-auto">
          <div className={`text-center py-2 rounded-lg text-sm font-medium ${
            project.stats.healthScore >= 80 ? 'bg-green-100 text-green-800 dark:text-green-300' :
            project.stats.healthScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {project.stats.healthScore}% Health Score
          </div>
        </div>
      )}
    </BaseProjectCard>
  );
};

// Export default as ProjectDetailCard for backward compatibility
export default ProjectDetailCard;
