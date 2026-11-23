/**
 * Sponsor Payouts — list of the signed-in sponsor's payout campaigns.
 * A campaign is a verified cohort payout routed via MultiHopper.
 * See docs/MULTIHOPPER_PLAN.md.
 */

import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "@/stores/authStore";
import { listCampaigns } from "@/lib/payoutCampaignApi";
import { Card } from "@/components/common/Card";

const STATUS_STYLE = {
  draft: "bg-surface-tertiary text-text-secondary",
  awaiting_funding: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  routing: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  partially_settled: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  settled: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  exception: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  cancelled: "bg-surface-tertiary text-text-muted line-through",
};

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

export default function PayoutsPage() {
  const router = useRouter();
  const { currentUser } = useUser();
  const [campaigns, setCampaigns] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (currentUser === false) {
      router.push("/login?redirectTo=/payouts");
    }
  }, [currentUser, router]);

  useEffect(() => {
    if (!currentUser) return;
    listCampaigns(currentUser)
      .then((d) => setCampaigns(d.campaigns || []))
      .catch((e) => setError(e.message));
  }, [currentUser]);

  return (
    <>
      <Head>
        <title>Payout Campaigns — PledgeBond</title>
      </Head>
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Payout campaigns</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Verified cohort payouts — prizes, grants, and contributor distributions routed on Solana.
            </p>
          </div>
          <Link
            href="/payouts/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            New campaign
          </Link>
        </div>

        {error && (
          <Card className="p-4 text-sm text-red-600 dark:text-red-400">{error}</Card>
        )}

        {campaigns === null && !error && (
          <p className="text-sm text-text-tertiary">Loading campaigns…</p>
        )}

        {campaigns && campaigns.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-text-secondary">No payout campaigns yet.</p>
            <p className="mt-2 text-sm text-text-tertiary">
              Create your first campaign to route a verified cohort payout.
            </p>
          </Card>
        )}

        {campaigns && campaigns.length > 0 && (
          <ul className="space-y-3">
            {campaigns.map((c) => (
              <li key={c.id}>
                <Link href={`/payouts/${c.id}`}>
                  <Card className="flex items-center justify-between p-4 transition hover:shadow-md">
                    <div>
                      <p className="font-medium text-text-primary">{c.title}</p>
                      <p className="mt-0.5 text-sm text-text-tertiary">
                        {c.recipientCount ?? c.recipients?.length ?? 0} recipient(s) ·{" "}
                        {c.totalAmount} {c.asset}
                        {c.settlement?.settledCount > 0 &&
                          ` · ${c.settlement.settledCount} settled`}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[c.status] || STATUS_STYLE.draft}`}
                    >
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
