import React, { useState, useEffect, useCallback } from "react";
import { formatUnits } from 'viem';
import { useWallet } from "@/stores/walletStore";
import { useBuilderCredit } from "@/stores/walletStore";
import { calculateCompassScore, getCompassTier } from "@/utils/compassScore";
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
  ReceiptPercentIcon,
} from "@heroicons/react/24/outline";

export default function PortfolioTab({ setTab, onPositions, compact = false }) {
  const wallet = useWallet();
  const { chainId, signer } = useBuilderCredit();
  const [loading, setLoading] = useState(true);
  const [backedDetails, setBackedDetails] = useState([]);
  const [compassScore, setCompassScore] = useState(400);

  // Bags fee claiming state
  const [claimableFees, setClaimableFees] = useState([]);
  const [claimableTotal, setClaimableTotal] = useState(0);
  const [claimingFees, setClaimingFees] = useState(false);
  const [claimError, setClaimError] = useState(null);
  const [claimSuccess, setClaimSuccess] = useState(null);

  useEffect(() => {
    let cancelled = false;
    
    async function load() {
      if (!wallet.account || !signer || typeof chainId !== 'number') {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        if (!cancelled) setLoading(true);
        const { creditService } = await import('@/services/creditService');
        const contracts = creditService.getContracts(chainId, signer);
        const projectIds = contracts ? await contracts.core.read.getBackerProjects([wallet.account]) : [];
        if (cancelled) return;
        
        if (!projectIds || projectIds.length === 0) {
          setBackedDetails([]);
          setCompassScore(400);
          setLoading(false);
          return;
        }
        
        if (!contracts || cancelled) {
          if (!cancelled) setLoading(false);
          return;
        }
        
        const details = [];
        const roiHistory = [];
        for (const id of projectIds) {
          if (cancelled) return;
          try {
            const project = await contracts.core.projects(id);
            const backings = [];
            let idx = 0;
            try {
              while (true) {
                const b = await contracts.core.projectBackings(id, idx);
                backings.push(b);
                idx++;
              }
            } catch (e) { /* end of array */ }

            const myBacking = backings.find(
              (b) => b.backer.toLowerCase() === wallet.account?.toLowerCase()
            );
            const stakeAmount = myBacking
              ? parseFloat(formatUnits(myBacking.amount, 6))
              : 0;
            const multiplier = myBacking
              ? myBacking.multiplier.toNumber() / 100
              : 0;

            const detail = {
              id: id.toString(),
              name: project.name,
              developer: project.developer,
              isActive: project.isActive,
              milestonesCompleted: project.milestonesCompleted.toNumber(),
              milestonesCount: project.milestonesCount.toNumber(),
              fundingAmount: formatUnits(project.fundingAmount, 6),
              myStake: stakeAmount.toFixed(2),
              myMultiplier: multiplier.toFixed(1),
              potentialReturn: (stakeAmount * multiplier).toFixed(2),
              claimed: myBacking?.claimed || false,
            };
            details.push(detail);
            if (!project.isActive && stakeAmount > 0) {
              roiHistory.push({ projectId: detail.id, amountStaked: stakeAmount, amountReturned: parseFloat(detail.potentialReturn), timestamp: new Date().toISOString() });
            }
          } catch (err) { /* skip failed project */ }
        }
        
        if (!cancelled) {
          setBackedDetails(details);
          setCompassScore(calculateCompassScore(roiHistory));
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

  // Fetch claimable Bags fees for Solana wallets
  useEffect(() => {
    if (!wallet.solanaAddress || !wallet.solanaConnected) {
      setClaimableFees([]);
      setClaimableTotal(0);
      return;
    }

    let cancelled = false;

    async function loadFees() {
      try {
        const { PublicKey } = await import('@solana/web3.js');
        const { solanaCreditService } = await import('@/services/SolanaCreditService');
        const pubkey = new PublicKey(wallet.solanaAddress);
        const positions = await solanaCreditService.getClaimableFees(pubkey);
        if (!cancelled) {
          setClaimableFees(positions || []);
          const total = (positions || []).reduce((sum, p) => {
            return sum + (parseFloat(p.claimableAmount || p.amount || 0));
          }, 0);
          setClaimableTotal(total);
        }
      } catch (err) {
        console.warn('Failed to load claimable Bags fees:', err);
        if (!cancelled) setClaimableTotal(0);
      }
    }

    loadFees();
    return () => { cancelled = true; };
  }, [wallet.solanaAddress, wallet.solanaConnected]);

  const handleClaimFees = useCallback(async () => {
    if (!wallet.solanaWallet || claimableFees.length === 0) return;
    setClaimingFees(true);
    setClaimError(null);
    setClaimSuccess(null);

    try {
      const { solanaCreditService } = await import('@/services/SolanaCreditService');
      const { getSolanaConnection } = await import('@/lib/chains/solanaConnection');
      const txs = await solanaCreditService.claimFees(wallet.solanaWallet, claimableFees);
      // Send the signed transactions
      const connection = getSolanaConnection();
      for (const tx of txs) {
        await connection.sendRawTransaction(tx.serialize());
      }
      setClaimSuccess(`Claimed fees from ${claimableFees.length} position(s)`);
      setClaimableFees([]);
      setClaimableTotal(0);
    } catch (err) {
      setClaimError(err.message || 'Failed to claim fees');
    } finally {
      setClaimingFees(false);
    }
  }, [wallet.solanaWallet, claimableFees]);

  const compassTier = getCompassTier(compassScore);

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
            <span className="text-2xl">{compassTier.icon}</span>
            <div>
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">Compass Score</p>
              <p className="text-2xl font-black text-indigo-900">{compassScore}</p>
              <p className={`text-xs font-bold ${compassTier.color}`}>{compassTier.name}</p>
            </div>
          </div>
        </Card>
        <Card className={compact ? "p-4" : "p-5"}>
          <BanknotesIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-1" />
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Total Staked</p>
          <p className="text-xl font-bold">${backedDetails.reduce((s, p) => s + parseFloat(p.myStake), 0).toFixed(2)}</p>
        </Card>
        <Card className={compact ? "p-4" : "p-5"}>
          <TrophyIcon className="w-5 h-5 text-green-600 dark:text-green-400 mb-1" />
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Potential Returns</p>
          <p className="text-xl font-bold">${backedDetails.reduce((s, p) => s + parseFloat(p.potentialReturn), 0).toFixed(2)}</p>
        </Card>
        <Card className={compact ? "p-4" : "p-5"}>
          <RocketLaunchIcon className="w-5 h-5 text-purple-600 dark:text-purple-400 mb-1" />
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Active Stakes</p>
          <p className="text-xl font-bold">{backedDetails.length}</p>
        </Card>

        {/* Bags fee yield — only visible for Solana wallets */}
        {wallet.solanaConnected && (
          <Card className={`p-5 ${claimableTotal > 0 ? 'bg-amber-50 border-amber-200' : ''}`}>
            <div className="flex items-center justify-between mb-1">
              <ReceiptPercentIcon className={`w-5 h-5 ${claimableTotal > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`} />
              {claimingFees && <LoadingSpinner size="sm" />}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Claimable Fees</p>
            <p className={`text-xl font-bold ${claimableTotal > 0 ? 'text-amber-700' : 'text-gray-400 dark:text-gray-500'}`}>
              {claimableTotal > 0 ? `${claimableTotal.toFixed(4)} SOL` : '—'}
            </p>
            {claimableTotal > 0 && (
              <Button
                onClick={handleClaimFees}
                disabled={claimingFees}
                size="sm"
                className="mt-2 w-full bg-amber-600 hover:bg-amber-700 text-white text-xs"
              >
                {claimingFees ? 'Claiming...' : 'Claim All'}
              </Button>
            )}
            {claimError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{claimError}</p>}
            {claimSuccess && <p className="text-xs text-green-600 dark:text-green-400 mt-1">{claimSuccess}</p>}
          </Card>
        )}
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
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">Stake</p>
                    <p className="text-lg font-bold text-blue-900 dark:text-blue-200">${project.myStake}</p>
                  </div>
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase">Return (est.)</p>
                    <p className="text-lg font-bold text-indigo-900">${project.potentialReturn}</p>
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
                    {project.claimed ? "✓ Claimed" : needsClaim ? "★ Return ready to claim" : "Pending"}
                  </span>
                  <span className="font-medium text-indigo-600 dark:text-indigo-400">{project.myMultiplier}x</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
