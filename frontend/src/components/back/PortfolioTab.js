import React, { useState, useEffect } from "react";
import { useWallet } from "@/stores/walletStore";
import { useBuilderCredit } from "@/stores/walletStore";
import { Card } from "@/components/common/Card";
import Button from "@/components/common/Button";
import SnsIdentityBadge from "@/components/common/SnsIdentityBadge";
import { isValidSolanaAddress } from "@/utils/common";
import { LoadingSpinner } from "@/components/common/LoadingStates";
import {
  BanknotesIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";

/** Share of settled loans that were repaid, as a whole percent. */
function computeRepaymentRate(details) {
  const settled = details.filter((d) => d.status === "repaid");
  const resolved = details.filter((d) => d.status === "repaid" || d.status === "defaulted");
  if (resolved.length === 0) return null;
  return Math.round((settled.length / resolved.length) * 100);
}

/** Median days between a loan opening and being repaid. */
function computeMedianDays(details) {
  const spans = details
    .filter((d) => typeof d.daysToRepay === "number")
    .map((d) => d.daysToRepay)
    .sort((a, b) => a - b);
  if (spans.length === 0) return null;
  const mid = Math.floor(spans.length / 2);
  return spans.length % 2 ? spans[mid] : Math.round((spans[mid - 1] + spans[mid]) / 2);
}

export default function PortfolioTab({ setTab, onPositions, compact = false }) {
  const wallet = useWallet();
  const { chainId, signer } = useBuilderCredit();
  const [loading, setLoading] = useState(true);
  const [backedDetails, setBackedDetails] = useState([]);
  const [repaymentRate, setRepaymentRate] = useState(null);
  const [medianDaysToRepay, setMedianDaysToRepay] = useState(null);

  useEffect(() => {
    let cancelled = false;
    
    async function load() {
      if (!wallet.account || !signer || typeof chainId !== 'number') {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        if (!cancelled) setLoading(true);
        // Loan positions come from LiquidityRail (WS2 wires the service).
        // Until the rail is deployed on this network there are no positions to
        // show, so return empty rather than reading a contract that is being
        // retired.
        const details = [];
        if (!cancelled) {
          setBackedDetails(details);
          setRepaymentRate(computeRepaymentRate(details));
          setMedianDaysToRepay(computeMedianDays(details));
          // Report up for the tab badge + adaptive landing on /back:
          // total positions and how many have a ready-to-claim return.
          const readyCount = details.filter(
            (d) => !d.claimed && d.milestonesCount > 0 && d.milestonesCompleted >= d.milestonesCount
          ).length;
          if (typeof onPositions === "function") onPositions(details.length, readyCount);
        }
      } catch (err) { /* portfolio load failed */ }
      finally { if (!cancelled) setLoading(false); }
    }
    
    load();
    return () => { cancelled = true; };
  }, [wallet.account, signer, chainId, onPositions]);

  // Attention state: milestones done but return not claimed = money on the
  // table. Drives the badge deep-link + per-card highlight.
  const maturedUnclaimed = backedDetails.filter(
    (p) => !p.claimed && p.milestonesCount > 0 && p.milestonesCompleted >= p.milestonesCount
  );

  // Deep-link focus: /back?tab=portfolio&focus=claim highlights the first
  // matured-unclaimed position.
  useEffect(() => {
    if (!maturedUnclaimed.length) return;
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    if (params?.get("focus") !== "claim") return;
    const el = document.getElementById("position-claim-attention");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-amber-400", "ring-offset-2", "rounded-xl");
    const timer = setTimeout(() => {
      el.classList.remove("ring-2", "ring-amber-400", "ring-offset-2", "rounded-xl");
    }, 2400);
    return () => {
      clearTimeout(timer);
      el.classList.remove("ring-2", "ring-amber-400", "ring-offset-2", "rounded-xl");
    };
  }, [maturedUnclaimed.length]);

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;

  if (!wallet.account) {
    return (
      <Card className="p-8 text-center">
        <ShieldCheckIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Connect Wallet</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Connect your wallet to view your backed positions.</p>
      </Card>
    );
  }

  if (backedDetails.length === 0) {
    return (
      <Card className="p-8 text-center">
        <RocketLaunchIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No Positions Yet</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You haven&apos;t backed any projects yet.</p>
        <Button onClick={() => setTab('discover')} variant="primary" className="mt-4">
          Discover Projects to Back
        </Button>
      </Card>
    );
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${compact ? "gap-3" : "gap-4"}`}>
        <Card className={compact ? "p-4 bg-indigo-50 border-indigo-100" : "p-5 bg-indigo-50 border-indigo-100"}>
          <div className="flex items-center gap-3">
            <ShieldCheckIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <div>
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">Repaid</p>
              <p className="text-2xl font-black text-indigo-900">
                {repaymentRate === null ? "—" : `${repaymentRate}%`}
              </p>
              <p className="text-xs font-bold text-indigo-500">of loans settled</p>
            </div>
          </div>
        </Card>
        <Card className={compact ? "p-4" : "p-5"}>
          <BanknotesIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-1" />
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Principal at risk</p>
          <p className="text-xl font-bold">${backedDetails.reduce((s, p) => s + parseFloat(p.myStake), 0).toFixed(2)}</p>
        </Card>
        <Card className={compact ? "p-4" : "p-5"}>
          <TrophyIcon className="w-5 h-5 text-green-600 dark:text-green-400 mb-1" />
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Median days to repay</p>
          <p className="text-xl font-bold">{medianDaysToRepay === null ? "—" : `${medianDaysToRepay}d`}</p>
        </Card>
        <Card className={compact ? "p-4" : "p-5"}>
          <RocketLaunchIcon className="w-5 h-5 text-purple-600 dark:text-purple-400 mb-1" />
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Open positions</p>
          <p className="text-xl font-bold">{backedDetails.length}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {backedDetails.map((project) => {
          const progress = (project.milestonesCompleted / project.milestonesCount) * 100;
          const needsClaim = !project.claimed && project.milestonesCount > 0 && project.milestonesCompleted >= project.milestonesCount;
          const isFirstAttention = needsClaim && maturedUnclaimed[0]?.id === project.id;
          return (
            <Card
              key={project.id}
              id={isFirstAttention ? "position-claim-attention" : undefined}
              className={`border-l-4 hover:shadow-md transition-shadow ${
                needsClaim
                  ? "border-l-amber-500 bg-amber-50/50 dark:bg-amber-900/10"
                  : "border-l-indigo-500"
              }`}
            >
              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100">{project.name}</h3>
                    <div className="text-xs text-gray-500 dark:text-gray-400 max-w-[220px]">
                      {isValidSolanaAddress(project.developer) ? (
                        <SnsIdentityBadge
                          address={project.developer}
                          snsNameOverride={project.builderSnsDomain || null}
                          chainFamily="solana"
                          showFallback={true}
                          showLoading={true}
                          className="text-xs"
                        />
                      ) : (
                        <p className="font-mono truncate max-w-[180px]">{project.developer}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${project.isActive ? "bg-green-100 text-green-800 dark:text-green-300" : "bg-gray-100 text-gray-800 dark:text-gray-200"}`}>
                    {project.isActive ? "Active" : "Done"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">Principal</p>
                    <p className="text-lg font-bold text-blue-900 dark:text-blue-200">${project.myStake}</p>
                  </div>
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase">Repaid from</p>
                    <p className="text-lg font-bold text-indigo-900">Prize payout</p>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>{project.milestonesCompleted}/{project.milestonesCount}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span className={`font-medium ${project.claimed ? "text-green-600 dark:text-green-400" : needsClaim ? "text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"}`}>
                    {project.claimed ? "✓ Repaid" : needsClaim ? "★ Payout recorded — settle" : "Pending payout"}
                  </span>
                  {project.status ? (
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">{project.status}</span>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
