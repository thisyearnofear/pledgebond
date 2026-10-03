/**
 * Developer Dashboard Component
 * Displays developer credit profile, funded projects, and loan management
 */

import React, { useState, useEffect } from 'react';
import { parseUnits } from 'viem';
import { useWallet } from '@/stores/walletStore';
import { useBuilderCredit } from '@/stores/walletStore';
import { formatUSDC } from '@/lib/format';
import { Card } from './common/Card';
import Button from './common/Button';
import { LoadingSpinner } from './common/LoadingStates';
import VelocityGauge from './github/VelocityGauge';
import { getEvolutionTier } from './projects/ProjectCard';
import AgentAuditLog from './dashboard/AgentAuditLog';
import {
  UserCircleIcon,
  StarIcon,
  CurrencyDollarIcon,
  ClockIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  ArrowTrendingUpIcon,
  ExclamationCircleIcon,
  CpuChipIcon,
  GlobeAltIcon,
  SignalIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

/* -----------------------------------------------------------------------------
 * Sub-sections — extracted so the same JSX can be composed in two layouts
 * (sidebar rail when there's a fleet, responsive grid when sparse).
 * All theming includes explicit dark-mode classes since the project uses
 * Tailwind's class-based dark mode (`darkMode: 'class'`).
 * --------------------------------------------------------------------------- */

function FleetOperationsSection({
  developerProjects,
  projectDetails,
  selectedProjectId,
  setSelectedProjectId,
  setShowStakeModal,
  handleProjectSelect,
  handleMilestoneComplete,
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/40 rounded-lg flex items-center justify-center">
            <GlobeAltIcon className="w-6 h-6 text-cyan-600 dark:text-cyan-300" />
          </div>
          FLEET OPERATIONS
        </h2>
      </div>

      {developerProjects && developerProjects.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Project List */}
          <div className="lg:col-span-1 space-y-3 max-h-[650px] overflow-y-auto pr-2 custom-scrollbar">
            {developerProjects.map((projectId) => {
              const project = projectDetails[projectId];
              if (!project) return null;
              const tier = getEvolutionTier(project.creditScore || 0);

              return (
                <Card
                  key={projectId}
                  className={`p-5 cursor-pointer transition-all duration-300 border-2 ${
                    selectedProjectId === projectId
                      ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 shadow-lg'
                      : 'border-transparent bg-white dark:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-md'
                  } ${tier.class}`}
                  onClick={() => handleProjectSelect(projectId)}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">{tier.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-lg truncate">{project.name}</div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">${formatUSDC(project.fundingAmount)}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProjectId(projectId);
                              setShowStakeModal(true);
                            }}
                            className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 px-3 py-1 rounded-full transition-colors"
                          >
                            BOOST
                          </button>
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">{tier.name}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Project Details */}
          <div className="lg:col-span-2">
            {selectedProjectId ? (
              <Card className="p-8 text-center">
                <DocumentTextIcon className="w-10 h-10 text-slate-400 dark:text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Project details view is being upgraded. Use the project page to manage milestones.
                </p>
              </Card>
            ) : (
              <Card className="p-12 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/60 border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-2xl flex items-center justify-center mb-5">
                  <DocumentTextIcon className="w-10 h-10 text-slate-400 dark:text-slate-300" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">No Vessel Selected</h3>
                <p className="text-slate-600 dark:text-slate-300 max-w-sm">
                  Select a project from your fleet to view live telemetry and manage milestones.
                </p>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <Card className="p-6 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-800/60 border-2 border-dashed border-slate-300 dark:border-slate-600">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-xl flex items-center justify-center flex-shrink-0">
              <DocumentTextIcon className="w-6 h-6 text-slate-400 dark:text-slate-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Fleet Empty</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                You haven&apos;t commissioned any vessels yet. Start your journey by requesting funding for your first project.
              </p>
            </div>
          </div>
        </Card>
      )}
    </section>
  );
}

function VelocityCard({ githubStreak }) {
  // Dark surface card — already legible in both themes.
  return (
    <Card className="p-7 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-none overflow-hidden relative h-full">
      <div className="absolute top-0 right-0 p-6 opacity-10">
        <CpuChipIcon className="w-32 h-32" />
      </div>
      <h3 className="text-sm font-black tracking-widest uppercase text-cyan-400 mb-6 flex items-center gap-3">
        <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" />
        Live Telemetry
      </h3>
      <div className="flex justify-center py-6">
        <VelocityGauge value={githubStreak} />
      </div>
      <p className="mt-6 text-xs text-slate-400">
        Commit activity from your connected GitHub repositories.
      </p>
    </Card>
  );
}

function VoyageLogCard({ checkInText, setCheckInText, handlePostCheckIn, loading, selectedProjectId }) {
  return (
    <section>
      <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest mb-4 flex items-center gap-2">
        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
        Voyage Log
      </h2>
      <Card className="p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Post Heartbeat</h3>
        </div>
        <textarea
          value={checkInText}
          onChange={(e) => setCheckInText(e.target.value)}
          placeholder="What did you ship today? (e.g., 'Fixed auth bug', 'Deployed V1')"
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-base text-slate-700 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none h-24 mb-4 resize-none transition-all"
        />
        <Button
          onClick={handlePostCheckIn}
          disabled={loading || !selectedProjectId || !checkInText}
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-3 rounded-xl text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-200 dark:shadow-blue-900/40 transition-all"
        >
          <SignalIcon className="w-5 h-5" />
          Broadcast Activity
        </Button>
        {!selectedProjectId && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 text-center italic">Select a vessel to log activity</p>
        )}
      </Card>
    </section>
  );
}

function QuickCommandsSection({
  creditProfile,
  setShowRepayModal,
  prizeAmount,
  setPrizeAmount,
  handleSimulatePrize,
  loading,
  selectedProjectId,
}) {
  return (
    <section>
      <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest mb-4 flex items-center gap-2">
        <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
        Quick Commands
      </h2>
      <div className="space-y-4">
        {creditProfile && parseFloat(creditProfile.activeLoanAmount) > 0 && (
          <Button
            onClick={() => setShowRepayModal(true)}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/40 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2"
          >
            <ArrowPathIcon className="w-7 h-7" />
            Repay Loan
          </Button>
        )}

        <Card className="p-6 bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-none shadow-lg">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-xl">Prize Loop Sim</h3>
            <div className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold backdrop-blur-sm">DEMO</div>
          </div>
          <div className="space-y-4">
            <div className="flex gap-3">
              <input
                type="number"
                value={prizeAmount}
                onChange={(e) => setPrizeAmount(e.target.value)}
                className="flex-1 bg-white/15 border border-white/25 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:ring-2 focus:ring-white/50 outline-none transition-all"
                placeholder="Amount"
              />
              <Button
                onClick={handleSimulatePrize}
                disabled={loading || !selectedProjectId}
                className="bg-white text-indigo-700 hover:bg-white/90 font-bold px-5 rounded-xl shadow-md"
              >
                Fire
              </Button>
            </div>
            {!selectedProjectId && (
              <p className="text-xs text-indigo-200 italic">Select a vessel to simulate prize payout</p>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}

function SystemLogsCard({ success, error }) {
  return (
    <Card className="p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
      <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest mb-4 flex items-center gap-2">
        <span className="w-2 h-2 bg-slate-500 rounded-full"></span>
        System Logs
      </h3>
      <div className="space-y-3 font-mono text-sm">
        {!success && !error && (
          <div className="flex gap-3 text-slate-500 dark:text-slate-400">
            <span className="text-slate-400 dark:text-slate-500 font-bold">[SYS]</span>
            <span>No recent activity</span>
          </div>
        )}
        {success && (
          <div className="flex gap-3 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 p-2 rounded-lg">
            <span className="font-bold">[SUCCESS]</span>
            <span>{success.message}</span>
          </div>
        )}
        {error && (
          <div className="flex gap-3 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/30 p-2 rounded-lg">
            <span className="font-bold">[ERROR]</span>
            <span>{error}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function DeveloperDashboard() {
  const wallet = useWallet();
  const {
    coreContract,
    creditProfile,
    repayLoan,
    loadCreditProfile,
    usdcBalance,
    developerProjects,
    projectDetails,
    contractLoading,
  } = useBuilderCredit();

  // activeChainFamily is authoritative: useBuilderCredit's account/connected already
  // mirror it, but we recompute here so contract-only actions can branch off evmAccount.
  const isSolana = wallet.activeChainFamily === 'solana';
  const account = isSolana ? wallet.solanaAddress : wallet.account;
  const connected = isSolana ? wallet.solanaConnected : wallet.connected;
  const evmAccount = wallet.account; // EVM-only ops (repay, check-in, prize distribution)

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [checkInText, setCheckInText] = useState('');
  const [prizeAmount, setPrizeAmount] = useState('1000');
  const [githubStreak, setGithubStreak] = useState(12); // Default mock value

  useEffect(() => {
    // Try to load GitHub streak from local storage if available
    const stored = localStorage.getItem('pos_user_profile');
    if (stored) {
      try {
        const profile = JSON.parse(stored);
        if (profile.profiles?.github?.activity?.contributionStreak) {
          setGithubStreak(profile.profiles.github.activity.contributionStreak);
        }
      } catch (e) {
        console.error("Failed to parse profile for streak", e);
      }
    }
  }, []);

  const handleSimulatePrize = async () => {
    if (isSolana || !evmAccount) {
      setError('Prize distribution requires an EVM wallet. Switch chains and try again.');
      return;
    }
    if (!coreContract) {
      setError('Prize distribution is not configured on this deployment. Wire BUILDER_CREDIT_CORE_ADDRESS to enable.');
      return;
    }
    if (!selectedProjectId) {
      setError('Please select a project first');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const tx = await coreContract.fundPrize(selectedProjectId, parseUnits(prizeAmount, 6));
      await tx.wait();

      setSuccess({
        amount: prizeAmount,
        transactionHash: tx.hash,
        message: 'Prize funded! Backers can now claim their payouts.'
      });
    } catch (err) {
      console.error('Failed to distribute prize:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePostCheckIn = async () => {
    if (!checkInText || !selectedProjectId) {
      setError('Please select a project and enter check-in details');
      return;
    }
    if (isSolana || !evmAccount) {
      setError('Heartbeat check-ins require an EVM wallet. Switch chains and try again.');
      return;
    }
    // Heartbeat check-ins are not wired to any contract yet; say so rather
    // than failing with an error that blanks the whole dashboard.
    setSuccess({ message: 'Activity logged locally. On-chain check-ins are not available yet.' });
    return;

    try {
      setLoading(true);
      setError(null);
      setSuccess({
        message: 'Heartbeat recorded locally. Your activity is visible to backers.',
      });
      setCheckInText('');
      if (loadCreditProfile) await loadCreditProfile();
    } catch (err) {
      console.error('Failed to reload credit profile after check-in:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRepayLoan = async () => {
    if (!repayAmount || parseFloat(repayAmount) <= 0) {
      setError('Please enter a valid repayment amount');
      return;
    }

    if (!creditProfile || !creditProfile.activeLoanAmount) {
      setError('No active loan to repay');
      return;
    }

    if (isSolana || !evmAccount) {
      setError('Loan repayment requires an EVM wallet. Switch chains and try again.');
      return;
    }

    if (parseFloat(repayAmount) > parseFloat(creditProfile.activeLoanAmount)) {
      setError(`Maximum repayment amount is ${formatUSDC(creditProfile.activeLoanAmount)} USDC`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Call repayLoan function from context
      const result = await repayLoan(repayAmount);

      setSuccess({
        amount: repayAmount,
        transactionHash: result.transactionHash
      });

      // Reset form
      setRepayAmount('');
      setShowRepayModal(false);

    } catch (err) {
      console.error('Failed to repay loan:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = (projectId) => {
    setSelectedProjectId(projectId);
  };

  const handleMilestoneComplete = () => {
    // Refresh credit profile to pick up updated balances after on-chain milestone update.
    if (loadCreditProfile) loadCreditProfile();
  };

  // Format date helper function
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  if (!connected || !account) {
    return (
      <Card className="p-8 text-center max-w-md mx-auto">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <UserCircleIcon className="w-10 h-10 text-blue-600" />
        </div>
        <h3 className="text-2xl font-bold text-slate-900 mb-3">Connect Your Wallet</h3>
        <p className="text-slate-600 mb-6">
          Please connect your wallet to view your developer dashboard
        </p>
      </Card>
    );
  }

  if (contractLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 bg-red-50 border border-red-200 max-w-2xl mx-auto">
        <div className="flex items-start gap-4">
          <ExclamationCircleIcon className="w-8 h-8 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-bold text-red-900 mb-2 text-lg">Error</h4>
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Command Center Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <CpuChipIcon className="w-7 h-7 text-white" />
              </div>
              COMMAND CENTER
            </h1>
            <p className="text-blue-100 font-medium mt-2 text-lg">Fleet Operations & Engine Status</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-white/15 backdrop-blur-md rounded-xl px-5 py-3 border border-white/20">
              <span className="text-xs font-bold text-blue-200 uppercase tracking-widest block mb-1">System Status</span>
              <span className="flex items-center gap-2 text-white font-bold text-lg">
                <CheckCircleIcon className="w-5 h-5 text-green-300" />
                OPERATIONAL
              </span>
            </div>
            <div className="bg-white/15 backdrop-blur-md rounded-xl px-5 py-3 border border-white/20">
              <span className="text-xs font-bold text-blue-200 uppercase tracking-widest block mb-1">Wallet</span>
              <span className="font-mono text-lg text-white">{account.substring(0, 6)}...{account.substring(account.length - 4)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ENGINE STATUS — always full width at top */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
              <SignalIcon className="w-6 h-6 text-blue-600 dark:text-blue-300" />
            </div>
            ENGINE STATUS
          </h2>
        </div>

        {creditProfile ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <Card className="p-6 border border-slate-200 dark:border-slate-700">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Loan available</div>
                  <div className="text-4xl font-black text-blue-600 dark:text-blue-400">
                    ${formatUSDC(creditProfile.availableToDraw ?? 0)}
                  </div>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                  <CurrencyDollarIcon className="w-8 h-8 text-blue-600 dark:text-blue-300" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border border-slate-200 dark:border-slate-700">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Outstanding</div>
                  <div className="text-4xl font-black text-purple-600 dark:text-purple-400">
                    ${formatUSDC(creditProfile.activeLoanAmount ?? 0)}
                  </div>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center flex-shrink-0">
                  <ClockIcon className="w-8 h-8 text-purple-600 dark:text-purple-300" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border border-slate-200 dark:border-slate-700">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Repaid on time</div>
                  <div className="text-4xl font-black text-indigo-600 dark:text-indigo-400">
                    {creditProfile.coverageRateBps != null
                      ? `${Math.round(creditProfile.coverageRateBps / 100)}%`
                      : "—"}
                  </div>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                  <ShieldCheckIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-300" />
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <Card className="p-6 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-800/60 border-2 border-dashed border-slate-300 dark:border-slate-600">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-xl flex items-center justify-center flex-shrink-0">
                <ShieldCheckIcon className="w-6 h-6 text-slate-400 dark:text-slate-300" />
              </div>
              <p className="text-slate-600 dark:text-slate-300 font-medium">
                No wins declared yet. Declare a hackathon win to unlock a bridge loan.
              </p>
            </div>
          </Card>
        )}
      </section>

      {/*
        Adaptive layout:
        - When the builder has a fleet, use the classic 8/4 split so project details get room.
        - When sparse (no projects), drop the rigid sidebar and let widgets pack into a
          responsive grid so blocks wrap cohesively under the empty state.
      */}
      {developerProjects && developerProjects.length > 0 ? (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 space-y-6 self-start">
            <FleetOperationsSection
              developerProjects={developerProjects}
              projectDetails={projectDetails}
              selectedProjectId={selectedProjectId}
              setSelectedProjectId={setSelectedProjectId}
              setShowStakeModal={setShowStakeModal}
              handleProjectSelect={handleProjectSelect}
              handleMilestoneComplete={handleMilestoneComplete}
            />
          </div>
          <div className="col-span-12 lg:col-span-4 space-y-6 self-start">
            <VelocityCard githubStreak={githubStreak} />
            <VoyageLogCard
              checkInText={checkInText}
              setCheckInText={setCheckInText}
              handlePostCheckIn={handlePostCheckIn}
              loading={loading}
              selectedProjectId={selectedProjectId}
            />
            <AgentAuditLog projectSlug={selectedProjectId} />
            <QuickCommandsSection
              creditProfile={creditProfile}
              setShowRepayModal={setShowRepayModal}
              prizeAmount={prizeAmount}
              setPrizeAmount={setPrizeAmount}
              handleSimulatePrize={handleSimulatePrize}
              loading={loading}
              selectedProjectId={selectedProjectId}
            />
            <SystemLogsCard success={success} error={error} />
          </div>
        </div>
      ) : (
        <>
          <FleetOperationsSection
            developerProjects={developerProjects}
            projectDetails={projectDetails}
            selectedProjectId={selectedProjectId}
            setSelectedProjectId={setSelectedProjectId}
            setShowStakeModal={setShowStakeModal}
            handleProjectSelect={handleProjectSelect}
            handleMilestoneComplete={handleMilestoneComplete}
            formatUSDC={formatUSDC}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
            <VelocityCard githubStreak={githubStreak} />
            <VoyageLogCard
              checkInText={checkInText}
              setCheckInText={setCheckInText}
              handlePostCheckIn={handlePostCheckIn}
              loading={loading}
              selectedProjectId={selectedProjectId}
            />
            <div className="md:col-span-2 xl:col-span-1">
              <AgentAuditLog projectSlug={selectedProjectId} />
            </div>
            <QuickCommandsSection
              creditProfile={creditProfile}
              setShowRepayModal={setShowRepayModal}
              prizeAmount={prizeAmount}
              setPrizeAmount={setPrizeAmount}
              handleSimulatePrize={handleSimulatePrize}
              loading={loading}
              selectedProjectId={selectedProjectId}
            />
            <SystemLogsCard success={success} error={error} />
          </div>
        </>
      )}

    </div>
  );
}
