import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/common/Input";
import Button from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { EnvelopeIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { trackEvent } from "@/lib/analytics";
import { trackFunnelStep } from "@/lib/funnel";

export default function PayoutLeadForm({ className = "" }) {
  const [hackathonName, setHackathonName] = useState("");
  const [email, setEmail] = useState("");
  const [prizeAmount, setPrizeAmount] = useState("");
  const [wallet, setWallet] = useState("");
  const [announcementUrl, setAnnouncementUrl] = useState("");
  const [convertedSlug, setConvertedSlug] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hackathonName.trim() || !email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/payout-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hackathonName: hackathonName.trim(),
          email: email.trim(),
          prizeAmount: prizeAmount ? Number(prizeAmount) : null,
          wallet: wallet.trim() || null,
          announcementUrl: announcementUrl.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to submit payout info");
      trackEvent("payout_lead_submitted", {
        hackathon: hackathonName.trim(),
        has_prize: !!prizeAmount,
        has_wallet: !!wallet,
      });
      trackFunnelStep("payout_lead", "lead_submitted", { hasEvidence: !!announcementUrl.trim() });
      if (data.converted && data.projectSlug) setConvertedSlug(data.projectSlug);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card className={`p-6 text-center ${className}`}>
        <CheckCircleIcon className="w-10 h-10 text-green-500 mx-auto mb-3" />
        <p className="font-semibold text-primary">
          {convertedSlug ? "Added to the leaderboard!" : "Thanks for contributing!"}
        </p>
        <p className="text-sm text-secondary mt-1">
          {convertedSlug ? (
            <>
              Your claim is live with evidence attached.{" "}
              <Link href={`/projects/arc/${convertedSlug}`} className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
                View it →
              </Link>
            </>
          ) : (
            <>
              We&apos;ll verify the payout data and update the leaderboard. Add an announcement link
              next time to publish instantly.
            </>
          )}
        </p>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <form onSubmit={handleSubmit} className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <EnvelopeIcon className="w-5 h-5 text-indigo-500" />
          <h3 className="font-semibold text-primary">Know a hackathon we&apos;re missing?</h3>
        </div>
        <p className="text-sm text-secondary mb-4">
          Tell us about a hackathon payout you&apos;re tracking. Add an announcement link and
          it goes on the leaderboard instantly — no wait for review.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <Input
            placeholder="Hackathon name *"
            value={hackathonName}
            onChange={(e) => setHackathonName(e.target.value)}
            required
            size="sm"
          />
          <Input
            type="email"
            placeholder="Your email *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            size="sm"
          />
          <Input
            type="url"
            placeholder="Announcement link (instant publish)"
            value={announcementUrl}
            onChange={(e) => setAnnouncementUrl(e.target.value)}
            size="sm"
          />
          <Input
            type="number"
            placeholder="Prize amount (optional)"
            value={prizeAmount}
            onChange={(e) => setPrizeAmount(e.target.value)}
            size="sm"
          />
          <Input
            placeholder="Your wallet address (optional)"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            size="sm"
          />
        </div>
        {error && (
          <div className="flex items-start gap-2 mb-3 p-3 rounded-lg bg-red-50 border border-red-200">
            <XCircleIcon className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={submitting}
          disabled={!hackathonName.trim() || !email.trim()}
        >
          Submit Payout Info
        </Button>
      </form>
    </Card>
  );
}
