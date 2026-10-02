/**
 * ProjectCard Component
 * ROI-focused project card for backers — shows real project data
 */

import React from 'react';
import { Card } from '@/components/common/Card';
import Button from '@/components/common/Button';
import ProjectHealthChart from './ProjectHealthChart';
import SnsIdentityBadge from '@/components/common/SnsIdentityBadge';
import { BuilderTrustCompact } from '@/components/common/BuilderTrust';
import { isValidSolanaAddress } from '@/utils/common';
import useAgentPeek from '@/hooks/useAgentPeek';
import { 
  CurrencyDollarIcon, 
  ArrowTrendingUpIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  HeartIcon,
  GlobeAltIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline';

const ECOSYSTEM_STYLES = {
  solana: { bg: 'bg-[#14F195]/10', text: 'text-[#14F195]', border: 'border-[#14F195]/30', label: 'Solana' },
  celo: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', label: 'Celo' },
  arc: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', label: 'Arc' },
  base: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Base' },
  linea: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', label: 'Linea' },
  arbitrum: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', label: 'Arbitrum' },
  ethereum: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', label: 'Ethereum' },
  optimism: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Optimism' },
};

const BORDER_COLORS = [
  'border-blue-500', 'border-purple-500', 'border-indigo-500',
  'border-cyan-500', 'border-teal-500', 'border-violet-500',
];

export default function ProjectCard({ project, onBack, scoutScore }) {
  const progress = (project.totalBacked / project.targetFunding) * 100;
  const ecoStyle = ECOSYSTEM_STYLES[project.ecosystem] || ECOSYSTEM_STYLES.base;

  // Cached Underwriter summary — free read, paid for by the first caller.
  const { peek } = useAgentPeek(project.id || project.slug);
  const peekScore = peek?.summary?.healthScore ?? null;
  
  // Pick a border color based on project index for visual variety
  const borderClass = BORDER_COLORS[(project.slug || project.id || '').length % BORDER_COLORS.length];
  
  // Extract builder display name from available data
  const builderName = project.githubUrl
    ? project.githubUrl.split('/').slice(-2, -1)[0] || null
    : project.owner || null;

  // Builder's Solana address for trust display
  const builderAddress = (project.ecosystem === 'solana' || isValidSolanaAddress(project.developer || ''))
    ? project.developer : null;
  
  return (
    <Card className={`h-full flex flex-col hover:shadow-xl transition-all duration-300 border-t-4 ${borderClass}`}>
      <div className="p-5 flex-1">
        {/* Badges Row */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {/* Ecosystem Badge */}
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${ecoStyle.bg} ${ecoStyle.text} ${ecoStyle.border} border`}>
            {ecoStyle.label}
          </span>

          {/* Token launch readiness — only for Solana projects */}
          {project.ecosystem === 'solana' && (
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
              project.tokenLaunchReady
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : project.tokenLaunchProgress > 50
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}>
              🚀 {project.tokenLaunchReady ? 'Ready' : `${project.tokenLaunchProgress || 0}%`}
            </span>
          )}

          {/* Category Badge */}
          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {project.category}
          </span>

          {/* AI Scout Badge */}
          {scoutScore?.backed && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 rounded-full px-2 py-0.5">
              🤖 {scoutScore.score}/100
            </span>
          )}

          {/* Cached Underwriter summary — first caller paid, this read is free */}
          {peekScore != null && (
            <span
              title={`Underwriter · cached ${peek.cachedAge}`}
              className={`inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 border ${
                peek?.summary?.healthVerdict === "back"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-gray-50 text-gray-600 border-gray-200"
              }`}
            >
              📊 {peekScore}/100{peek?.summary?.recommendation ? ` · ${peek.summary.recommendation}` : ""}
            </span>
          )}
          
          {project.founderStaked && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 animate-pulse-slow">
              💎 ${project.founderStakedAmount}
            </span>
          )}

          {/* Heartbeat */}
          <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider rounded-full px-2 py-0.5 border ${
            project.lastCheckIn < 24 ? 'text-blue-700 bg-blue-50 border-blue-200' :
            project.lastCheckIn < 72 ? 'text-yellow-700 bg-yellow-50 border-yellow-200' :
            'text-red-700 bg-red-50 border-red-200'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              project.lastCheckIn < 24 ? 'bg-blue-500 animate-ping' :
              project.lastCheckIn < 72 ? 'bg-yellow-500' :
              'bg-red-500'
            }`} />
            {project.lastCheckIn < 24 ? 'Active' : project.lastCheckIn < 72 ? 'Recent' : 'Stale'}
          </span>

          {/* Builder trust — on-chain reputation */}
          {builderAddress && (
            <BuilderTrustCompact address={builderAddress} />
          )}
        </div>

        {/* Project Name + Builder */}
        <div className="flex justify-between items-start mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-lg text-gray-900 line-clamp-1">{project.name || project.slug}</h3>
            
            {/* Builder identity */}
            {builderName && (
              <div className="flex items-center gap-1.5 mt-1">
                <CodeBracketIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-500 truncate">{builderName}</span>
                {project.founders?.length > 1 && (
                  <span className="text-[10px] text-gray-400">+{project.founders.length - 1}</span>
                )}
              </div>
            )}
            
            {/* SNS Identity for Solana */}
            {project.developer && (project.ecosystem === 'solana' || isValidSolanaAddress(project.developer)) && (
              <div className="mt-0.5">
                <SnsIdentityBadge
                  address={project.developer}
                  snsNameOverride={project.builderSnsDomain || null}
                  chainFamily="solana"
                  showFallback={true}
                  showLoading={true}
                  className="text-xs"
                />
              </div>
            )}
          </div>
          <div className="text-right flex-shrink-0 ml-3">
            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Multiplier</div>
            <div className="text-2xl font-black text-blue-700">{project.activeMultiplier}x</div>
          </div>
        </div>

        {/* Description */}
        {project.shortDescription && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-3 leading-relaxed">{project.shortDescription}</p>
        )}

        {/* ROI Highlight */}
        <div className="bg-green-50 rounded-lg p-2.5 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowTrendingUpIcon className="w-4 h-4 text-green-600" />
            <span className="text-xs font-semibold text-green-800">Projected ROI</span>
          </div>
          <span className="text-base font-bold text-green-700">+{Math.round(project.projectedROI)}%</span>
        </div>

        {/* Health & Confidence */}
        <div className="mb-4">
          <ProjectHealthChart 
            health={project.health} 
            confidence={project.confidence} 
          />
        </div>

        {/* Funding Stats */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <div className="flex items-center gap-1 text-gray-500">
              <CurrencyDollarIcon className="w-4 h-4" />
              <span>Total Backed</span>
            </div>
            <span className="font-bold text-gray-900">${project.totalBacked?.toLocaleString()}</span>
          </div>
          
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 rounded-full"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-gray-500">
            <span>{Math.round(progress)}% of target</span>
            <span>Target: ${project.targetFunding?.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 bg-gray-50 border-t border-gray-100 mt-auto flex gap-2">
        <Button 
          variant="primary" 
          className="flex-1 py-2.5 text-sm font-bold shadow-blue-200 shadow-lg flex items-center justify-center gap-2"
          onClick={() => onBack(project)}
        >
          <ShieldCheckIcon className="w-4 h-4" />
          Scout & Back
        </Button>
        {project.githubUrl && (
          <a
            href={project.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1.5"
            title="View on GitHub"
          >
            <CodeBracketIcon className="w-4 h-4" />
            <span className="text-xs font-medium hidden sm:inline">Code</span>
          </a>
        )}
        {project.socials?.website && (
          <a
            href={project.socials.website}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors flex items-center"
            title="Visit website"
          >
            <GlobeAltIcon className="w-4 h-4" />
          </a>
        )}
      </div>
    </Card>
  );
}
