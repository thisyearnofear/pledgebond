/**
 * BridgeLoanCard — the builder's primary action surface.
 *
 * One card, three states, so the next step is never ambiguous:
 *   1. No declared win  → declare one (a win is the loan's precondition)
 *   2. Declared, no loan → pick a structure, amount, rate and draw
 *   3. Open or settled loan → status, fee, days left, settlement
 *
 * Terms offered here are RISK STRUCTURE, never leverage. There is no
 * multiplier and no projected return, because there is no guaranteed return.
 */

import { useState } from "react";
import Link from "next/link";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import { Input, Select } from "@/components/common/Input";
import { Checkbox } from "@/components/common/Input";
import { useToastActions } from "@/components/common/Toast";
import { useWallet } from "@/stores/walletStore";
import { useBuilderCredit } from "@/stores/walletStore";
import { liquidityRailService } from "@/services/liquidityRailService";
import useWinnerStatus from "@/hooks/useWinnerStatus";
import { formatUSDC } from "@/lib/format";

const STRUCTURES = [
  {
    id: "overcollateralized",
    label: "Overcollateralized",
    summary: "You post collateral covering the loan. If the prize never arrives, it's liquidated to the lender — you owe nothing extra.",
    badge: "No credit risk",
  },
  {
    id: "tranche",
    label: "Tranche-backed",
    summary: "A first-loss provider absorbs the loss before the lender does. Higher fee, lower risk.",
    badge: "Protected",
  },
];

const RATE_OPTIONS = [
  { value: "300", label: "3% — fastest" },
  { value: "600", label: "6% — balanced" },
  { value: "1000", label: "10% — longest term" },
];

const DURATION_OPTIONS = [
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
];

export default function BridgeLoanCard() {
  const { isVerified, wins, loading } = useWinnerStatus();
  const wallet = useWallet();
  const { openLoan } = useBuilderCredit();
  const toast = useToastActions();

  const [structure, setStructure] = useState("overcollateralized");
  const [amount, setAmount] = useState("");
  const [rateBps, setRateBps] = useState("600");
  const [duration, setDuration] = useState("30");
  const [accepted, setAccepted] = useState(false);
  const [stage, setStage] = useState("form");
  const [submitting, setSubmitting] = useState(false);

  const win = Array.isArray(wins) && wins.length > 0 ? wins[0] : null;
  const prize = Number(win?.prizeAmount || 0);
  const principal = Number(amount) || 0;
  const fee = Math.round(principal * (Number(rateBps) / 10000) * 1e6) / 1e6;
  const netToBuilder = principal - fee;
  const walletReady = Boolean(wallet.account);
  const railLive = liquidityRailService.isDeployed(wallet.chainId);

  function handleReview() {
    if (!walletReady) {
      toast.error("Connect an EVM wallet to draw a loan.");
      return;
    }
    if (!railLive) {
      toast.error("The liquidity rail is not live on this network — switch to Arc.");
      return;
    }
    if (principal <= 0) {
      toast.error("Enter how much you want to draw.");
      return;
    }
    if (prize > 0 && principal > prize) {
      toast.error(`You can't draw more than the declared prize of ${formatUSDC(prize)}.`);
      return;
    }
    setStage("review");
  }

  async function handleConfirm() {
    if (!accepted) {
      toast.error("Confirm the repayment terms to continue.");
      return;
    }
    setSubmitting(true);
    try {
      await openLoan(win.id, {
        principal: amount,
        ...(structure === "overcollateralized"
          ? { collateral: amount }
          : { trancheSize: amount, trancheProvider: win.trancheProvider || null }),
        rateBps: Number(rateBps),
        durationDays: Number(duration),
        incentives: 0,
      });
      toast.success(`Loan open — ${formatUSDC(netToBuilder)} is on its way.`);
      setStage("form");
      setAccepted(false);
      setAmount("");
    } catch (error) {
      toast.error(`Could not open the loan: ${error.message}`);
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
          Once your win is declared on-chain you can draw USDC against the unpaid prize and
          repay when it lands. Declaring a win takes a link to the announcement.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/projects/new">
            <Button variant="primary">Declare your win</Button>
          </Link>
        </div>
      </Card>
    );
  }

  // 2/3. Declared. Loan state comes from the rail (WS2); until it is deployed
  // there is nothing to draw against yet, so show the win and be honest.
  return (
    <Card className="p-6 border border-indigo-100 dark:border-indigo-900/50">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-primary">Bridge loan</h2>
          <p className="text-sm text-secondary mt-1">
            {win?.name ? `${win.name} · ` : ""}declared prize {formatUSDC(prize)}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
          Win declared
        </span>
      </div>

      {!railLive && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          The liquidity rail is not live on this network. Switch to Arc to draw against this win.
        </div>
      )}

      {stage === "form" ? (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              How is this loan secured?
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
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-semibold text-primary text-sm">{opt.label}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed">{opt.summary}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Draw (USDC)"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              helperText={prize > 0 ? `Up to ${formatUSDC(prize)}` : undefined}
              min="1"
            />
            <Select
              label="Rate"
              value={rateBps}
              onChange={(e) => setRateBps(e.target.value)}
            >
              {RATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
            <Select
              label="Term"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              {DURATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>

          <Button variant="primary" onClick={handleReview} disabled={principal <= 0}>
            Review loan
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-surface border border-default rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-secondary">You receive</span>
              <span className="font-semibold text-primary">{formatUSDC(netToBuilder)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Repaid on settlement</span>
              <span className="font-semibold text-primary">{formatUSDC(principal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Rate</span>
              <span className="font-semibold text-primary">
                {(Number(rateBps) / 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Term</span>
              <span className="font-semibold text-primary">{duration} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Secured by</span>
              <span className="font-semibold text-primary">
                {structure === "overcollateralized" ? "Your collateral" : "First-loss tranche"}
              </span>
            </div>
          </div>

          <Checkbox
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            label={`I understand the loan is repaid from the hackathon payout, and that if it isn't paid within ${duration} days the loan can default and my collateral is liquidated.`}
          />

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStage("form")} disabled={submitting}>
              Back
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              loading={submitting}
              disabled={!accepted}
            >
              Draw {formatUSDC(netToBuilder)}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}