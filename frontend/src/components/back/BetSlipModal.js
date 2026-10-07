/**
 * BetSlipModal — bet on whether a declared win's prize actually gets paid.
 *
 * Mirrors LoanTermsModal, but the capital is structurally separate: stakes
 * only ever flow bettor -> pool -> bettors. A bet resolves from the
 * organizer's payout record on-chain, never from an admin call.
 */

import { useState } from "react";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { useToastActions } from "@/components/common/Toast";
import { walletActions } from "@/stores/walletStore";
import { formatUSDC } from "@/lib/format";

const SIDES = [
  {
    id: true,
    label: "Organizer pays",
    description:
      "The prize lands with the builder and the payout is recorded on-chain. Paid bets split the pool.",
    tone: "emerald",
  },
  {
    id: false,
    label: "Organizer doesn't pay",
    description:
      "No payout is recorded before the loan defaults. Unpaid bets split the pool.",
    tone: "amber",
  },
];

export default function BetSlipModal({ market, wallet, onClose, onSuccess }) {
  const [side, setSide] = useState(true);
  const [amount, setAmount] = useState("10");
  const [submitting, setSubmitting] = useState(false);
  const toast = useToastActions();

  const stake = Number(amount) || 0;
  const winId = market?.winId;
  const pool = Number(market?.betPool) || 0;
  const isBuilder =
    wallet?.account &&
    market?.builder &&
    wallet.account.toLowerCase() === market.builder.toLowerCase();

  async function handleBet() {
    if (stake <= 0) {
      toast.error("Enter a stake — the bet amount must be greater than zero.");
      return;
    }
    setSubmitting(true);
    try {
      if (!winId) {
        throw new Error("This win has no on-chain market to bet on yet.");
      }
      if (isBuilder) {
        throw new Error("Builders cannot bet on their own win.");
      }
      await walletActions.placeBet(winId, amount, side);
      toast.success(
        `Bet placed on win #${winId}: ${formatUSDC(stake)} on “${side ? "Organizer pays" : "Organizer doesn't pay"}”.`
      );
      onSuccess?.();
      onClose?.();
    } catch (error) {
      toast.error(`Could not place the bet: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Bet on the payout"
      description={`${market?.projectName || `Win #${winId}`} · declared prize ${formatUSDC(Number(market?.prizeAmount) || 0)}`}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleBet}
            loading={submitting}
            disabled={stake <= 0 || !winId || isBuilder}
          >
            Bet {stake > 0 ? formatUSDC(stake) : ""} on {side ? "pays" : "doesn't pay"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-primary mb-2">
            Your side
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SIDES.map((opt) => {
              const selected = side === opt.id;
              return (
                <button
                  key={String(opt.id)}
                  type="button"
                  onClick={() => setSide(opt.id)}
                  aria-pressed={selected}
                  className={`text-left p-4 rounded-lg border transition ${
                    selected
                      ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600 dark:bg-indigo-950/40"
                      : "border-default hover:border-gray-400"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-semibold text-primary">{opt.label}</span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        opt.tone === "emerald"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                      }`}
                    >
                      {opt.tone === "emerald" ? "Bullish" : "Bearish"}
                    </span>
                  </div>
                  <p className="text-xs text-secondary leading-relaxed">
                    {opt.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <Input
          label="Stake (USDC)"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          helperText="Escrowed by the rail until the win resolves. Nothing is borrowed and no lender capital is touched."
          min="0.1"
        />

        <div className="bg-surface border border-default rounded-lg p-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-secondary">Current pool{pool > 0 ? "" : " (so far)"}</span>
            <span className="font-medium text-primary">
              {pool > 0 ? formatUSDC(pool) : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Resolves from</span>
            <span className="font-medium text-primary">The payout record on-chain</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Winning side receives</span>
            <span className="font-medium text-primary">The whole pool, pro-rata</span>
          </div>
        </div>

        {isBuilder && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            You are the builder on this win — builders cannot bet on their own payout.
          </p>
        )}

        <p className="text-xs text-tertiary leading-relaxed">
          The market is zero-house: winning stakes split the entire pool in
          proportion to what they risked, and losing stakes are swept into it.
          Payout odds only move once the organizer&apos;s transfer is recorded
          on the registry — there is no referee.
        </p>
      </div>
    </Modal>
  );
}
