/**
 * Payout Campaign detail — sponsor console for a single campaign.
 * Actions follow the status machine in src/lib/payoutCampaigns.js:
 * draft → awaiting_funding → approved → routing → partially_settled → settled.
 *
 * With ?wallet=<addr> in the URL, renders the sanitized recipient view
 * (no auth, no sponsor-private data).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "@/stores/authStore";
import {
  getCampaign,
  transitionCampaign,
  createPayoutRoute,
  reconcilePayoutRoute,
} from "@/lib/payoutCampaignApi";
import { Card } from "@/components/common/Card";

const STATUS_LABEL = {
  draft: "Draft",
  awaiting_funding: "Awaiting funding",
  approved: "Approved",
  routing: "Routing",
  partially_settled: "Partially settled",
  settled: "Settled",
  exception: "Exception",
  cancelled: "Cancelled",
};

const TRANSFER_STYLE = {
  pending: "text-text-tertiary",
  settled: "text-green-600 dark:text-green-400",
  failed: "text-red-600 dark:text-red-400",
};

export default function PayoutCampaignDetailPage() {
  const router = useRouter();
  const { id, wallet } = router.query;
  const { currentUser } = useUser();

  const [campaign, setCampaign] = useState(null);
  const [recipientData, setRecipientData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    if (wallet) {
      const d = await getCampaign(null, id, wallet);
      setRecipientData(d.campaign);
      return;
    }
    if (!currentUser) return;
    const d = await getCampaign(currentUser, id);
    setCampaign(d.campaign);
    return d.campaign;
  }, [id, wallet, currentUser]);

  const reconcile = useCallback(async () => {
    if (!id || wallet || !currentUser) return;
    await reconcilePayoutRoute(currentUser, id);
    await refresh();
  }, [id, wallet, currentUser, refresh]);

  useEffect(() => {
    if (currentUser === false && !wallet) {
      router.push(`/login?redirectTo=/payouts/${id}`);
      return;
    }
    refresh().catch((e) => setError(e.message));
  }, [refresh, currentUser, wallet, id, router]);

  // Poll route status while transfers are in flight
  useEffect(() => {
    if (!campaign || !["routing", "partially_settled"].includes(campaign.status)) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(() => reconcile().catch(() => {}), 10_000);
    return () => pollRef.current && clearInterval(pollRef.current);
  }, [campaign, reconcile]);

  async function act(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // ── Recipient view ────────────────────────────────────────────────────
  if (wallet) {
    return (
      <>
        <Head><title>Payout status — PledgeBond</title></Head>
        <main className="mx-auto max-w-lg px-4 py-16">
          <Card className="p-6">
            {!recipientData && !error && <p className="text-sm text-text-tertiary">Loading…</p>}
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {recipientData && (
              <>
                <p className="text-xs uppercase tracking-wide text-text-tertiary">Incoming payout</p>
                <h1 className="mt-1 text-xl font-semibold text-text-primary">{recipientData.title}</h1>
                {recipientData.sponsorName && (
                  <p className="mt-1 text-sm text-text-secondary">from {recipientData.sponsorName}</p>
                )}
                <div className="mt-4 flex items-center justify-between rounded-lg bg-surface-secondary p-3">
                  <div>
                    <p className="font-mono text-xs text-text-tertiary">{recipientData.recipient?.wallet?.slice(0, 12)}…</p>
                    <p className="text-lg font-semibold text-text-primary">
                      {recipientData.recipient?.amount} {recipientData.asset}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-text-secondary">
                    {recipientData.transfer?.status === "settled" ? "Paid ✓" : STATUS_LABEL[recipientData.status] || recipientData.status}
                  </span>
                </div>
                {recipientData.transfer?.signature && (
                  <p className="mt-3 break-all font-mono text-xs text-text-tertiary">
                    tx: {recipientData.transfer.signature}
                  </p>
                )}
              </>
            )}
          </Card>
        </main>
      </>
    );
  }

  // ── Sponsor view ──────────────────────────────────────────────────────
  const transfers = campaign?.settlement?.transfers || [];
  const status = campaign?.status;

  return (
    <>
      <Head><title>{campaign ? `${campaign.title} — Payout` : "Payout campaign"} — PledgeBond</title></Head>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/payouts" className="text-sm text-text-tertiary hover:text-text-secondary">← All campaigns</Link>

        {error && <Card className="mt-4 p-4 text-sm text-red-600 dark:text-red-400">{error}</Card>}
        {!campaign && !error && <p className="mt-6 text-sm text-text-tertiary">Loading…</p>}

        {campaign && (
          <>
            <div className="mt-4 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-text-primary">{campaign.title}</h1>
                <p className="mt-1 text-sm text-text-secondary">
                  {campaign.recipientCount} recipient(s) · {campaign.totalAmount} {campaign.asset}
                </p>
              </div>
              <span className="rounded-full bg-surface-tertiary px-3 py-1 text-xs font-medium text-text-secondary">
                {STATUS_LABEL[status] || status}
              </span>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {status === "draft" && (
                <ActionButton busy={busy} onClick={() => act(() => transitionCampaign(currentUser, id, "submit"))}>
                  Submit for funding
                </ActionButton>
              )}
              {status === "awaiting_funding" && (
                <>
                  <ActionButton busy={busy} onClick={() => act(() => transitionCampaign(currentUser, id, "approve"))}>
                    Approve campaign
                  </ActionButton>
                  <ActionButton busy={busy} secondary onClick={() => act(() => transitionCampaign(currentUser, id, "reopen"))}>
                    Back to draft
                  </ActionButton>
                </>
              )}
              {(status === "approved" || status === "exception") && (
                <ActionButton busy={busy} onClick={() => act(() => createPayoutRoute(currentUser, id))}>
                  {status === "exception" ? "Retry route" : "Create payout route"}
                </ActionButton>
              )}
              {["routing", "partially_settled"].includes(status) && (
                <ActionButton busy={busy} onClick={() => act(reconcile)}>
                  Refresh status
                </ActionButton>
              )}
              {!["settled", "cancelled"].includes(status) && (
                <ActionButton busy={busy} danger onClick={() => act(() => transitionCampaign(currentUser, id, "cancel"))}>
                  Cancel campaign
                </ActionButton>
              )}
            </div>

            {status === "awaiting_funding" && !campaign.evidenceUrl && (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                Approval needs an evidence URL and business purpose — edit the draft to add them, or wait for admin review.
              </p>
            )}

            {campaign.route && (
              <Card className="mt-6 p-4">
                <p className="text-xs uppercase tracking-wide text-text-tertiary">Route</p>
                <p className="mt-1 font-mono text-sm text-text-primary">{campaign.route.routeId}</p>
                <p className="mt-1 text-xs text-text-tertiary">
                  {campaign.route.provider} · {campaign.route.routeType} · {campaign.route.status}
                  {campaign.route.mock && " · mock"}
                </p>
                {campaign.route.failure && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">{campaign.route.failure}</p>
                )}
              </Card>
            )}

            <Card className="mt-6 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-primary text-left text-xs uppercase tracking-wide text-text-tertiary">
                    <th className="px-4 py-2">Recipient</th>
                    <th className="px-4 py-2">Amount</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Signature</th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.recipients.map((r) => {
                    const t = transfers.find((x) => x.wallet === r.wallet);
                    return (
                      <tr key={r.wallet} className="border-b border-border-secondary last:border-0">
                        <td className="px-4 py-2">
                          <span className="font-mono text-xs text-text-primary">{r.wallet.slice(0, 8)}…{r.wallet.slice(-4)}</span>
                          {r.note && <span className="ml-2 text-xs text-text-tertiary">{r.note}</span>}
                        </td>
                        <td className="px-4 py-2 text-text-primary">{r.amount} {campaign.asset}</td>
                        <td className={`px-4 py-2 text-xs font-medium ${TRANSFER_STYLE[t?.status || "pending"]}`}>
                          {t?.status || "pending"}
                        </td>
                        <td className="px-4 py-2">
                          {t?.signature ? (
                            <span className="font-mono text-xs text-text-tertiary">{t.signature.slice(0, 16)}…</span>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>

            <p className="mt-4 text-xs text-text-tertiary">
              Share a recipient&apos;s status link: <code className="font-mono">/payouts/{id}?wallet=&lt;address&gt;</code>
            </p>
          </>
        )}
      </main>
    </>
  );
}

function ActionButton({ children, onClick, busy, secondary, danger }) {
  const base = "rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50";
  const style = danger
    ? "border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
    : secondary
      ? "border border-border-primary text-text-secondary hover:bg-surface-hover"
      : "bg-indigo-600 text-white hover:bg-indigo-500";
  return (
    <button onClick={onClick} disabled={busy} className={`${base} ${style}`}>
      {children}
    </button>
  );
}
