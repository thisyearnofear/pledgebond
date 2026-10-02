/**
 * WinnerGate — interstitial shown to unverified users in the project editor
 *
 * Enhances ProjectEditor without replacing it. Blocks submission until the
 * user is verified as a past hackathon winner.
 *
 * Three states:
 *   1. Loading checking status
 *   2. Claim form (not verified, no pending claim)
 *   3. Pending review (not verified, has pending claim)
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser } from '@/stores/authStore';
import { trackFunnelStep } from '@/lib/funnel';
import { Card } from '@/components/common/Card';
import Button from '@/components/common/Button';
import { Input, Textarea, Select, Checkbox } from '@/components/common/Input';
import { LoadingSpinner } from '@/components/common/LoadingStates';
import {
  TrophyIcon,
  CheckCircleIcon,
  ClockIcon,
  SparklesIcon,
  XCircleIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';

export default function WinnerGate({ onSubmitClaim, loading, pendingClaim, error }) {
  const [hackathonName, setHackathonName] = useState('');
  const [announcementUrl, setAnnouncementUrl] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [outcome, setOutcome] = useState('winner');
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [wantsCall, setWantsCall] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  // Platform stats for the progress bar
  const [platformStats, setPlatformStats] = useState(null);

  useEffect(() => {
    fetch('/api/platform/stats')
      .then(r => r.json())
      .then(setPlatformStats)
      .catch(() => {});
  }, []);

  // If there's already a pending claim on the server, show lead magnet state
  if (pendingClaim) {
    return <PendingLeadMagnet pendingClaim={pendingClaim} platformStats={platformStats} />;
  }

  // If already submitted locally, show lead magnet state
  if (submitted) {
    return <PendingLeadMagnet pendingClaim={{ hackathonName }} platformStats={platformStats} />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    if (!hackathonName.trim()) {
      setSubmitError('Hackathon name is required');
      setSubmitting(false);
      return;
    }

    if (!announcementUrl.trim()) {
      setSubmitError('A public announcement URL is required (e.g. Twitter/X)');
      setSubmitting(false);
      return;
    }

    if (!githubRepo.trim()) {
      setSubmitError('GitHub repo URL is required');
      setSubmitting(false);
      return;
    }

    if (!email.trim()) {
      setSubmitError('Email is required so we can notify you when verified');
      setSubmitting(false);
      return;
    }

    const result = await onSubmitClaim({
      hackathonName: hackathonName.trim(),
      announcementUrl: announcementUrl.trim(),
      githubRepo: githubRepo.trim(),
      outcome,
      email: email.trim(),
      telegram: telegram.trim() || null,
      wantsCall,
    });

    setSubmitting(false);

    if (result.success) {
      trackFunnelStep('winner_claim', 'claim_submitted', { outcome });
      setSubmitted(true);
    } else {
      setSubmitError(result.error || 'Failed to submit claim');
    }
  };

  return (
    <Card className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg mb-4">
          <TrophyIcon className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-primary mb-2">
          This Platform Is for Past Hackathon Winners
        </h2>
        <p className="text-secondary max-w-lg mx-auto">
          PledgeBond is exclusive to builders who have won a hackathon and are continuing
          that project. Show us your win and we&apos;ll verify you ASAP.
        </p>
      </div>

      {/* Why */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 text-center">
          <div className="text-2xl mb-1">🏆</div>
          <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-200">
            Proven Signal
          </p>
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
            A hackathon win is stronger proof-of-concept than a pitch deck
          </p>
        </div>
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 text-center">
          <div className="text-2xl mb-1">⚡</div>
          <p className="text-xs font-semibold text-blue-800 dark:text-blue-200">
            Payout Transparency
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Leaderboard ranks hackathons by payout speed, so you know who pays
          </p>
        </div>
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 text-center">
          <div className="text-2xl mb-1">🚀</div>
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            No Fresh Starts
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
            Continue the project you already proved worth building
          </p>
        </div>
      </div>

      {/* Claim form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-primary mb-1">
            Hackathon Name
          </label>
          <Input
            placeholder="e.g. ETHGlobal HackFS 2024"
            value={hackathonName}
            onChange={(e) => setHackathonName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-1">
            Winner Announcement URL
          </label>
          <Input
            placeholder="e.g. https://x.com/username/status/..."
            value={announcementUrl}
            onChange={(e) => setAnnouncementUrl(e.target.value)}
            required
          />
          <p className="text-xs text-tertiary mt-1">
            Public announcement (Twitter/X, Devpost, blog) showing your project won
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-1">
            Winning Project GitHub URL
          </label>
          <Input
            placeholder="e.g. https://github.com/username/project"
            value={githubRepo}
            onChange={(e) => setGithubRepo(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-1">
            Outcome
          </label>
          <Select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          >
            <option value="winner">Winner</option>
            <option value="finalist">Finalist / Runner-up</option>
          </Select>
        </div>

        <div className="border-t border-default pt-4">
          <p className="text-sm font-semibold text-primary mb-3">Stay in the loop</p>
          <div className="space-y-3">
            <div>
              <Input
                label="Email *"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="text-xs text-tertiary mt-1">We'll notify you the moment you're verified.</p>
            </div>
            <div>
              <Input
                label="Telegram / Discord (optional)"
                placeholder="@username"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
              />
            </div>
            <Checkbox
              label="I'd like a 1:1 call with the founder"
              checked={wantsCall}
              onChange={(e) => setWantsCall(e.target.checked)}
            />
          </div>
        </div>

        {submitError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
            <XCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            {submitError}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
            <XCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="w-full justify-center"
        >
          {submitting ? (
            <>
              <LoadingSpinner size="sm" />
              <span className="ml-2">Submitting claim...</span>
            </>
          ) : (
            <>
              <SparklesIcon className="w-5 h-5 mr-2" />
              Submit for Verification
            </>
          )}
        </Button>

        <p className="text-xs text-tertiary text-center">
          The founder reviews every claim personally. You&apos;ll typically get verified ASAP.
        </p>
      </form>

      {/* No win yet — route to the front door instead of a dead end */}
      <div className="mt-6 pt-6 border-t border-default text-center">
        <p className="text-sm text-secondary mb-2">
          Haven&apos;t won a hackathon yet?
        </p>
        <Link
          href="/explore?tab=hackathons"
          className="text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline"
          onClick={() => trackFunnelStep('winner_claim', 'explore_hackathons_clicked')}
        >
          Browse active and upcoming hackathons to find your first win →
        </Link>
      </div>
    </Card>
  );
}

function PendingLeadMagnet({ pendingClaim, platformStats }) {
  const { currentUser } = useUser();
  const [queuePosition, setQueuePosition] = useState(null);
  const [totalPending, setTotalPending] = useState(0);

  useEffect(() => {
    if (!pendingClaim?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const token = currentUser ? await currentUser.getIdToken() : null;
        const res = await fetch('/api/winner-verification', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!cancelled) {
          if (data.queuePosition != null) setQueuePosition(data.queuePosition);
          if (data.totalPending != null) setTotalPending(data.totalPending);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [pendingClaim?.id, currentUser]);

  const winnersOnboarded = platformStats?.winnersOnboarded || 0;
  const targetWinners = platformStats?.targetWinners || 500;
  const progressPercent = Math.min(Math.round((winnersOnboarded / targetWinners) * 100), 100);

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Pending claim card */}
      <Card className="p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg mb-4">
          <TrophyIcon className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-primary mb-2">
          You&apos;re in the Queue
        </h2>
        <p className="text-secondary mb-4 max-w-sm mx-auto">
          Your hackathon claim for <strong>{pendingClaim?.hackathonName}</strong> is
          pending review. The founder personally vets every builder.
        </p>

        {/* Queue position */}
        {queuePosition != null && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 mb-4">
            <UserGroupIcon className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
              You&apos;re #{queuePosition} of {totalPending} in the queue
            </span>
          </div>
        )}

        {/* Platform progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-secondary mb-1.5">
            <span>Winners onboarded</span>
            <span>{winnersOnboarded} / {targetWinners}</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-tertiary mt-1">
            {targetWinners - winnersOnboarded} spots remaining before we open to referrals
          </p>
        </div>

        {/* Founder's commitment */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 text-left mb-4">
          <p className="text-sm font-semibold text-amber-900 mb-1">From the founder</p>
          <p className="text-sm text-amber-800 leading-relaxed">
            I personally review every claim. Here's what happens next:
          </p>
          <ol className="text-sm text-amber-700 mt-2 space-y-1 list-decimal pl-4">
            <li>I open your Twitter announcement and GitHub repo to verify the win</li>
            <li>I review your project for post-hackathon activity</li>
            <li>I approve you — you'll get a notification and can start submitting projects</li>
          </ol>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
          <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
          <span className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
            We'll notify you when verified
          </span>
        </div>
      </Card>

      {/* Call CTA card */}
      <Card className="p-6 border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
            <ChatBubbleLeftRightIcon className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-primary mb-1">Want to chat?</h3>
            <p className="text-sm text-secondary mb-3">
              I'd love to hear about your project, test your product, and give feedback.
              Every builder who wants a call gets one.
            </p>
            <span className="text-sm text-secondary">
              Reach out to schedule a call.
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
