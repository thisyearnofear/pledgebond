/**
 * WinHistoryPanel — the rail's public track record: every declared win on
 * this deployment and what actually happened to its loan and market.
 *
 * This is proof, not marketing: every row is a closed (or live) on-chain
 * event set, read via /api/rail/history and linked to the explorer. New
 * lenders should see wins 1…n settling in hours before they fund anything.
 */

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/stores/walletStore";
import { formatUSDC } from "@/lib/format";
import BetSlipModal from "@/components/back/BetSlipModal";
import { Card } from "@/components/common/Card";
import Button from "@/components/common/Button";
import { LoadingSpinner } from "@/components/common/LoadingStates";

const RAIL_CHAIN_ID = Number(process.env.NEXT_PUBLIC_RAIL_CHAIN_ID || 5042002);

const WIN_STATUS = { DECLARED: 1, SETTLED: 2, DEFAULTED: 3 };
const LOAN_STATUS = { NONE: 0, OPEN: 1, REPAID: 2, DEFAULTED: 3 };

/** "in 35min" / "in 4h" / "in 3d" from a seconds delta; the rail pays in hours. */
function formatPayTime(seconds) {
  if (seconds === null || seconds === undefined) return "";
  if (seconds < 3600) return `in ${Math.max(1, Math.round(seconds / 60))}min`;
  if (seconds < 86400) return `in ${Math.round(seconds / 3600)}h`;
  return `in ${Math.round(seconds / 86400)}d`;
}

function payDelta(win) {
  if (win.settledAt !== null && win.settledAt !== undefined) {
    return Math.max(0, win.settledAt - win.declaredAt);
  }
  if (win.daysToPay !== null && win.daysToPay !== undefined) {
    return win.daysToPay * 86400;
  }
  return null;
}

function ratioChips(win) {
  const principal = Number(win.principal);
  if (!(principal > 0)) return [];
  const chips = [];
  const collateral = Number(win.collateral);
  if (collateral > 0) {
    chips.push({
      label: `${Math.round((collateral / principal) * 100)}% collateralized`,
      title: `Collateral ${formatUSDC(collateral)} against ${formatUSDC(principal)} principal`,
    });
  }
  const fee = Number(win.originationFee);
  if (fee > 0) {
    chips.push({
      label: `${((fee / principal) * 100).toFixed(1).replace(/\.0$/, "")}% origination fee`,
      title: `${formatUSDC(fee)} fee on ${formatUSDC(principal)} principal`,
    });
  }
  return chips;
}

function summarize(wins) {
  if (wins.length === 0) return null;
  const funded = wins.filter((w) => w.loanStatus !== LOAN_STATUS.NONE).length;
  const repaid = wins.filter((w) => w.loanStatus === LOAN_STATUS.REPAID || w.winStatus === WIN_STATUS.SETTLED).length;
  const defaulted = wins.filter(
    (w) => w.winStatus === WIN_STATUS.DEFAULTED || w.loanStatus === LOAN_STATUS.DEFAULTED
  ).length;
  const deltas = wins.map(payDelta).filter((d) => d !== null).sort((a, b) => a - b);
  const median =
    deltas.length > 0
      ? formatPayTime(deltas[Math.floor(deltas.length / 2)]).replace(/^in /, "")
      : null;
  const parts = [`${wins.length} wins`, `${funded} funded`, `${repaid} repaid`];
  if (defaulted > 0) parts.push(`${defaulted} defaulted`);
  if (median) parts.push(`median payout ${median}`);
  return parts.join(" · ");
}

function loanChip(win) {
  if (win.winStatus === WIN_STATUS.DEFAULTED || win.loanStatus === LOAN_STATUS.DEFAULTED) {
    return { label: "Defaulted", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" };
  }
  if (win.loanStatus === LOAN_STATUS.REPAID || win.winStatus === WIN_STATUS.SETTLED) {
    const t = formatPayTime(payDelta(win));
    return { label: `Loan repaid${t ? ` ${t}` : ""}`, cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" };
  }
  if (win.loanStatus === LOAN_STATUS.OPEN) {
    return { label: `Loan active · ${formatUSDC(Number(win.principal))}`, cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" };
  }
  return { label: "Awaiting a lender", cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" };
}

function marketChip(win) {
  if (win.betsCount === 0) return null;
  if (win.betOutcome === 1) {
    return { label: `Market resolved paid · pool ${formatUSDC(Number(win.betPool))}`, cls: "text-green-600 dark:text-green-400" };
  }
  if (win.betOutcome === 2) {
    return { label: `Market resolved unpaid · pool ${formatUSDC(Number(win.betPool))}`, cls: "text-red-600 dark:text-red-400" };
  }
  return { label: `Market open · ${win.betsCount} bets`, cls: "text-amber-600 dark:text-amber-400" };
}

export default function WinHistoryPanel() {
  const wallet = useWallet();
  const [wins, setWins] = useState([]);
  const [explorer, setExplorer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [betting, setBetting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rail/history?chainId=${RAIL_CHAIN_ID}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Rail read failed (${res.status}).`);
      setWins(data.wins || []);
      setExplorer(data.explorer || null);
    } catch (err) {
      setError(err.message || "Could not read the rail history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card id="rail-history" className="p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div>
          <h3 className="font-semibold text-primary flex items-center gap-2 flex-wrap">
            What already happened on this rail
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
              Arc Testnet — real contracts, test USDC
            </span>
          </h3>
          <p className="text-sm text-secondary">
            Every declared win, its loan outcome, and its market resolution — straight from the chain.
          </p>
          {!loading && !error && wins.length > 0 && (
            <p className="text-xs font-medium text-tertiary mt-1">{summarize(wins)}</p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="sm" />
        </div>
      )}

      {!loading && error && (
        <p className="text-sm text-red-600 dark:text-red-400 py-4">{error}</p>
      )}

      {!loading && !error && wins.length === 0 && (
        <p className="text-sm text-tertiary py-6 text-center">
          No wins have been declared on this deployment yet.
        </p>
      )}

      {!loading && !error && wins.length > 0 && (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 mt-2">
          {wins.map((win) => {
            const loan = loanChip(win);
            const market = marketChip(win);
            const ratios = ratioChips(win);
            const bettable =
              win.winStatus === WIN_STATUS.DECLARED && win.betOutcome === 0;
            return (
              <li key={win.winId} className="py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-primary truncate">
                      {win.projectName || `Win #${win.winId}`}
                    </p>
                    <p className="text-xs text-tertiary">
                      prize {formatUSDC(Number(win.prizeAmount))} · builder{" "}
                      {`${win.builder.slice(0, 6)}…${win.builder.slice(-4)}`} · declared{" "}
                      {new Date(win.declaredAt * 1000).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 text-xs px-2 py-1 rounded-full font-medium ${loan.cls}`}
                  >
                    {loan.label}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 mt-1">
                  <div className="flex items-center gap-3 min-w-0 flex-wrap">
                    {market ? (
                      <p className={`text-xs font-medium ${market.cls}`}>{market.label}</p>
                    ) : (
                      <span />
                    )}
                    {ratios.map((chip) => (
                      <span
                        key={chip.label}
                        title={chip.title}
                        className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      >
                        {chip.label}
                      </span>
                    ))}
                    {bettable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!wallet.connected}
                        title={wallet.connected ? undefined : "Connect a wallet to bet"}
                        onClick={() => setBetting(win)}
                      >
                        Bet
                      </Button>
                    )}
                  </div>
                  {explorer && win.txHash && (
                    <a
                      href={`${explorer}/tx/${win.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      view on-chain
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {betting && (
        <BetSlipModal
          market={betting}
          wallet={wallet}
          onClose={() => setBetting(null)}
          onSuccess={load}
        />
      )}
    </Card>
  );
}
