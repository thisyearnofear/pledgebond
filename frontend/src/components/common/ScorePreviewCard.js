import React from 'react';
import { Card } from '@/components/common/Card';
import Button from '@/components/common/Button';
import { useScorePreview } from '@/hooks/useScorePreview';

export default function ScorePreviewCard({
  compact = false,
  onGetStarted,
  className = '',
}) {
  const { username, setUsername, result, error, loading, submit } = useScorePreview();

  return (
    <div className={className}>
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="text"
          placeholder="Enter GitHub username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="flex-1 px-4 py-3 rounded-lg border border-default bg-surface text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          disabled={loading}
        />
        <Button
          type="submit"
          disabled={!username.trim() || loading}
          className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-5 py-3 text-sm font-semibold whitespace-nowrap"
        >
          {loading ? '...' : '🔍 Preview'}
        </Button>
      </form>

      {result && (
        <Card className="mt-4 p-4 text-left border border-default bg-surface/80 backdrop-blur-sm">
          <div className="mb-2">
            <p className="text-xs text-secondary">Public shipping track record</p>
            <p className="text-sm text-secondary">
              Bridge loans are sized against a confirmed prize, not a score — this is the record lenders see alongside your win claim.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-secondary">
            <span>📦 {result.stats.publicRepos} public repos</span>
            <span>⭐ {result.stats.totalStars} stars</span>
            <span>👥 {result.stats.followers} followers</span>
            <span>🕒 {result.stats.accountAgeDays} days on GitHub</span>
          </div>
          {onGetStarted && (
            <button
              onClick={onGetStarted}
              className="mt-3 w-full text-center text-sm font-semibold text-primary hover:text-primary-600"
            >
              Claim a win to get on the public payout ledger →
            </button>
          )}
        </Card>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
