/**
 * New Payout Campaign — sponsor creates a cohort payout draft.
 * Recipients: one per line as `wallet, amount[, note]`.
 */

import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useUser } from "@/stores/authStore";
import { createCampaign, parseRecipients } from "@/lib/payoutCampaignApi";
import { Card } from "@/components/common/Card";

export default function NewPayoutCampaignPage() {
  const router = useRouter();
  const { currentUser } = useUser();

  const [title, setTitle] = useState("");
  const [asset, setAsset] = useState("USDC");
  const [recipientsText, setRecipientsText] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [businessPurpose, setBusinessPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (currentUser === false) {
      router.push("/login?redirectTo=/payouts/new");
    }
  }, [currentUser, router]);

  const parsed = parseRecipients(recipientsText);
  const total = parsed.recipients.reduce((s, r) => s + r.amount, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (parsed.errors.length) {
      setError(parsed.errors.join("; "));
      return;
    }
    if (!parsed.recipients.length) {
      setError("Add at least one recipient");
      return;
    }
    setSubmitting(true);
    try {
      const { campaignId } = await createCampaign(currentUser, {
        title,
        asset,
        recipients: parsed.recipients,
        evidenceUrl: evidenceUrl || undefined,
        businessPurpose,
      });
      router.push(`/payouts/${campaignId}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>New Payout Campaign — PledgeBond</title>
      </Head>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-text-primary">New payout campaign</h1>
        <p className="mt-1 text-sm text-text-secondary">
          A campaign records who is owed what and why, then routes the payout once
          approved. Funds stay in your custody — the route moves them, we don&apos;t.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <Card className="space-y-4 p-5">
            <div>
              <label className="block text-sm font-medium text-text-primary">Campaign title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                minLength={3}
                placeholder="e.g. HackXY 2026 winner payouts"
                className="mt-1 w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary">Asset</label>
              <select
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                className="mt-1 rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm text-text-primary"
              >
                <option value="USDC">USDC</option>
                <option value="SOL">SOL</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary">
                Recipients <span className="font-normal text-text-tertiary">— one per line: wallet, amount[, note]</span>
              </label>
              <textarea
                value={recipientsText}
                onChange={(e) => setRecipientsText(e.target.value)}
                required
                rows={6}
                placeholder={"7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU, 250, 1st place\n9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM, 150, 2nd place"}
                className="mt-1 w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 font-mono text-xs text-text-primary"
              />
              {parsed.recipients.length > 0 && (
                <p className="mt-1 text-xs text-text-secondary">
                  {parsed.recipients.length} recipient(s) — total {total} {asset}
                </p>
              )}
              {parsed.errors.length > 0 && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{parsed.errors.join("; ")}</p>
              )}
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div>
              <label className="block text-sm font-medium text-text-primary">
                Evidence URL <span className="font-normal text-text-tertiary">(required to self-approve)</span>
              </label>
              <input
                type="url"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://… announcement, winners list, grant terms"
                className="mt-1 w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary">
                Business purpose <span className="font-normal text-text-tertiary">(required to self-approve)</span>
              </label>
              <textarea
                value={businessPurpose}
                onChange={(e) => setBusinessPurpose(e.target.value)}
                rows={2}
                placeholder="Why these payments are due — e.g. prize distribution for HackXY 2026 winners"
                className="mt-1 w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm text-text-primary"
              />
              <p className="mt-1 text-xs text-text-tertiary">
                Counted toward qualifying routed volume only when the business purpose is verifiable.
              </p>
            </div>
          </Card>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create draft campaign"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/payouts")}
              className="rounded-lg border border-border-primary px-5 py-2 text-sm text-text-secondary hover:bg-surface-hover"
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
