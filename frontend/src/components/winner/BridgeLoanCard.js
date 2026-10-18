/**
 * BridgeLoanCard — the builder's primary action surface.
 *
 * The rail is offer-driven: lenders send funded proposals, and the builder
 * draws by ACCEPTING one — posting their own collateral in the same
 * transaction that pays out principal net of fee. One card, three states:
 *   1. No anchored win   → point at declaration
 *   2. Win, no loan      → list open offers to accept, or "awaiting offers"
 *   3. Open loan         → due date, principal owed, repay
 *
 * Terms here are RISK STRUCTURE, never leverage. There is no multiplier and
 * no projected return, because there is no guaranteed return.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import { Checkbox } from "@/components/common/Input";
import { useToastActions } from "@/components/common/Toast";
import { useWallet, walletActions } from "@/stores/walletStore";
import { liquidityRailService, LOAN_MODES, LOAN_STATUS } from "@/services/liquidityRailService";
import useWinnerStatus from "@/hooks/useWinnerStatus";
import { formatUSDC } from "@/lib/format";

const MODE_LABEL = {
  [LOAN_MODES.OVERCOLLATERALIZED]: "Overcollateralized",
  [LOAN_MODES.TRANCHE_BACKED]: "Tranche-backed",
  [LOAN_MODES.HYBRID]: "Collateral + tranche",
};

export default function BridgeLoanCard() {
  const { isVerified, loading } = useWinnerStatus();
  const wallet = useWallet();
  const toast = useToastActions();

  const [winId, setWinId] = useState(null);
  const [win, setWin] = useState(null);
  const [loan, setLoan] = useState(null);
  const [offers, setOffers] = useState([]);
  const [railLoading, setRailLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const walletReady = Boolean(wallet.account && wallet.publicClient);
  const railLive = liquidityRailService.isDeployed(wallet.chainId);

  const load = useCallback(async () => {
    if (!walletReady || !railLive) return;
    setRailLoading(true);
    try {
      const winIds = await liquidityRailService.getBuilderWins(
        wallet.chainId,
        wallet.publicClient,
        wallet.account
      );
      const latest = winIds.length > 0 ? winIds[winIds.length - 1] : null;
      setWinId(latest);
      if (latest == null) {
        setWin(null);
        setLoan(null);
        setOffers([]);
        return;
      }
      const [w, l, props] = await Promise.all([
        liquidityRailService.getWin(wallet.chainId, wallet.publicClient, latest),
        liquidityRailService.getLoan(wallet.chainId, wallet.publicClient, latest),
        liquidityRailService.listOpenProposals(wallet.chainId, wallet.publicClient, latest),
      ]);
      setWin(w);
      setLoan(l);
      setOffers(props);
    } finally {
      setRailLoading(false);
    }
  }, [walletReady, railLive, wallet.chainId, wallet.publicClient, wallet.account]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAccept(offer) {
    if (!accepted || selected?.proposalId !== offer.proposalId) {
      toast.error("Review and confirm the repayment terms on that offer first.");
      return;
    }
    setSubmitting(true);
    try {
      await walletActions.acceptLoan(offer.proposalId, offer.collateral);
      toast.success(`Loan drawn — you posted ${formatUSDC(Number(offer.collateral))} collateral and received the principal net of fee.`);
      setSelected(null);
      setAccepted(false);
      await load();
    } catch (error) {
      toast.error(`Could not accept the offer: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRepay() {
    setSubmitting(true);
    try {
      await walletActions.repayLoan(loan.winId, loan.principal);
      toast.success(`Repaid ${formatUSDC(Number(loan.principal))} — your collateral is released.`);
      await load();
    } catch (error) {
      toast.error(`Could not repay: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-secondary">Checking your win status…</p>
      </Card>
    );
  }

  // 1. No confirmed win — the win is the precondition, so lead with it.
  if (!isVerified) {
    return (
      <Card className="p-6 border border-indigo-100 dark:border-indigo-900/50">
        <h2 className="text-lg font-bold text-primary">Get paid before the organizer pays you</h2>
        <p className="text-sm text-secondary mt-1 max-w-xl">
          Once your win is declared on-chain and anchored on the rail, lenders can send you
          funded offers — you draw by accepting one and posting the collateral it names.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/projects/new">
            <Button variant="primary">Declare your win</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const prize = Number(win?.prizeAmount || 0);
  const daysLeft = loan ? Math.max(0, Math.ceil((loan.dueAt * 1000 - Date.now()) / 86400000)) : null;

  // 3. Open loan — status and repay.
  if (loan && loan.status === LOAN_STATUS.OPEN) {
    return (
      <Card className="p-6 border border-indigo-100 dark:border-indigo-900/50">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-primary">Bridge loan</h2>
            <p className="text-sm text-secondary mt-1">
              {win?.projectName ? `${win.projectName} · ` : ""}declared prize {formatUSDC(prize)}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            Loan active · {daysLeft}d left
          </span>
        </div>

        <div className="bg-surface border border-default rounded-lg p-4 space-y-2 text-sm mb-4">
          <div className="flex justify-between">
            <span className="text-secondary">Principal owed</span>
            <span className="font-semibold text-primary">{formatUSDC(Number(loan.principal))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Collateral escrowed</span>
            <span className="font-semibold text-primary">{formatUSDC(Number(loan.collateral))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Due</span>
            <span className="font-semibold text-primary">
              {new Date(loan.dueAt * 1000).toLocaleDateString()}
            </span>
          </div>
        </div>

        <p className="text-xs text-tertiary mb-4">
          Repay at par once the organizer pays — your collateral releases in the same transaction.
          Past due, the loan can default and collateral liquidates to the lender.
        </p>

        <Button variant="primary" onClick={handleRepay} loading={submitting} disabled={!walletReady}>
          Repay {formatUSDC(Number(loan.principal))}
        </Button>
      </Card>
    );
  }

  // 2. Anchored win, no open loan — show incoming offers to accept.
  return (
    <Card className="p-6 border border-indigo-100 dark:border-indigo-900/50">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-primary">Bridge loan</h2>
          <p className="text-sm text-secondary mt-1">
            {win ? `Win #${winId} · declared prize ${formatUSDC(prize)}` : "Verified winner"}
          </p>
        </div>
        {winId != null && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            Win anchored
          </span>
        )}
      </div>

      {!railLive && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          The liquidity rail is not live on this network. Switch to Arc to draw against this win.
        </div>
      )}

      {winId == null && railLive && (
        <p className="text-sm text-secondary">
          Your win is verified but not yet anchored on the rail — once the organizer&apos;s
          on-chain declaration is anchored, lender offers appear here.
        </p>
      )}

      {winId != null && offers.length === 0 && !railLoading && (
        <p className="text-sm text-secondary">
          No open offers yet. Lenders send funded proposals against your anchored win — when
          one lands you&apos;ll see the exact fee and collateral here before you draw.
        </p>
      )}

      {offers.length > 0 && (
        <ul className="space-y-3">
          {offers.map((offer) => {
            const fee = Number(offer.principal) * (offer.feeBps / 10000);
            const net = Number(offer.principal) - fee;
            const isSelected = selected?.proposalId === offer.proposalId;
            return (
              <li key={offer.proposalId} className="border border-default rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="font-semibold text-primary">
                    Draw {formatUSDC(net)} of {formatUSDC(Number(offer.principal))}
                  </p>
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                    {MODE_LABEL[offer.trancheCommitted && Number(offer.trancheSize) > 0 && Number(offer.collateral) > 0
                      ? LOAN_MODES.HYBRID
                      : Number(offer.trancheSize) > 0
                        ? LOAN_MODES.TRANCHE_BACKED
                        : LOAN_MODES.OVERCOLLATERALIZED]}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-secondary mb-3">
                  <span>Fee {(offer.feeBps / 100).toFixed(1)}%</span>
                  <span>Term {offer.durationDays}d</span>
                  <span>Collateral {formatUSDC(Number(offer.collateral))}</span>
                  <span>Lender {offer.lender.slice(0, 6)}…{offer.lender.slice(-4)}</span>
                </div>

                {isSelected && (
                  <div className="mb-3">
                    <Checkbox
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                      label={`I understand I repay ${formatUSDC(Number(offer.principal))} within ${offer.durationDays} days, and if I default my ${formatUSDC(Number(offer.collateral))} collateral liquidates to the lender.`}
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  {!isSelected ? (
                    <Button variant="ghost" size="sm" onClick={() => { setSelected(offer); setAccepted(false); }}>
                      Review terms
                    </Button>
                  ) : (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setSelected(null)} disabled={submitting}>
                        Back
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleAccept(offer)}
                        loading={submitting}
                        disabled={!accepted || !walletReady}
                      >
                        Post {formatUSDC(Number(offer.collateral))} &amp; draw {formatUSDC(net)}
                      </Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {offers.length > 0 && (
        <p className="text-xs text-tertiary mt-4">
          Accepting is the draw: your collateral escrows and the principal lands net of the
          fee in one transaction. You can wait for a better offer — nothing draws without
          your signature.
        </p>
      )}
    </Card>
  );
}
