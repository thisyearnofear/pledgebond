# PledgeBond — Product Vision

> **Hackathon winners wait too long to get paid. We pay them now.**

A hackathon organizer can take 60–90 days to disburse a prize. The winner has already won — the money just isn't there. PledgeBond is the liquidity rail that bridges that gap: a builder with a **confirmed win** draws a bridge loan against the unpaid prize, repaid the moment the organizer pays out.

We also run a market on the other side of the same fact: **will this winner actually get paid?** Two parties, two pools, one shared public record.

---

## The Wedge

**The delay is the problem, and the win is the proof.** A builder holding a confirmed hackathon win has an asset: a dated, publicly verifiable claim on money that already exists but hasn't moved. Today they either wait, or they bootstrap — which for most means burning runway on a second hackathon.

- **Secret:** hackathon organizers pay slowly and inconsistently, and no lender will advance against a prize receivable. The builder has leverage — a real win — and almost no access to liquidity against it.
- **Beachhead:** winners of hackathons we can verify, who have a backer list already. We don't need hosts' permission to start; we route the winnings they already earned.
- **Wedge:** the confirmed win. Once one builder draws against a prize and gets repaid in hours, the next one is a reference, not a pitch.
- **Moat:** the public record of **who actually pays winners, and how fast**. Every win we anchor and every repayment we witness is data nobody else collects. It becomes the pricing input for the market — which is the asset, not the interface.

**One line:** a hackathon win becomes cash today, not in 90 days.

---

## Two pools, structurally separate

This separation is the load-bearing design decision. Getting it wrong silently converts speculation into credit risk.

| | **Bridge lenders** | **Bettors** |
|---|---|---|
| **What they believe** | The builder repays, regardless of who won | The organizer pays out, conditional on outcome |
| **Risk they carry** | Credit risk — the builder defaults | Speculative — bounded at their stake |
| **Paid when** | The loan is repaid | The market resolves in their favor |
| **Absorb defaults?** | Yes, up to their position | **Never** |

Bettor capital must never fund a bridge loan, and a bettor must never absorb a hackathon that simply doesn't pay. That's not the bet they placed. The contract enforces this by keeping the two pools in separate accounting, and it is the first thing an auditor should check.

---

## Why we're onchain at all

Most of this could be a database with a payments integration. Exactly one part can't:

**Holding a borrower's collateral without a licensed intermediary.** A marketplace that custodies user funds needs a trust company, a licensed escrow agent, or marketplace registration. Code holds it without any of them. That's the difference between a marketplace and a marketplace that custodies.

Everything else — the verification pipeline, evidence collection, the public record, the leaderboard, the notification system — is deliberately off-chain, with only the final anchor on-chain. Push work off-chain until the absence of a trusted third party starts to matter.

---

## The loan

A builder wins. We anchor the win. They draw against it.

```
Builder wins hackathon
  └─ declareWin(hackathonId, prizeAmount)     → dated, public, verifiable
       └─ openLoan(...)                       → USDC to builder, atomically
            ├─ collateral locked (overcollateralized), or
            └─ first-loss tranche allocated
       └─ organizer pays out
            └─ settleLoan(...)                → lender repaid, collateral released
       └─ reputation updates automatically    → paid in full? how fast?
```

**Every loan is either overcollateralized or backed by a designated first-loss tranche.** This is not a policy preference — it is what makes "the platform never takes risk" true rather than aspirational. Overcollateralization is the cleanest form: default triggers liquidation, not a loss someone has to absorb. A builder chooses at origination.

**No multipliers.** Any leverage above 100x is a promise backed by someone other than the prize. With no multiplier, a routed prize splits by principal and the gap that would make the platform an implicit underwriter cannot exist.

---

## Credibility is derived, never assigned

There is no admin who sets a score. Credibility is computed from public payment history and nothing else:

- **Coverage** — wins where the win was covered in full
- **Speed** — average and best days-to-pay
- **Defaults** — loans taken and not repaid

One input, derived, hard to game. Every additional reputation input is another attack surface on the signal the whole strategy rests on. A builder who never pays loses credibility automatically, without anyone deciding they have.

**The market prices credibility; we don't.** That's why the credit-scoring subsystem gets deleted rather than repaired — bettors and lenders doing the pricing is the product, not a gap in it.

---

## Incentives are priced, not promised

Builders set their own terms within admin bounds:

- **Rate** — trade cost against speed
- **Duration** — how long they need
- **Incentives** — route your next prize through the rail, repay early, don't enter a competing hackathon, early-repay discount

An 8% rate for payout in 3 days instead of 90 isn't a liability the platform hopes someone fills. It's revenue, contracted. This is what replaces the old multiplier: an incentive with a named party funding it.

---

## Revenue

**Basis points of notional, charged to both sides** — an origination fee on the loan and a settlement fee on repayment.

Not a share of winnings. Not a spread on principal. A service charge on transactions we enable, taken atomically in the contract. That distinction matters legally: this is a lending business and an event-derivatives market, not escrow, and fee-on-notional is materially safer than fee-on-winnings precisely because it isn't a claim on the outcome.

---

## Why this is defensible

- **The record.** Who pays winners, and how fast. Open, composable, and impossible to reconstruct from a public chain — because the wins happen in private Discord servers and the payouts happen off-platform.
- **The two-sided market.** Lenders and bettors price different things and neither cross-subsidizes the other. The mismatch between them is the opportunity.
- **Exit.** A builder never needs our consent to stop borrowing. A lender never needs ours to be repaid.
- **Permissionlessness.** Any organizer can anchor a win. Any capital provider can fund a loan. Nothing requires a counterparty relationship with us.

---

## North Star

**Time-to-cash for a confirmed win.** Hours, not months.

Every metric we track — coverage rate, days-to-pay, loan volume — exists to answer one question: *do winners who use this rail get paid faster?* If yes, the rail is worth its spread. If no, nothing else matters.

---

## Explicitly not doing

- **Tokenisation** — deferred. It doesn't help the prove-it phase and creates a sybil incentive aimed directly at the credibility signal.
- **Platform underwriting** — never. Not as a temporary subsidy, not "just for early users."
- **Admin-assigned reputation** — never. If we can't derive it, we don't use it.