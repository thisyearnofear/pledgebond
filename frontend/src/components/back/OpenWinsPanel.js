/**
 * OpenWinsPanel — the lender's order book: declared on-chain wins with no
 * loan yet, read straight from the liquidity rail via WinDeclared events.
 *
 * Reads go through a public RPC client, so the listing works before the
 * visitor connects a wallet. Funding one requires the overcollateralized
 * path in LoanTermsModal (the caller signs as the lender).
 */

import { useState, useEffect, useCallback } from "react";
import { createPublicClient, http } from "viem";
import { useWallet } from "@/stores/walletStore";
import { liquidityRailService } from "@/services/liquidityRailService";
import { NETWORK_CONFIGS } from "@/lib/wallet/constants";
import { formatUSDC } from "@/lib/format";
import LoanTermsModal from "@/components/back/LoanTermsModal";
import Button from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { LoadingSpinner } from "@/components/common/LoadingStates";

// The rail only exists on Arc today; mainnet joins the table when deployed.
const RAIL_CHAIN_ID = Number(process.env.NEXT_PUBLIC_RAIL_CHAIN_ID || 5042002);

function publicClientFor(chainId) {
  const cfg = NETWORK_CONFIGS[chainId];
  if (!cfg) return null;
  return createPublicClient({ transport: http(cfg.rpcUrls[0]) });
}

export default function OpenWinsPanel() {
  const wallet = useWallet();
  const [wins, setWins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [funding, setFunding] = useState(null);

  const load = useCallback(async () => {
    const client = publicClientFor(RAIL_CHAIN_ID);
    if (!client) {
      setError(`No RPC configured for chain ${RAIL_CHAIN_ID}.`);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setWins(await liquidityRailService.listOpenWins(RAIL_CHAIN_ID, client));
    } catch (err) {
      setError(err.message || "Could not read open wins from the rail.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div>
          <h3 className="font-semibold text-primary">Open bridge loans</h3>
          <p className="text-sm text-secondary">
            Wins declared on the rail that no lender has funded yet.
          </p>
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
          Nothing to fund right now — every declared win already has a loan.
        </p>
      )}

      {!loading && !error && wins.length > 0 && (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 mt-2">
          {wins.map((win) => (
            <li key={win.winId} className="py-3 flex items-center justify-between gap-4">
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
              <Button
                variant="primary"
                size="sm"
                disabled={!wallet.connected}
                title={wallet.connected ? undefined : "Connect a wallet to fund"}
                onClick={() => setFunding(win)}
              >
                Fund
              </Button>
            </li>
          ))}
        </ul>
      )}

      {funding && (
        <LoanTermsModal
          opportunity={funding}
          wallet={wallet}
          onClose={() => setFunding(null)}
          onSuccess={load}
        />
      )}
    </Card>
  );
}
