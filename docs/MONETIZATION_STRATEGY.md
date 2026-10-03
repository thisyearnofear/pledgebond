# Monetization Strategy

## The rule

**We take a percentage of the transactions we enable. We never underwrite, never take a share of winnings, and never absorb a credit loss.**

That rule is not aspirational — it is enforced in code. Every loan is either overcollateralized or backed by a designated first-loss tranche, and `withdrawFees` can only ever reach `accruedFees`, which the contract increments on each fee. There is no path by which a legitimate sequence of user actions makes the platform pay principal.

---

## Revenue model

### Primary — fees on notional, charged both sides

| Fee | Charged on | When |
|---|---|---|
| **Origination fee** | Loan principal | Atomically in `openLoan` — deducted from the amount the builder receives |
| **Settlement fee** | Repaid amount | Atomically in `settleLoan` |
| **Market fee** | Bet stake | On bet placement and/or resolution |

All are basis points of notional. Both sides pay, because the platform is making a market between them — not brokering one side's behalf.

**Why not fee-on-winnings:** a charge proportional to the outcome is a claim on the result, which is a much harder thing to characterize. Fee-on-notional is a service charge on a transaction. Given this is a lending business and an event-derivatives market, that distinction is doing real work.

### Secondary — AI agent micropayments

Per-call x402 pricing on Arc: `underwrite` $0.05, `scout` $0.01, `verify` $0.001. Real revenue, but a rounding error next to loan fees, and explicitly **not** the model.

### Explicitly not revenue

- **A share of prize winnings.** Never. See above.
- **A spread on principal.** Never.
- **First-loss tranche returns.** If we ever take a tranche ourselves, that is underwriting and it contradicts the rule.

---

## What the fee pays for

| Investment | Rationale |
|---|---|
| **Verification** | Confirming payouts against real receipts, per chain. The unscalable work is the moat. |
| **Credibility record** | Maintaining the public payment history that the market prices against. |
| **Liquidity for the escrow** | Collateral custody — the one thing genuinely requiring onchain code rather than a database. |
| **Sponsorship** | Free agent calls for new users. Bounded by `AGENT_SPONSOR_GLOBAL_CAP` and **disabled** unless explicitly configured. |

---

## Economics by phase

### Phase 0 — prove liquidity exists (no revenue)

Route real winnings through the rail, measure time-to-cash. The question is whether a builder will draw against a confirmed win at all. Everything else is downstream of that.

### Phase 1 — prove builders will pay for speed

Origination + settlement fees. The question is whether a builder with a 90-day wait will pay bps for 3 days.

### Phase 2 — prove the two-sided market

Market fees once bettors have something to price. The question is whether lenders and bettors will both show up.

---

## Guardrails

- **Sponsored calls** default to disabled. `AGENT_SPONSOR_GLOBAL_CAP` unset or `0` means no platform-funded inference at all.
- **Server-controlled wallets only.** Any outbound transfer from a wallet not in the server allowlist is refused outright. Callers cannot name which platform wallet is debited.
- **Every disbursement is logged.** `recordDisbursement` writes a `PayoutLogs` row; `reconcilePayouts` advances them past `initiated`. The platform can always answer "how much did we send, and did it settle?"
- **Payment verification fails closed.** An RPC failure means the request is rejected, not served unverified.

---

## Open items

- **First-loss tranche economics.** Whether tranche providers pay a fee, and whether the platform itself may ever participate (it may not, under the current rule — this needs revisiting if tranche capital proves hard to source).
- **Fee split between sides.** Origination vs settlement weighting is a product decision, not yet made.
- **Regulatory characterisation.** Lending plus event-derivatives is a specific posture that the existing escrow framing doesn't cover. Needs a dedicated read before mainnet.