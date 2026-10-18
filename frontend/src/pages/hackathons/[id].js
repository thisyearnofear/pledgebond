import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useUser } from '@/stores/authStore';

import { Card } from '@/components/common/Card';
import Button from '@/components/common/Button';
import { LoadingSpinner } from '@/components/common/LoadingStates';
import ErrorBoundary from '@/components/ErrorBoundary';
import PayoutTimeline from '@/components/hackathons/PayoutTimeline';
import { trackEvent } from '@/lib/analytics';

import {
  CalendarIcon,
  TrophyIcon,
  UsersIcon,
  CheckBadgeIcon,
  ArrowTopRightOnSquareIcon,
  PlusIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

/**
 * Individual Hackathon Page
 * Shows detailed information about a specific hackathon
 * 
 * Follows ENHANCEMENT FIRST by extending existing project detail patterns
 * Maintains CLEAN separation with dedicated hackathon components
 */

export default function HackathonDetailPage() {
  const router = useRouter();
  const { currentUser } = useUser();
  const { id } = router.query;
  const [hackathon, setHackathon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [participationStatus, setParticipationStatus] = useState(null);

  // PERFORMANT: Fetch hackathon data
  useEffect(() => {
    if (!id) return;

    async function fetchHackathon() {
      try {
        setLoading(true);
        setError(null);

        // Fetch hackathon details
        const response = await fetch(`/api/hackathons/${id}`);

        if (!response.ok) {
          throw new Error('Failed to fetch hackathon details');
        }

        const data = await response.json();
        setHackathon(data.data);

        const userParticipation = currentUser
          ? data.data.participants.find(p => p.userId === currentUser.uid)
          : null;

        setParticipationStatus(userParticipation ? userParticipation.participationStatus : null);

      } catch (err) {
        console.error('Error fetching hackathon:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchHackathon();
  }, [id]);

  // CLEAN: Format date range
  const formatDateRange = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);

    const options = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    };

    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
  };

  // CLEAN: Calculate days remaining
  const getDaysRemaining = (endDate) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ErrorBoundary
          name="HackathonDetail"
          errorMessage={error}
        />
      </div>
    );
  }

  if (!hackathon) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Hackathon not found</p>
      </div>
    );
  }

  // ORGANIZED: Calculate hackathon status for UI
  const daysRemaining = getDaysRemaining(hackathon.endDate);
  const isUpcoming = new Date(hackathon.startDate) > new Date();
  const isActive = !isUpcoming && daysRemaining > 0;
  const isCompleted = daysRemaining <= 0;

  return (
    <ErrorBoundary
      name="HackathonDetailPage"
      errorMessage="Failed to load hackathon details. Please refresh."
    >
      <div className="min-h-screen bg-gray-50">
        <Head>
          <title>{hackathon.name} Payout Report • PledgeBond</title>
          <meta
            name="description"
            content={`How fast does ${hackathon.name} pay winners? Track real payout speeds, completion rates, and verified winner data for the ${hackathon.ecosystem} hackathon.`}
          />
          <meta property="og:title" content={`${hackathon.name} — Payout Speed & Winner Report`} />
          <meta property="og:description" content={`Track how fast ${hackathon.name} pays its winners. Real payout data, verified on-chain.${hackathon.prizePool > 0 ? ` Prize pool: $${hackathon.prizePool.toLocaleString()}.` : ''}`} />
          <meta property="og:type" content="article" />
          <meta property="og:url" content={`https://pledgebond.com/hackathons/${id}`} />
          {(() => {
            const ogParams = new URLSearchParams({
              type: "hackathon",
              name: hackathon.name || "",
              ecosystem: hackathon.ecosystem || "",
              status: hackathon.status || "",
            });
            if (hackathon.prizePool > 0) ogParams.set("prizePool", String(hackathon.prizePool));
            return (
              <>
                <meta property="og:image" content={`/api/og?${ogParams.toString()}`} />
                <meta name="twitter:image" content={`/api/og?${ogParams.toString()}`} />
              </>
            );
          })()}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={`${hackathon.name} — Payout Speed Report`} />
          <meta name="twitter:description" content={`How fast does ${hackathon.name} pay winners? Real payout data from verified winners.`} />
        </Head>

        {/* Hackathon Header */}
        <div className="bg-surface border-b border-default">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center gap-4 mb-4">
              <Link
                href="/hackathons"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-300 flex items-center gap-1"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4 transform rotate-180" />
                All Hackathons
              </Link>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
                  {hackathon.name}
                  {isCompleted && (
                    <span className="px-3 py-1 bg-green-100 text-green-800 dark:text-green-300 text-sm font-medium rounded-full">
                      Completed
                    </span>
                  )}
                </h1>
                <div className="flex items-center gap-4 mt-2">
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-full">
                    {hackathon.ecosystem.toUpperCase()}
                  </span>
                  {hackathon.sponsors && hackathon.sponsors.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 dark:text-gray-400 text-sm">Sponsored by:</span>
                      {hackathon.sponsors.slice(0, 3).map(sponsor => (
                        <span key={sponsor} className="px-2 py-1 bg-blue-100 text-blue-800 dark:text-blue-300 text-xs rounded">
                          {sponsor}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Participation status */}
                {participationStatus && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                    <CheckBadgeIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="font-medium text-primary">
                      {participationStatus.charAt(0).toUpperCase() + participationStatus.slice(1)}
                    </span>
                  </div>
                )}

                {/* Action buttons — only show if registration URL is available */}
                {!participationStatus && isUpcoming && hackathon.registrationUrl && (
                  <a
                    href={hackathon.registrationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors min-h-touch"
                  >
                    Register
                  </a>
                )}

                {!participationStatus && isActive && hackathon.registrationUrl && (
                  <a
                    href={hackathon.registrationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors min-h-touch"
                  >
                    Join Hackathon
                  </a>
                )}
              </div>
            </div>

            {/* Dates and status */}
            <div className="mt-6 flex flex-col md:flex-row gap-4">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <CalendarIcon className="h-5 w-5" />
                <span>{formatDateRange(hackathon.startDate, hackathon.endDate)}</span>
              </div>

              {isUpcoming && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded">
                    Starts in {daysRemaining} days
                  </span>
                </div>
              )}

              {isActive && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:text-blue-300 text-sm font-medium rounded">
                    Ends in {daysRemaining} days
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Hackathon Details */}
            <div className="lg:col-span-2 space-y-8">
              {/* Overview Card */}
              <Card>
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-primary mb-4">Overview</h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {hackathon.description || 'No description provided for this hackathon.'}
                  </p>

                  {/* Prize Information */}
                  {hackathon.prizePool > 0 && (
                    <div className="mb-6">
                      <h3 className="font-medium text-primary mb-2">Prize Pool</h3>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-primary">
                          ${hackathon.prizePool.toLocaleString()}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">in prizes</span>
                      </div>
                    </div>
                  )}

                  {/* Tracks */}
                  {hackathon.tracks && hackathon.tracks.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-medium text-primary mb-2">Tracks</h3>
                      <div className="flex flex-wrap gap-2">
                        {hackathon.tracks.map(track => (
                          <span
                            key={track}
                            className="px-3 py-1 bg-gray-100 text-gray-700 dark:text-gray-300 text-sm rounded-full"
                          >
                            {track}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Verification Contract */}
                  {hackathon.verificationContract && (
                    <div className="mb-6">
                      <h3 className="font-medium text-primary mb-2">Verification</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400 break-all">
                          {hackathon.verificationContract}
                        </span>
                        <a
                          href={`https://etherscan.io/address/${hackathon.verificationContract}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center px-3 py-1 text-xs font-medium border border-border-primary bg-surface-primary text-text-secondary rounded hover:bg-surface-hover hover:text-blue-500 transition-colors min-h-touch"
                        >
                          View on Explorer
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Payout Timeline */}
              {isCompleted && hackathon && (
                <PayoutTimeline
                  hackathonId={id}
                  hackathonName={hackathon.name}
                  isCompleted={isCompleted}
                />
              )}

              {/* Participants Section */}
              <Card>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-primary">Participants</h2>
                    <span className="text-gray-500 dark:text-gray-400">
                      {hackathon.participants.length} {hackathon.participants.length === 1 ? 'participant' : 'participants'}
                    </span>
                  </div>

                  {/* Winners */}
                  {hackathon.participants.filter(p => p.participationStatus === 'winner').length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-medium text-primary mb-3 flex items-center gap-2">
                        <TrophyIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                        Winners
                      </h3>
                      <div className="space-y-3">
                        {hackathon.participants
                          .filter(p => p.participationStatus === 'winner')
                          .map(participant => (
                            <ParticipantCard
                              key={participant.id}
                              participant={participant}
                              hackathon={hackathon}
                            />
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Other Participants */}
                  {hackathon.participants.filter(p => p.participationStatus !== 'winner').length > 0 && (
                    <div>
                      <h3 className="font-medium text-primary mb-3 flex items-center gap-2">
                        <UsersIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        Participants
                      </h3>
                      <div className="space-y-3">
                        {hackathon.participants
                          .filter(p => p.participationStatus !== 'winner')
                          .map(participant => (
                            <ParticipantCard
                              key={participant.id}
                              participant={participant}
                              hackathon={hackathon}
                            />
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-8">
              {/* Quick Actions */}
              <Card>
                <div className="p-6">
                  <h3 className="font-semibold text-primary mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          trackEvent("leaderboard_share_clicked", {
                            platform: "x",
                            entry_type: "hackathon",
                            entry_name: hackathon.name,
                            hackathon_id: id,
                          });
                          const text = hackathon.prizePool > 0
                            ? `How fast does ${hackathon.name} pay winners? Track real payout data on @pledgebond` + (hackathon.prizePool ? ` Prize pool: $${hackathon.prizePool.toLocaleString()}.` : "")
                            : `Track payout speed for ${hackathon.name} on @pledgebond`;
                          const url = `https://pledgebond.com/hackathons/${id}`;
                          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border-primary bg-surface-primary text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-blue-500 transition-colors"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        Share
                      </button>
                      <button
                        onClick={() => {
                          trackEvent("leaderboard_share_clicked", {
                            platform: "farcaster",
                            entry_type: "hackathon",
                            entry_name: hackathon.name,
                            hackathon_id: id,
                          });
                          const text = `Track payout speed for ${hackathon.name}`;
                          const url = `https://pledgebond.com/hackathons/${id}`;
                          window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}%20${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border-primary bg-surface-primary text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-purple-500 transition-colors"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6.336 2.1h11.328l-.84 10.257L12 14.1l-4.824-1.743L6.336 2.1zM4.2 5.556l.672 8.166H8.4l.42 4.176h3.18l.42-4.176h3.528l.672-8.166H4.2z" />
                        </svg>
                        Cast
                      </button>
                    </div>

                    {isActive && (
                      <a
                        href="/projects/new"
                        className="inline-flex items-center justify-center w-full px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors min-h-touch"
                      >
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Submit Project
                      </a>
                    )}
                  </div>
                </div>
              </Card>

              {/* Hackathon Info */}
              <Card>
                <div className="p-6">
                  <h3 className="font-semibold text-primary mb-4">Information</h3>
                  <div className="space-y-3 text-sm">
                    <InfoItem icon={<CalendarIcon />} label="Start Date" value={new Date(hackathon.startDate).toLocaleDateString()} />
                    <InfoItem icon={<CalendarIcon />} label="End Date" value={new Date(hackathon.endDate).toLocaleDateString()} />
                    <InfoItem icon={<UsersIcon />} label="Status" value={hackathon.status} />
                    <InfoItem icon={<TrophyIcon />} label="Prize Pool" value={`$${hackathon.prizePool.toLocaleString()}`} />
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

/**
 * Participant Card Component
 * Displays individual participant information
 * 
 * Follows MODULAR principle with clear props interface
 * Maintains DRY with consistent participant display
 */
function ParticipantCard({ participant, hackathon }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-semibold">
          {participant.user?.displayName?.charAt(0) || 'U'}
        </div>
        <div>
          <div className="font-medium text-primary">
            {participant.user?.displayName || participant.user?.githubUsername || 'Unknown User'}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {participant.participationStatus}
            {participant.prizeCategory && ` • ${participant.prizeCategory}`}
          </div>
        </div>
      </div>

      {participant.prizeAmount > 0 && (
        <div className="font-medium text-primary">
          ${participant.prizeAmount.toLocaleString()}
        </div>
      )}
    </div>
  );
}

/**
 * Info Item Component
 * Reusable component for displaying key-value information
 * 
 * Follows CLEAN principle with simple props interface
 */
function InfoItem({ icon, label, value }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-gray-400 dark:text-gray-500">
        {React.cloneElement(icon, { className: 'h-4 w-4' })}
      </div>
      <div>
        <div className="text-gray-500 dark:text-gray-400 text-xs">{label}</div>
        <div className="text-primary font-medium">{value}</div>
      </div>
    </div>
  );
}