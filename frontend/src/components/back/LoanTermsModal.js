/**
 * LoanTermsModal — fund a bridge loan against a declared win.
 *
 * Replaces the old multiplier-staking modal. The terms offered here are
 * RISK STRUCTURE, never leverage: a lender funds principal and takes credit
 * risk, or funds a tranche and takes first-loss risk. There is no multiplier
 * and no projected return, because there is no guaranteed return.
 */

import { useState } from "react";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { useToastActions } from "@/components/common/Toast";
import { formatUSDC } from "@/lib/format";

const STRUCTURES = [
  {
    id: "overcollateralized",
    label: "Overcollateralized",
    description:
      "The builder posts collateral at or above the loan. If the prize never arrives, collateral is liquidated and you take no loss.",
    badge: "No credit risk",
    tone: "emerald",
  },
  {
    id: "tranche",
    label: "Tranche-backed",
    description:
      "A first-loss provider absorbs the loss before you do. Higher fee, lower risk. You are repaid from the prize.",
    badge: "Protected",
    tone: "blue",
  },
];

export default function LoanTermsModal({ opportunity, wallet, onClose, onSuccess }) {
  const [structure, setStructure] = useState("overcollateralized");
  const [amount, setAmount] = useState("1000");
  const [submitting, setSubmitting] = useState(false);
  const toast = useToastActions();

  const principal = Number(amount) || 0;
  const prize = Number(opportunity?.prizeAmount) || 0;
  const maxRateBps = Number(opportunity?.maxRateBps ?? 0);

  async function handleFund() {
    if (principal <= 0) {
      toast.error("Enter an amount — the loan principal must be greater than zero.");
      return;
    }
    if (principal > prize) {
      toast.error(
        `Amount exceeds the declared prize of ${formatUSDC(prize)}.`
      );
      return;
    }

    setSubmitting(true);
    try {
      // Wired to LiquidityRail.openLoan in WS2/WS3. Until the rail is deployed
      // on this network the call is not available, so fail loudly rather than
      // pretending a loan was opened.
      throw new Error("The liquidity rail is not deployed on this network yet.");
    } catch (error) {
      toast.error(`Could not open the loan: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Fund this loan"
      description={`${opportunity?.name || "This project"} · declared prize ${formatUSDC(prize)}`}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleFund}
            loading={submitting}
            disabled={principal <= 0}
          >
            Fund {principal > 0 ? formatUSDC(principal) : "loan"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-primary mb-2">
            Risk structure
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {STRUCTURES.map((opt) => {
              const selected = structure === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setStructure(opt.id)}
                  aria-pressed={selected}
                  className={`text-left p-4 rounded-lg border transition ${
                    selected
                      ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600 dark:bg-indigo-950/40"
                      : "border-default hover:border-gray-400"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-semibold text-primary">{opt.label}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                      {opt.badge}
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
          label="Loan amount (USDC)"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          helperText={`Up to the declared prize of ${formatUSDC(prize)}.`}
          min="1"
        />

        <div className="bg-surface border border-default rounded-lg p-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-secondary">Principal you're funding</span>
            <span className="font-medium text-primary">{formatUSDC(principal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Repaid from</span>
            <span className="font-medium text-primary">The prize payout</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Builder's rate ceiling</span>
            <span className="font-medium text-primary">
              {maxRateBps > 0 ? `${(maxRateBps / 100).toFixed(0)}%` : "—"}
            </span>
          </div>
        </div>

        <p className="text-xs text-tertiary leading-relaxed">
          Repayment happens when the organizer&apos;s payout is recorded on-chain.
          If it isn&apos;t recorded by the due date the loan can default: with
          overcollateralized terms the collateral is liquidated to you, and with
          tranche terms the first-loss provider absorbs it. Either way you are
          repaid from the prize, never from us.
        </p>
      </div>
    </Modal>
  );
}