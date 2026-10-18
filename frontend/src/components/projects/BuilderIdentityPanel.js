/**
 * BuilderIdentityPanel — Shows the builder behind a project
 *
 * Displays: submittedBy identifier, wallet address, Ethos credibility score,
 * GitHub profile link, and social profile links.
 */

import React from 'react';
import { Card } from '@/components/common/Card';
import {
  UserCircleIcon,
  CodeBracketIcon,
  GlobeAltIcon,
  HashtagIcon,
  ChatBubbleLeftRightIcon,
  WalletIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

function IdentityRow({ icon: Icon, label, value, href, mono }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 min-w-0 flex-1">
        <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="text-right min-w-0 max-w-[55%]">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300 transition-colors truncate"
          >
            <span className={`truncate ${mono ? 'font-mono' : ''}`}>{value || '-'}</span>
            <ArrowTopRightOnSquareIcon className="w-3 h-3 flex-shrink-0" />
          </a>
        ) : (
          <span className={`text-sm font-medium text-gray-900 dark:text-gray-100 ${mono ? 'font-mono text-xs' : ''} truncate block`}>
            {value || '-'}
          </span>
        )}
      </div>
    </div>
  );
}

export default function BuilderIdentityPanel({
  project,
  ownerEthosUser,
  ownerEthosLoading,
  EthosScoreBadge: EthosBadge,
}) {
  const hasAnyIdentity = project.submittedBy || project.ownerWalletAddress || project.twitter || project.discord || project.owner;

  if (!hasAnyIdentity) return null;

  // Build GitHub profile link from owner
  const githubHref = project.owner
    ? `https://github.com/${project.owner}`
    : null;

  return (
    <Card className="p-5 border-0 shadow-lg rounded-2xl overflow-hidden">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-1">
        <span className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
          <UserCircleIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </span>
        Builder
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        The team building this project
      </p>

      <div className="divide-y divide-gray-100">
        {project.submittedBy && (
          <IdentityRow
            icon={UserCircleIcon}
            label="User ID"
            value={`${project.submittedBy.slice(0, 8)}...${project.submittedBy.slice(-4)}`}
            mono
          />
        )}

        {project.owner && (
          <IdentityRow
            icon={CodeBracketIcon}
            label="GitHub"
            value={`@${project.owner}`}
            href={githubHref}
          />
        )}

        {project.ownerWalletAddress && (
          <div className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 min-w-0 flex-1">
              <WalletIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
              <span className="truncate">Wallet</span>
            </div>
            <div className="text-right min-w-0 max-w-[55%]">
              <div className="flex items-center gap-2 justify-end">
                <span className="font-mono text-xs text-gray-900 dark:text-gray-100 truncate">
                  {`${project.ownerWalletAddress.slice(0, 6)}...${project.ownerWalletAddress.slice(-4)}`}
                </span>
                {ownerEthosLoading ? (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">Loading...</span>
                ) : ownerEthosUser ? (
                  <EthosBadge
                    score={ownerEthosUser.score}
                    ethosUser={ownerEthosUser}
                    size="sm"
                    showLabel={false}
                  />
                ) : null}
              </div>
            </div>
          </div>
        )}

        {project.twitter && (
          <IdentityRow
            icon={HashtagIcon}
            label="X / Twitter"
            value={`@${project.twitter.replace('@', '')}`}
            href={`https://x.com/${project.twitter.replace('@', '')}`}
          />
        )}

        {project.discord && (
          <IdentityRow
            icon={ChatBubbleLeftRightIcon}
            label="Discord"
            value={project.discord}
            href={project.discord.startsWith('http') ? project.discord : `https://discord.gg/${project.discord}`}
          />
        )}
      </div>

      {project.teamMembers && Array.isArray(project.teamMembers) && project.teamMembers.length > 0 && (
        <details className="mt-4 group">
          <summary className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-300 cursor-pointer transition-colors list-none flex items-center gap-1.5">
            <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Team ({project.teamMembers.length})
          </summary>
          <div className="mt-2 space-y-1.5">
            {project.teamMembers.map((member, i) => {
              const addr = typeof member === 'string' ? member : (member.address || member.wallet || '');
              const share = typeof member === 'object' ? member.share : null;
              return (
                <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 bg-gray-50 rounded-lg">
                  <span className="font-mono text-gray-700 dark:text-gray-300 truncate">
                    {addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : `Member ${i + 1}`}
                  </span>
                  {share && <span className="text-gray-500 dark:text-gray-400 font-medium">{share}%</span>}
                </div>
              );
            })}
          </div>
        </details>
      )}
    </Card>
  );
}
