/**
 * Nanopayment Ledger
 * 
 * Transaction history showing all nanopayments flowing through the platform.
 * Visualizes the "Agentic Economy" - AI agents earning USDC for their services.
 * 
 * Uses NanopaymentContext for real-time transaction data.
 * Part of Agentic Economy Hackathon Dashboard
 */

import React from "react";
import { useNanopayment } from "@/stores/walletStore";
import {
  BanknotesIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";

const STATUS_CONFIG = {
  pending: { icon: ClockIcon, color: "text-yellow-500 dark:text-yellow-400", bg: "bg-yellow-50" },
  confirmed: { icon: CheckCircleIcon, color: "text-green-500 dark:text-green-400", bg: "bg-green-50" },
  failed: { icon: XCircleIcon, color: "text-red-500 dark:text-red-400", bg: "bg-red-50" },
  settled: { icon: BanknotesIcon, color: "text-indigo-500 dark:text-indigo-400", bg: "bg-indigo-50" },
};

const TYPE_CONFIG = {
  "underwrite": {
    label: "pledgebond-underwriter.sol",
    humanName: "Underwriter Agent",
    description: "Project health score analysis",
    icon: "🤖",
    color: "indigo",
  },
  "scout": {
    label: "pledgebond-scout.sol",
    humanName: "Scout Agent",
    description: "Portfolio recommendations",
    icon: "🔭",
    color: "blue",
  },
  "verify": {
    label: "pledgebond-verifier.sol",
    humanName: "Verifier Agent",
    description: "Code verification",
    icon: "✅",
    color: "green",
  },
  "rebalance": {
    label: "pledgebond-rebalance.sol",
    humanName: "Rebalance Agent",
    description: "Auto-rebalancing",
    icon: "⚖️",
    color: "purple",
  },
  "deposit": {
    label: "Deposit",
    description: "Gateway wallet funding",
    icon: "⬇️",
    color: "green",
  },
};

function formatUSDC(amount) {
  if (!amount) return "$0.00";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `$${num.toFixed(2)}`;
}

function formatTime(timestamp) {
  if (!timestamp) return "N/A";
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

function shortenHash(hash) {
  if (!hash || hash.length < 8) return "N/A";
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

export default function NanopaymentLedger({ 
  transactions: propTransactions, 
  title = "Agentic Economy Ledger",
  showSummary = true,
  maxItems = 20,
}) {
  const { transactions: contextTransactions, balance } = useNanopayment();
  const transactions = propTransactions || contextTransactions;

  const totalEarned = transactions
    .filter((t) => t.type !== "deposit")
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const totalSpent = transactions.length;
  const pendingCount = transactions.filter((t) => t.status === "pending").length;
  const confirmedCount = transactions.filter((t) => t.status === "confirmed").length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BanknotesIcon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          </div>
          {showSummary && (
            <div className="flex items-center gap-4 text-xs">
              <span className="text-green-600 dark:text-green-400 font-medium">
                +{formatUSDC(totalEarned)} earned
              </span>
              <span className="text-gray-300 dark:text-gray-500">|</span>
              <span className="text-gray-500 dark:text-gray-400">
                {confirmedCount}/{transactions.length} confirmed
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Transaction List */}
      <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
        {transactions.length === 0 ? (
          <EmptyLedgerState />
        ) : (
          transactions.slice(0, maxItems).map((tx) => (
            <TransactionRow key={tx.id} transaction={tx} />
          ))
        )}
      </div>

      {/* Network Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-gray-400 dark:text-gray-500">Circle Gateway</span>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Gasless · Sub-second
        </span>
      </div>
    </div>
  );
}

function EmptyLedgerState() {
  return (
    <div className="px-4 py-12 text-center">
      <BanknotesIcon className="w-16 h-16 mx-auto text-gray-200 dark:text-gray-600 mb-4" />
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">No transactions yet</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">AI agents will earn USDC for their services</p>
      <div className="mt-6 grid grid-cols-2 gap-4 max-w-xs mx-auto">
        {Object.entries(TYPE_CONFIG).slice(0, 4).map(([key, config]) => (
          <div key={key} className="p-3 bg-gray-50 rounded-lg text-center">
            <div className="text-xl mb-1">{config.icon}</div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{config.label}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{formatUSDC(config.price || 0)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransactionRow({ transaction }) {
  const { type, amount, status, timestamp, txHash, agentName } = transaction;
  const typeConfig = TYPE_CONFIG[type] || TYPE_CONFIG["underwrite"];
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG["pending"];
  const StatusIcon = statusConfig.icon;
  const isIncoming = type === "deposit";

  return (
    <div className="px-4 py-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl">{typeConfig?.icon || "🤖"}</div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {agentName || typeConfig?.label || type}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {typeConfig?.humanName ? `${typeConfig.humanName} · ` : ''}{typeConfig?.description || transaction.description}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-sm font-bold ${isIncoming ? "text-green-600 dark:text-green-400" : "text-gray-900 dark:text-gray-100"}`}>
            {isIncoming ? "+" : "-"}{formatUSDC(amount)}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{formatTime(timestamp)}</p>
        </div>
      </div>

      {/* Status Badge */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <StatusIcon className={`w-3.5 h-3.5 ${statusConfig.color}`} />
          <span className={`text-xs capitalize ${statusConfig.color}`}>
            {status}
          </span>
        </div>
        {txHash && (
          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
            {shortenHash(txHash)}
          </span>
        )}
      </div>
    </div>
  );
}

export function AgentEarningsCard() {
  const { transactions, balance } = useNanopayment();

  const earningsByAgent = transactions
    .filter((t) => t.status === "confirmed" && t.type !== "deposit")
    .reduce((acc, t) => {
      const key = t.agentName || t.type;
      acc[key] = (acc[key] || 0) + parseFloat(t.amount || 0);
      return acc;
    }, {});

  const agents = Object.entries(earningsByAgent)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-4">
        <ArrowTrendingUpIcon className="w-5 h-5 text-green-500 dark:text-green-400" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">AI Agent Earnings</h3>
      </div>

      {agents.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          No earnings yet. AI agents earn when users pay for their services.
        </p>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => (
            <div key={agent.name} className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">{agent.name}</span>
              <span className="text-sm font-bold text-green-600 dark:text-green-400">
                +{formatUSDC(agent.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total</span>
          <span className="text-lg font-bold text-green-600 dark:text-green-400">
            +{formatUSDC(agents.reduce((s, a) => s + a.amount, 0))}
          </span>
        </div>
      </div>
    </div>
  );
}
