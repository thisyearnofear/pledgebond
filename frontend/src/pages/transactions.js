/**
 * Transaction Explorer — shows real x402 nanopayment history from the current session.
 * No fake data — only displays transactions that actually occurred.
 */
import React, { useState, useMemo } from "react";
import Head from "next/head";
import Link from "next/link";
import { useNanopayment } from "@/stores/walletStore";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import { SkeletonTable } from "@/components/common/LoadingStates";

const AGENT_META = {
  underwrite: { icon: "🤖", name: "AI Underwriter", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  scout: { icon: "🔍", name: "AI Scout", color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200" },
  verify: { icon: "✅", name: "Verifier", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  rebalance: { icon: "🔄", name: "Rebalance", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  chat: { icon: "💬", name: "AI Chat", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200" },
  deposit: { icon: "💰", name: "Deposit", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function TransactionsPage() {
  const { transactions, isInitialized, balance, walletAddress } = useNanopayment();
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    if (filter === "all") return transactions;
    return transactions.filter((tx) => tx.type === filter);
  }, [transactions, filter]);

  const stats = useMemo(() => {
    const totalSpent = transactions
      .filter((tx) => tx.type !== "deposit")
      .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
    const agentCounts = {};
    transactions.forEach((tx) => {
      if (tx.type !== "deposit") {
        agentCounts[tx.type] = (agentCounts[tx.type] || 0) + 1;
      }
    });
    return { totalSpent, totalTx: transactions.length, agentCounts };
  }, [transactions]);

  const agentTypes = useMemo(() => {
    const types = new Set(transactions.map((tx) => tx.type));
    return Array.from(types);
  }, [transactions]);

  return (
    <>
      <Head>
        <title>Transaction Explorer | PledgeBond</title>
      </Head>

      <Breadcrumbs items={[{ label: "Transactions" }]} />

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">
              ⚡ Transaction Explorer
            </h1>
            <p className="text-sm text-secondary mt-1">
              Real x402 nanopayment activity from your session
            </p>
          </div>
          {walletAddress && (
            <div className="text-right">
              <p className="text-xs text-tertiary font-mono truncate max-w-[200px]">
                {walletAddress}
              </p>
              <p className="text-lg font-bold text-primary">
                ${parseFloat(balance.available || 0).toFixed(2)} USDC
              </p>
            </div>
          )}
        </div>

        {/* Stats cards — only real data */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface rounded-xl border border-default p-4">
            <p className="text-xs text-secondary">Total Transactions</p>
            <p className="text-2xl font-bold text-primary">{stats.totalTx}</p>
          </div>
          <div className="bg-surface rounded-xl border border-default p-4">
            <p className="text-xs text-secondary">Total Spent</p>
            <p className="text-2xl font-bold text-primary">
              ${stats.totalSpent.toFixed(3)}
            </p>
          </div>
          <div className="bg-surface rounded-xl border border-default p-4">
            <p className="text-xs text-secondary">Agent Types Used</p>
            <p className="text-2xl font-bold text-primary">
              {Object.keys(stats.agentCounts).length}
            </p>
          </div>
          <div className="bg-surface rounded-xl border border-default p-4">
            <p className="text-xs text-secondary">Avg Cost / Query</p>
            <p className="text-2xl font-bold text-primary">
              {stats.totalTx > 0
                ? `$${(stats.totalSpent / stats.totalTx).toFixed(3)}`
                : "—"}
            </p>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === "all"
                ? "bg-teal-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            All ({transactions.length})
          </button>
          {agentTypes.map((type) => {
            const meta = AGENT_META[type] || { icon: "💸", name: type };
            const count = transactions.filter((tx) => tx.type === type).length;
            return (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filter === type
                    ? "bg-teal-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {meta.icon} {meta.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Transaction list */}
        {!isInitialized ? (
          <div className="text-center py-12">
            <p className="text-secondary mb-4">
              Initialize your wallet to see transactions
            </p>
            <Link
              href="/back"
              className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm"
            >
              Go to AI Agents →
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-surface rounded-xl border border-default">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-secondary mb-2">
              {filter === "all"
                ? "No transactions yet"
                : `No ${AGENT_META[filter]?.name || filter} transactions`}
            </p>
            <p className="text-xs text-tertiary">
              Try an AI agent on the{" "}
              <Link href="/back" className="text-teal-600 hover:underline">
                Back
              </Link>{" "}
              page to generate real transactions.
            </p>
          </div>
        ) : (
          <div className="bg-surface rounded-xl border border-default overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-750 border-b border-default">
                    <th className="text-left px-4 py-3 text-xs font-medium text-secondary uppercase">Agent</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-secondary uppercase">Details</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-secondary uppercase">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-secondary uppercase">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-secondary uppercase">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map((tx, i) => {
                    const meta = AGENT_META[tx.type] || { icon: "💸", name: tx.type, color: "bg-gray-100 text-gray-800" };
                    return (
                      <tr key={tx.id || i} className={`hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${i === 0 ? "bg-teal-50/30 dark:bg-teal-900/10" : ""}`}>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                            {meta.icon} {meta.name}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-primary text-xs truncate max-w-[200px]">
                            {tx.projectName || tx.description || tx.agentName || "—"}
                          </p>
                          {tx.txHash && (
                            <p className="text-[10px] text-tertiary font-mono truncate max-w-[160px]">
                              {tx.txHash}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold text-xs ${tx.type === "deposit" ? "text-green-600" : "text-primary"}`}>
                            {tx.type === "deposit" ? "+" : "-"}${parseFloat(tx.amount || 0).toFixed(3)}
                          </span>
                          <p className="text-[10px] text-gray-400">USDC</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs ${
                            tx.status === "confirmed" ? "text-green-600" : tx.status === "failed" ? "text-red-600" : "text-yellow-600"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              tx.status === "confirmed" ? "bg-green-500" : tx.status === "failed" ? "bg-red-500" : "bg-yellow-500"
                            }`} />
                            {tx.status || "pending"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-secondary whitespace-nowrap">
                          {tx.timestamp ? timeAgo(tx.timestamp) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* x402 flow explanation */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-default">
          <h3 className="text-sm font-semibold text-primary mb-2">
            How x402 Nanopayments Work
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
            <span className="bg-surface px-2 py-1 rounded border border-gray-200 dark:border-gray-600">
              You call an agent
            </span>
            <span>→</span>
            <span className="bg-surface px-2 py-1 rounded border border-gray-200 dark:border-gray-600">
              402 Payment Required
            </span>
            <span>→</span>
            <span className="bg-surface px-2 py-1 rounded border border-gray-200 dark:border-gray-600">
              USDC settled via Circle
            </span>
            <span>→</span>
            <span className="bg-surface px-2 py-1 rounded border border-gray-200 dark:border-gray-600">
              Agent returns results
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
