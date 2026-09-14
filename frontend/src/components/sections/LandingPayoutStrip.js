/**
 * LandingPayoutStrip — live payout-speed proof for the landing page.
 * Reuses FastestPayoutHero when data exists; stays quiet when empty.
 * Below-the-fold: fetch deferred to idle so the hero paints first.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import FastestPayoutHero from "@/components/leaderboard/FastestPayoutHero";

export default function LandingPayoutStrip() {
  const [entries, setEntries] = useState(null); // null = not loaded yet; [] = loaded empty
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Defer below-the-fold fetch until idle — landing paints first.
    const run = () => {
      fetch("/api/hackathons/leaderboard")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load payout data");
          return res.json();
        })
        .then((data) => { if (!cancelled) setEntries(data.hackathons || []); })
        .catch(() => { if (!cancelled) { setEntries([]); setFailed(true); } });
    };
    let idleId = null;
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(run, { timeout: 2500 });
    } else {
      const t = setTimeout(run, 400);
      idleId = { timeout: t };
    }
    return () => {
      cancelled = true;
      if (typeof window !== "undefined" && "cancelIdleCallback" in window && idleId) {
        window.cancelIdleCallback(idleId);
      } else if (idleId?.timeout) {
        clearTimeout(idleId.timeout);
      }
    };
  }, []);

  // Reserve layout height while loading so the strip never shifts the CTA.
  if (entries === null && !failed) {
    return (
      <section className="border-t border-default bg-surface py-10 sm:py-14" aria-busy="true">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="skeleton h-7 w-64 mb-2" />
          <div className="skeleton h-4 w-96 mb-6" />
          <div className="skeleton h-24 w-full" />
        </div>
      </section>
    );
  }

  const hasSpeed = entries.some((e) => e.avgPayoutDays !== null && e.avgPayoutDays >= 0);

  return (
    <section className="border-t border-default bg-surface py-10 sm:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-primary">
              Payout truth, in public
            </h2>
            <p className="text-sm text-secondary mt-1 max-w-xl">
              How fast do hackathons actually pay winners? This is the ledger ecosystems feel pressure from.
            </p>
          </div>
          <Link
            href="/leaderboard"
            className="text-sm font-semibold text-amber-700 dark:text-amber-300 hover:underline"
          >
            Full payout leaderboard →
          </Link>
        </div>

        {hasSpeed ? (
          <FastestPayoutHero entries={entries} />
        ) : (
          <div className="rounded-xl border border-dashed border-default p-6 text-sm text-secondary">
            Payout-speed data is still filling in.{" "}
            <Link href="/leaderboard" className="text-amber-700 dark:text-amber-300 underline">
              Claim a win or report a payout
            </Link>{" "}
            to add the next data point.
          </div>
        )}
      </div>
    </section>
  );
}
