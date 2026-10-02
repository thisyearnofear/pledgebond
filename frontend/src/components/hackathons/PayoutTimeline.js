import React, { useState, useEffect } from 'react';
import { Card } from '@/components/common/Card';
import { LoadingSpinner } from '@/components/common/LoadingStates';
import { ARC_EXPLORER } from '@/config/tokens';
import ErrorBoundary from '@/components/ErrorBoundary';
import Link from 'next/link';

import {
  CheckBadgeIcon,
  ShieldExclamationIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

/**
 * PayoutTimeline Component
 *
 * Displays a scrollable timeline of declared → paid → verified for each
 * winning project in a hackathon. Shows payout speed, verification status,
 * and aggregate metrics.
 *
 * Props:
 *   hackathonId: string  — Firestore doc ID of the hackathon
 *   hackathonName: string — name for display
 *   isCompleted: boolean  — whether the hackathon has ended
 */

export default function PayoutTimeline({ hackathonId, hackathonName, isCompleted }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!hackathonId) return;

    async function fetchTimeline() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/hackathons/${hackathonId}?sub=payout-timeline`);

        if (!res.ok) {
          if (res.status === 404) {
            setData(null);
            setLoading(false);
            return;
          }
          throw new Error('Failed to fetch payout timeline');
        }

        const json = await res.json();
        setData(json.data);
      } catch (err) {
        console.error('Error fetching payout timeline:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchTimeline();
  }, [hackathonId]);

  if (loading) {
    return (
      <Card>
        <div className="p-6 flex items-center justify-center">
          <LoadingSpinner size="md" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="p-6">
          <ErrorBoundary
            name="PayoutTimeline"
            errorMessage={error}
          />
        </div>
      </Card>
    );
  }

  if (!data || data.totalWinners === 0) {
    if (!isCompleted) {
      return null; // Don't show for active/upcoming hackathons
    }

    return (
      <Card>
        <div className="p-6 text-center text-gray-500">
          <p>No payout data available for this hackathon yet.</p>
          <p className="text-sm mt-1">
            Winners will appear here once payouts are recorded and verified.
          </p>
        </div>
      </Card>
    );
  }

  const {
    totalWinners,
    paidWinners,
    totalPrizeAmount,
    avgPayoutDays,
    payoutCompletionRate,
    timeline,
  } = data;

  return (
    <Card>
      <div className="p-6">
        {/* Header with aggregate metrics */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-gray-600" />
            Payout Timeline
          </h2>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
            payoutCompletionRate >= 90
              ? 'bg-green-100 text-green-800'
              : payoutCompletionRate >= 60
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {paidWinners}/{totalWinners} paid ({payoutCompletionRate}%)
          </span>
        </div>

        {/* Metric chips */}
        <div className="flex flex-wrap gap-4 mb-6">
          <MetricChip
            label="Avg Payout Time"
            value={avgPayoutDays !== null ? `${avgPayoutDays} days` : 'N/A'}
            color={avgPayoutDays !== null && avgPayoutDays <= 7 ? 'green' : avgPayoutDays !== null && avgPayoutDays <= 30 ? 'yellow' : 'gray'}
          />
          <MetricChip
            label="Total Distributed"
            value={`$${totalPrizeAmount.toLocaleString()}`}
            color="blue"
          />
          <MetricChip
            label="Completion Rate"
            value={`${payoutCompletionRate}%`}
            color={payoutCompletionRate >= 90 ? 'green' : payoutCompletionRate >= 60 ? 'yellow' : 'red'}
          />
        </div>

        {/* Timeline entries */}
        <div className="space-y-3">
          {timeline.map((entry, index) => (
            <PayoutTimelineRow key={`${entry.projectSlug}-${index}`} entry={entry} isFirst={index === 0} />
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * Individual payout timeline row
 */
function PayoutTimelineRow({ entry, isFirst }) {
  const {
    projectSlug,
    projectName,
    winnerAddress,
    prizeAmount,
    claimOutcome,
    declaredAt,
    paidAt,
    payoutLatencyDays,
    verified,
    confidence,
    payoutTxHash,
    attestationId,
  } = entry;

  const isPaid = paidAt !== null;
  const isLongWait = payoutLatencyDays !== null && payoutLatencyDays > 90;

  return (
    <div className={`p-4 rounded-lg border ${
      isFirst && isPaid
        ? 'border-yellow-400 bg-yellow-50'
        : isPaid
        ? 'border-green-200 bg-green-50'
        : isLongWait
        ? 'border-red-200 bg-red-50'
        : 'border-gray-200 bg-gray-50'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Project name + link */}
          <div className="flex items-center gap-2">
            {isFirst && isPaid && (
              <span className="text-xs font-bold text-yellow-700 uppercase tracking-wide">⚡ Fastest Payout</span>
            )}
            {isLongWait && !isPaid && (
              <span className="text-xs font-bold text-red-700 uppercase tracking-wide">⚠ Overdue</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Link
              href={`/projects/${projectSlug}`}
              className="font-medium text-gray-900 hover:text-blue-600 truncate"
            >
              {projectName}
            </Link>
            <span className="text-xs text-gray-500 capitalize">({claimOutcome})</span>
          </div>

          {/* Timeline visualization */}
          <div className="mt-3 flex items-center gap-1 text-sm">
            {/* Declared */}
            <div className="flex items-center gap-1 text-gray-600">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Declared</span>
              {declaredAt && (
                <span className="text-gray-400 text-xs">{formatDate(declaredAt)}</span>
              )}
            </div>

            {/* Arrow */}
            <ArrowIcon paid={isPaid} longWait={isLongWait} />

            {/* Paid */}
            <div className={`flex items-center gap-1 ${isPaid ? 'text-green-700' : 'text-gray-400'}`}>
              <span className={`w-2 h-2 rounded-full ${isPaid ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>{isPaid ? 'Paid' : 'Not yet paid'}</span>
              {isPaid && paidAt && (
                <span className="text-gray-400 text-xs">{formatDate(paidAt)}</span>
              )}
            </div>

            {/* Latency badge */}
            {payoutLatencyDays !== null && (
              <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded ${
                payoutLatencyDays <= 7
                  ? 'bg-green-100 text-green-800'
                  : payoutLatencyDays <= 30
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {payoutLatencyDays}d
              </span>
            )}
          </div>

          {/* Amount + verification */}
          <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
            <span className="font-medium text-gray-900">${prizeAmount.toLocaleString()}</span>

            {paidAt ? (
              verified ? (
                <span className="flex items-center gap-1 text-green-700">
                  <CheckBadgeIcon className="h-4 w-4" />
                  Agent-verified
                </span>
              ) : (
                <span className="flex items-center gap-1 text-yellow-700">
                  <ShieldExclamationIcon className="h-4 w-4" />
                  Unverified
                </span>
              )
            ) : (
              <span className="flex items-center gap-1 text-red-600">
                <ExclamationTriangleIcon className="h-4 w-4" />
                Pending
              </span>
            )}
          </div>

          {/* Transaction link */}
          {payoutTxHash && (
            <div className="mt-1">
              <a
                href={`${ARC_EXPLORER}/tx/${payoutTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                View transaction
              </a>
            </div>
          )}
        </div>

        {/* Confidence badge */}
        {verified && (
          <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
            confidence === 'high'
              ? 'bg-green-100 text-green-800'
              : confidence === 'medium'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            {confidence} confidence
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Arrow icon for timeline visualization
 */
function ArrowIcon({ paid, longWait }) {
  const color = paid ? 'text-green-500' : longWait ? 'text-red-400' : 'text-gray-300';
  return (
    <svg className={`w-4 h-4 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

/**
 * Metric chip for aggregate stats
 */
function MetricChip({ label, value, color }) {
  const colorClasses = {
    green: 'bg-green-50 text-green-800 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    red: 'bg-red-50 text-red-800 border-red-200',
    blue: 'bg-blue-50 text-blue-800 border-blue-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200',
  };

  return (
    <div className={`px-3 py-2 rounded-lg border ${colorClasses[color] || colorClasses.gray}`}>
      <div className="text-xs opacity-75">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

/**
 * Format ISO date to readable string
 */
function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}
