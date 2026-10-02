/**
 * FastestPayoutHero — Hero card highlighting the fastest-paying hackathon.
 *
 * Sits above the regular hackathon list and shows: hero name, average
 * payout days, payout completion rate, builder count, total prize pool.
 * Also shows ecosystem-level averages and a CTA for builders waiting on payouts.
 * Returns `null` when no entries have payout-speed data.
 */

import Link from "next/link";
import { BoltIcon } from "@heroicons/react/24/solid";
import { ClockIcon } from "@heroicons/react/24/outline";
import Button from "@/components/common/Button";

const ECOSYSTEM_LABELS = {
  solana: "Solana",
  ethereum: "Ethereum",
  base: "Base",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  celo: "Celo",
  linea: "Linea",
  arc: "Arc",
};

const ECOSYSTEM_COLORS = {
  solana: { bg: "bg-green-50 dark:bg-green-900/20", text: "text-green-700 dark:text-green-300", border: "border-green-200 dark:border-green-800" },
  ethereum: { bg: "bg-indigo-50 dark:bg-indigo-900/20", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800" },
  arc: { bg: "bg-teal-50 dark:bg-teal-900/20", text: "text-teal-700 dark:text-teal-300", border: "border-teal-200 dark:border-teal-800" },
  base: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
};

function computeEcosystemAverages(entries) {
  const byEcosystem = {};
  for (const e of entries) {
    if (e.avgPayoutDays === null || !e.ecosystem) continue;
    const eco = e.ecosystem.toLowerCase();
    if (!byEcosystem[eco]) byEcosystem[eco] = { totalDays: 0, countHacks: 0, totalProjects: 0 };
    byEcosystem[eco].totalDays += e.avgPayoutDays;
    byEcosystem[eco].countHacks += 1;
    byEcosystem[eco].totalProjects += e.totalProjects || 0;
  }
  return Object.entries(byEcosystem)
    .map(([key, v]) => ({
      ecosystem: ECOSYSTEM_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1),
      key,
      avgDays: Math.round(v.totalDays / v.countHacks),
      hackCount: v.countHacks,
      projectCount: v.totalProjects,
    }))
    .sort((a, b) => a.avgDays - b.avgDays)
    .slice(0, 5);
}

export default function FastestPayoutHero({ entries }) {
  const withSpeedData = entries
    .filter((e) => e.avgPayoutDays !== null && e.avgPayoutDays >= 0)
    .sort((a, b) => a.avgPayoutDays - b.avgPayoutDays);

  if (withSpeedData.length === 0) return null;

  const fastest = withSpeedData[0];
  const runnerUp = withSpeedData[1] || null;
  const ecosystemAverages = computeEcosystemAverages(withSpeedData);

  return (
    <div className="mb-8 rounded-2xl border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 dark:from-yellow-900/20 dark:via-amber-900/10 dark:to-orange-900/10 overflow-hidden">
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-yellow-400 shadow-lg shadow-yellow-200/50">
            <BoltIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="inline-block text-xs font-bold tracking-wider text-yellow-700 dark:text-yellow-400 uppercase bg-yellow-200/60 dark:bg-yellow-800/40 px-2.5 py-0.5 rounded-full">
              Fastest Paying
            </span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 dark:text-white mt-0.5">
              {fastest.name}
            </h2>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-300 ml-[52px]">
          Pays winners in <span className="font-semibold text-emerald-700 dark:text-emerald-300 dark:text-emerald-400">{fastest.avgPayoutDays} days</span> on average
          {fastest.payoutCompletionRate > 0 && ` with a ${fastest.payoutCompletionRate}% payout rate`}
        </p>
      </div>

      <div className="px-6 pb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl bg-white/70 dark:bg-white/5 backdrop-blur-sm border border-yellow-200/60 p-3.5 text-center">
          <div className="flex items-center justify-center gap-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300 dark:text-emerald-400">
            {fastest.avgPayoutDays}
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">days</span>
          </div>
          <p className="text-xs text-secondary mt-1">Average payout time</p>
        </div>

        <div className="rounded-xl bg-white/70 dark:bg-white/5 backdrop-blur-sm border border-yellow-200/60 p-3.5 text-center">
          <div className={`text-2xl font-bold ${fastest.payoutCompletionRate >= 80 ? "text-green-700 dark:text-green-300 dark:text-green-400" : fastest.payoutCompletionRate >= 50 ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-300 dark:text-red-400"}`}>
            {fastest.payoutCompletionRate}%
          </div>
          <p className="text-xs text-secondary mt-1">Winners paid</p>
        </div>

        <div className="rounded-xl bg-white/70 dark:bg-white/5 backdrop-blur-sm border border-yellow-200/60 p-3.5 text-center">
          <div className="text-2xl font-bold text-gray-800 dark:text-gray-200 dark:text-white">
            {fastest.builderCount || 0}
          </div>
          <p className="text-xs text-secondary mt-1">Active builders</p>
        </div>

        <div className="rounded-xl bg-white/70 dark:bg-white/5 backdrop-blur-sm border border-yellow-200/60 p-3.5 text-center">
          <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
            {fastest.totalPrizeAmount > 0 ? `$${Math.round(fastest.totalPrizeAmount / 1000)}k` : "—"}
          </div>
          <p className="text-xs text-secondary mt-1">Total prizes</p>
        </div>
      </div>

      {ecosystemAverages.length > 1 && (
        <div className="px-6 pb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-yellow-200/50" />
            <span className="text-xs font-semibold tracking-wider text-yellow-700 dark:text-yellow-400 uppercase">
              By Ecosystem
            </span>
            <div className="h-px flex-1 bg-yellow-200/50" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {ecosystemAverages.map((eco) => {
              const colors = ECOSYSTEM_COLORS[eco.key] || { bg: "bg-gray-50 dark:bg-gray-800/30", text: "text-gray-700 dark:text-gray-300", border: "border-gray-200 dark:border-gray-700" };
              return (
                <div key={eco.key} className={`rounded-lg ${colors.bg} ${colors.border} border p-2.5 text-center`}>
                  <div className="text-xs font-medium uppercase tracking-wide opacity-75">{eco.ecosystem}</div>
                  <div className={`text-lg font-bold ${eco.avgDays <= 14 ? "text-emerald-600 dark:text-emerald-400" : eco.avgDays <= 45 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                    {eco.avgDays}<span className="text-sm font-normal opacity-75">d</span>
                  </div>
                  <div className="text-xs text-secondary">{eco.hackCount} hackathons</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {runnerUp && (
        <div className="border-t border-yellow-200/50 px-6 py-3 flex items-center justify-between bg-white/40 dark:bg-white/5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <BoltIcon className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
              {runnerUp.name}
            </span>
            <span className="text-xs text-secondary">
              · {runnerUp.builderCount} builder{runnerUp.builderCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{runnerUp.avgPayoutDays}d avg</span>
            <span className={`font-semibold ${runnerUp.payoutCompletionRate >= 80 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
              {runnerUp.payoutCompletionRate}%
            </span>
          </div>
        </div>
      )}

      <div className="border-t border-yellow-200/50 px-6 py-4 bg-gradient-to-r from-indigo-50/80 via-blue-50/80 to-teal-50/80 dark:from-indigo-900/10 dark:via-blue-900/10 dark:to-teal-900/10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-800/40">
              <ClockIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Waiting on a payout?
              </p>
              <p className="text-xs text-secondary">
                Get funded upfront while you wait. No interest, no collateral.
              </p>
            </div>
          </div>
          <Link href="/build">
            <Button variant="primary" size="sm">
              Get Paid Today
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
