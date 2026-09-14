import React from 'react';
import Link from 'next/link';
import { useGithub } from '@/providers/Github/Github';

export default function Footer() {
  const { meta } = useGithub();

  return (
    <footer className="bg-surface border-t border-default">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Explore */}
          <div>
            <h4 className="text-sm font-semibold text-primary mb-3">Explore</h4>
            <ul className="space-y-2">
              <li><Link href="/explore" className="text-sm text-secondary hover:text-primary transition-colors">Explore Projects</Link></li>
              <li><Link href="/leaderboard" className="text-sm text-secondary hover:text-primary transition-colors">Leaderboard</Link></li>
              <li><Link href="/back?tab=agents&mode=jury" className="text-sm text-secondary hover:text-primary transition-colors">Agents</Link></li>
            </ul>
          </div>

          {/* Build */}
          <div>
            <h4 className="text-sm font-semibold text-primary mb-3">Build</h4>
            <ul className="space-y-2">
              <li><Link href="/build" className="text-sm text-secondary hover:text-primary transition-colors">Builder Dashboard</Link></li>
              <li><Link href="/back" className="text-sm text-secondary hover:text-primary transition-colors">Back Projects</Link></li>
              <li><Link href="/profile" className="text-sm text-secondary hover:text-primary transition-colors">Profile</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-semibold text-primary mb-3">Resources</h4>
            <ul className="space-y-2">
              <li><a href="https://github.com/thisyearnofear/pledgebond" target="_blank" rel="noopener noreferrer" className="text-sm text-secondary hover:text-primary transition-colors">GitHub</a></li>
              <li><Link href="/" className="text-sm text-secondary hover:text-primary transition-colors">Home</Link></li>
            </ul>
          </div>

          {/* Status */}
          <div>
            <h4 className="text-sm font-semibold text-primary mb-3">Status</h4>
            <ul className="space-y-2">
              <li className="text-sm text-tertiary">{process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ? `v${process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.slice(0, 7)}` : 'Development'}</li>
              {meta?.updatedAt && (
                <li className="text-xs text-tertiary">Last refreshed: {new Date(meta.updatedAt).toLocaleString()}</li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-default text-center">            <p className="text-sm text-tertiary">
              © {new Date().getFullYear()} PledgeBond — The reputation layer for crypto builders.
            </p>
        </div>
      </div>
    </footer>
  );
}
