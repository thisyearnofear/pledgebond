/**
 * Nanopayment Dashboard Widget
 * 
 * Mobile-responsive component showing:
 * - Gateway balance (available/locked)
 * - All AI agent services with pricing
 * - Clear demo/live setup states
 * - Transaction history
 */

import React, { useState, useEffect } from "react";
import { useNanopayment } from "@/stores/walletStore";
import Button from "@/components/common/Button";
import { LoadingSpinner } from "@/components/common/LoadingStates";
import {
  CurrencyDollarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  RocketLaunchIcon,
  CogIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";

const CURRENCY_SYMBOL = "$";

function formatUSDC(amount) {
  if (!amount) return `${CURRENCY_SYMBOL}0.00`;
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${CURRENCY_SYMBOL}0.00`;
  return `${CURRENCY_SYMBOL}${num.toFixed(2)}`;
}

const AGENT_SERVICES = [
  {
    id: "underwrite",
    name: "Underwriter Agent",
    description: "Score a project and get actionable analysis",
    price: 0.05,
    icon: "🤖",
  },
  {
    id: "scout",
    name: "Scout Agent",
    description: "Scan projects and shortlist where to look first",
    price: 0.01,
    icon: "🔭",
  },
  {
    id: "verify",
    name: "Verifier Agent",
    description: "Review code and report verification availability",
    price: 0.001,
    icon: "✅",
  },
  {
    id: "rebalance",
    name: "Rebalance Agent",
    description: "Portfolio automation and strategy support",
    price: 0.01,
    icon: "⚖️",
  },
];

export default function NanopaymentWidget({ compact = false, onPaymentComplete }) {
  const {
    isInitialized,
    nanopaymentDemoMode,
    setNanopaymentDemoMode,
    loading,
    error,
    balance,
    walletAddress,
    transactions,
    agentPrices,
    initializeWithDemo,
    deposit,
    payForAgent,
  } = useNanopayment();

  const [expanded, setExpanded] = useState(!compact);
  const [activeTab, setActiveTab] = useState("services");
  const [pendingService, setPendingService] = useState(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState("1");
  const [lastResult, setLastResult] = useState(null);
  const [resultMessage, setResultMessage] = useState(null);

  useEffect(() => {
    // No longer auto-initialize in test mode. Users must explicitly opt in.
  }, []);

  if (!isInitialized) {
    return <UninitializedWidget onInitialize={initializeWithDemo} />;
  }

  const handleServiceClick = async (service) => {
    if (!isInitialized) {
      await initializeWithDemo();
    }

    setPendingService(service.id);
    setLastResult(null);
    setResultMessage(null);
    try {
      const result = await payForAgent(service.id);
      if (result.success) {
        setLastResult(result.data);
        setResultMessage({
          tone: result.data?.status === "ok" ? "success" : "warning",
          title: result.data?.nextAction || `${service.name} finished running.`,
          detail: `Result source: ${result.data?.resultSource || 'unknown'} · Payment: ${result.data?.agentInfo?.paymentStatus || (result.demoMode ? 'demo' : 'unknown')}`,
        });
        onPaymentComplete?.(result);
      } else {
        setResultMessage({
          tone: "error",
          title: result.error || result.data?.error || `${service.name} could not complete.`,
          detail: result.data?.details || "Check your setup and try again.",
        });
      }
    } catch (err) {
      console.error("Payment failed:", err);
      setResultMessage({
        tone: "error",
        title: `${service.name} could not complete.`,
        detail: err.message || "Check your setup and try again.",
      });
    } finally {
      setPendingService(null);
    }
  };

  const handleDeposit = async () => {
    try {
      await deposit(parseFloat(depositAmount));
      setShowDeposit(false);
      setDepositAmount("1");
      setResultMessage({
        tone: "success",
        title: "Wallet funded successfully.",
        detail: `Available balance: ${formatUSDC(balance.available)}`,
      });
    } catch (err) {
      console.error("Deposit failed:", err);
      setResultMessage({
        tone: "error",
        title: "Deposit failed.",
        detail: err.message || "Try again after checking your wallet connection.",
      });
    }
  };

  if (!isInitialized) {
    return <UninitializedWidget onInitialize={initializeWithDemo} />;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div 
        className="px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RocketLaunchIcon className="w-5 h-5 text-white" />
            <div>
              <h3 className="font-bold text-white">AI analysis wallet</h3>
              <p className="text-[11px] text-indigo-100">
                {nanopaymentDemoMode ? "Test mode" : "Live mode"} · {formatUSDC(balance.available)} available
              </p>
            </div>
          </div>
          {expanded ? (
            <ChevronUpIcon className="w-5 h-5 text-white" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-white" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CogIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {nanopaymentDemoMode ? "Test mode" : "Live mode"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {nanopaymentDemoMode
                      ? "Payments skipped. Responses marked as test mode."
                      : "Use real USDC for live payments."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNanopaymentDemoMode(!nanopaymentDemoMode)}
                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                  nanopaymentDemoMode ? "bg-indigo-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    nanopaymentDemoMode ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="flex border-b border-gray-200">
            <TabButton active={activeTab === "services"} onClick={() => setActiveTab("services")}>Run agent</TabButton>
            <TabButton active={activeTab === "activity"} onClick={() => setActiveTab("activity")}>Activity</TabButton>
            <TabButton active={activeTab === "wallet"} onClick={() => setActiveTab("wallet")}>Wallet</TabButton>
          </div>

          {resultMessage && (
            <div className={`rounded-lg border px-3 py-2 text-sm ${
              resultMessage.tone === 'success'
                ? 'border-green-200 bg-green-50 text-green-800 dark:text-green-300'
                : resultMessage.tone === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-red-200 bg-red-50 text-red-800'
            }`}>
              <p className="font-medium">{resultMessage.title}</p>
              {resultMessage.detail && <p className="text-xs mt-1 opacity-80">{resultMessage.detail}</p>}
            </div>
          )}

          {activeTab === "services" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {AGENT_SERVICES.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    loading={pendingService === service.id}
                    onClick={() => handleServiceClick(service)}
                    disabled={loading}
                    price={agentPrices?.[service.id] || service.price}
                  />
                ))}
              </div>

              {lastResult?.strategicAdvice && (
                <StrategicAdvisorPanel 
                  advice={lastResult.strategicAdvice} 
                  onDismiss={() => setLastResult(null)}
                />
              )}
            </div>
          )}

          {activeTab === "activity" && (
            <div className="space-y-2">
              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <CurrencyDollarIcon className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-500 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No activity yet</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Run an agent and its payment state will appear here</p>
                </div>
              ) : (
                transactions.slice(0, 10).map((tx) => (
                  <TransactionRow key={tx.id} transaction={tx} />
                ))
              )}
            </div>
          )}

          {activeTab === "wallet" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <WalletCard label="Available" amount={balance.available} color="green" />
                <WalletCard label="Locked" amount={balance.locked} color="gray" />
              </div>

              {walletAddress && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Wallet</p>
                  <p className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </p>
                </div>
              )}

              {!nanopaymentDemoMode && (
                !showDeposit ? (
                  <Button 
                    variant="secondary" 
                    className="w-full"
                    onClick={() => setShowDeposit(true)}
                  >
                    <CurrencyDollarIcon className="w-4 h-4 mr-2" />
                    Fund wallet with USDC
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Amount"
                      />
                      <Button variant="primary" onClick={handleDeposit} disabled={loading}>
                        Fund
                      </Button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-center gap-2">
        <span className={`w-2 h-2 rounded-full ${nanopaymentDemoMode ? 'bg-amber-400' : 'bg-green-400'} animate-pulse`} />
        <span className="text-xs text-gray-400 dark:text-gray-500">{nanopaymentDemoMode ? 'Test mode — payments skipped' : 'Live payment mode'}</span>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
          : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

function StrategicAdvisorPanel({ advice, onDismiss }) {
  if (!advice) return null;

  return (
    <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RocketLaunchIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h4 className="font-bold text-indigo-900">Strategic advice</h4>
        </div>
        <button onClick={onDismiss} className="text-indigo-400 hover:text-indigo-600 dark:text-indigo-400">
          <ChevronUpIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {advice.ecosystemFit.map((fit, i) => (
          <span key={i} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
            {fit}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white p-3 rounded-lg border border-indigo-50">
          <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Solana / Bags</p>
          <div className="flex items-end justify-between">
            <span className="text-lg font-black text-indigo-700">{advice.tradeOffMatrix.solanaBags.suitability}%</span>
            <span className="text-[10px] text-indigo-500 dark:text-indigo-400">Fit score</span>
          </div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-indigo-50">
          <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Circle / x402</p>
          <div className="flex items-end justify-between">
            <span className="text-lg font-black text-indigo-700">{advice.tradeOffMatrix.circleArc.suitability}%</span>
            <span className="text-[10px] text-indigo-500 dark:text-indigo-400">Fit score</span>
          </div>
        </div>
      </div>

      {advice.bagsRecommendation && (
        <div className="bg-white p-3 rounded-lg border-l-4 border-emerald-500 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <ArrowTrendingUpIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Suggested direction</span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">{advice.bagsRecommendation.reason}</p>
        </div>
      )}
    </div>
  );
}

function ServiceCard({ service, loading, onClick, disabled, price }) {
  const isPending = loading;

  return (
    <button
      onClick={onClick}
      disabled={disabled || isPending}
      className={`w-full p-3 rounded-lg border text-left transition-all ${
        isPending
          ? "border-indigo-300 bg-indigo-50"
          : "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xl">{service.icon}</span>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{service.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{service.description}</p>
          </div>
        </div>
        <div className="text-right">
          {isPending ? (
            <LoadingSpinner size="sm" />
          ) : (
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{formatUSDC(price)}</span>
          )}
        </div>
      </div>
    </button>
  );
}

function TransactionRow({ transaction }) {
  const isSuccess = transaction.status === "confirmed";
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2">
        <span className="text-sm">{transaction.agentName || transaction.type}</span>
        {isSuccess ? (
          <CheckCircleIcon className="w-4 h-4 text-green-500 dark:text-green-400" />
        ) : (
          <ExclamationTriangleIcon className="w-4 h-4 text-red-500 dark:text-red-400" />
        )}
      </div>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        -{formatUSDC(transaction.amount)}
      </span>
    </div>
  );
}

function WalletCard({ label, amount, color }) {
  const colorClasses = {
    green: "bg-green-50 text-green-700 dark:text-green-300",
    gray: "bg-gray-50 text-gray-700 dark:text-gray-300",
  };

  return (
    <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
      <p className="text-xs font-medium mb-1">{label}</p>
      <p className="text-lg font-bold">{formatUSDC(amount)}</p>
    </div>
  );
}

function UninitializedWidget({ onInitialize }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="text-center">
        <RocketLaunchIcon className="w-12 h-12 mx-auto text-indigo-500 dark:text-indigo-400 mb-4" />
        <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-2">Set up payment wallet</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Connect a wallet with USDC to run AI agents. Payments settle instantly via x402.
        </p>
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Per-request pricing:</p>
          <div className="text-sm space-y-1">
            <p><span className="font-medium">Scout:</span> $0.01 per scan</p>
            <p><span className="font-medium">Underwriter:</span> $0.05 per project</p>
            <p><span className="font-medium">Verifier:</span> $0.001 per 10 lines</p>
            <p><span className="font-medium">Chat:</span> $0.005 per message</p>
          </div>
        </div>
        <Button variant="primary" onClick={onInitialize} className="w-full mb-2">
          Set up payment wallet
        </Button>
        <button
          onClick={onInitialize}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 underline"
        >
          Or skip payments with test mode
        </button>
      </div>
    </div>
  );
}
