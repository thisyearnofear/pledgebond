# PledgeBond — Product Vision

> **Capital infrastructure for builders — from idea to milestone to ship.**

PledgeBond is a chain-agnostic capital stack for software builders. It pairs **on-chain credit** with **community-backed tokens** and an **AI agent layer** that prices, scouts, and verifies work. Backers earn from successful shipping; builders get capital matched to their stage; agents earn margin per call.

---

## The Wedge

**Builders are businesses; their track record is underwritable collateral.** A verified hackathon win creates two assets no existing lender can see: a receivable (the prize the organizer owes) and a track record of shipped, verified work. PledgeBond makes both legible — and prices them.

- **Secret:** hackathon winners are creditworthy but invisible to every existing lender. Banks can't underwrite a $2k prize receivable; crypto credit protocols only know overcollateralization. Neither reads a builder's track record as collateral.
- **Beachhead:** hackathon winners are a small, overlooked, uncontested market — own it completely, then expand: hackathon winners → open-source maintainers → freelancers/creators. Anyone with verifiable output and no credit file.
- **10x:** human underwriting of a $2k receivable costs more than $2k. Our agents underwrite for $0.05/call, and Arc's ~$0.01 USDC fees make micro-credit settlement economical for the first time.
- **Moat:** the verified payout ledger. Every claim we verify (evidence URLs, on-chain payout confirmation) is data nobody else collects — each entry improves our underwriting and raises the cost of fast-following. The unscalable verification work is the moat.

**One line:** we turn a hackathon win from a trophy into a receivable — and the receivable into credit.

The agents are the builder's underwriting department: the Underwriter prices credit against verified history, the Verifier confirms milestones and payouts, and agent-to-agent x402 payments settle on Arc before funds move.

---

## The Capital Stack

We provide three rails — most builders will use one, mature builders will use all three.

### Rail 1 — Bags Token (Pre-prize / community capital)
For builders who don't yet have a hackathon prize pipeline or contractual milestones.
- **Instrument:** project-specific token launched on Bags (Solana).
- **Capital source:** community buyers, fee-share holders.
- **Backer yield:** continuous — fee-share % of trading volume.
- **Risk:** market-driven; no principal guarantee.
- **When recommended:** early-stage, narrative-driven, creator-adjacent projects.

### Rail 2 — x402 Credit Line (Mid-stage / milestone capital)
For builders shipping toward concrete deliverables.
- **Instrument:** USDC credit line collateralized by future hackathon prizes & milestone evidence.
- **Capital source:** backers staking USDC at 1.5x / 2x / 3x multipliers.
- **Privacy option:** Cloak shielded transfers hide stake amounts and counterparties from the public Solana ledger.
- **Backer yield:** principal + multiplier on prize repayment.
- **Risk:** repayment-driven; tied to milestone verification.
- **When recommended:** projects with verifiable milestones and prize pipelines.

### Rail 3 — Hackathon Prize Routing (Settlement)
For builders winning prizes through registered hackathons.
- **Instrument:** prize escrow + auto-routed repayment.
- **Capital source:** hackathon organizers.
- **Backer yield:** repayment of credit + multiplier.
- **When recommended:** any project that wins a registered hackathon prize.

```
       ┌──────── Pre-prize ────────┐    ┌──── Mid-stage ────┐    ┌── Settlement ──┐
       │                           │    │                   │    │                │
       │   Rail 1: Bags Token      │ →  │  Rail 2: x402     │ →  │  Rail 3: Prize │
       │   (Solana, fee-share)     │    │  Credit Line      │    │  Routing       │
       │                           │    │  (Arc, USDC)      │    │  (any chain)   │
       └───────────────────────────┘    └───────────────────┘    └────────────────┘
```

**The rails are composable, not exclusive.** A builder might launch a Bags token to bootstrap community, then open an x402 credit line once they qualify for a hackathon, then have prize wins auto-route to repay backers. The agent layer recommends which rail(s) fit the project's stage.

---

## The Agentic Layer (cross-rail)

Three AI agents price, scout, and verify across all three rails. Each charges via x402 nanopayments on Arc. Each agent has a `.sol` domain identity (e.g., `pledgebond-scout.sol`) via Solana Name Service, providing human-readable on-chain identity that makes the system legible to users and ecosystem participants.

When QVAC (Tether's local-first AI SDK) is available, agent inference runs on-device — project data never leaves the user's machine. This aligns with the platform's decentralization philosophy: no central point of failure, no third-party data exposure. When QVAC is not installed, the existing cloud provider chain (Featherless AI -> AIsa Perplexity Sonar) handles inference.

| Agent | Rail 1 (Bags) output | Rail 2 (Credit) output | Rail 3 (Prize) output |
|---|---|---|---|
| **Underwriter** ($0.05) | Token launch params (initial buy, fee split, supply curve) | Credit line size, interest rate, collateral ratio | Prize-win probability, expected payout |
| **Scout** ($0.01) | Pre-launch alpha — high-potential repos | Backable projects matching backer thesis | Prize-pool-relevant hackathons |
| **Verifier** ($0.001/10 LOC) | Milestone confirmation → triggers fee-share buyback | Milestone confirmation → unlocks tranche | Code authenticity for prize claim |

The agents are the same product across rails; their output is the dual-instrument intelligence that makes the capital stack legible.

---

## Why this is one product, not two

| Concern | How the dual rails reinforce each other |
|---|---|
| **Builder funnel** | Bags handles top-of-funnel (no prize pipeline needed); x402 credit handles mid-funnel (qualified milestones); prizes handle bottom-of-funnel (settlement). One product, three stages. |
| **Backer choice** | Backers pick risk profile: yield-style (Bags fee-share) or repayment-style (x402 credit). Same dashboard, different positions. |
| **Reputation** | A builder's track record across rails compounds — token holder graph + repayment history + verified milestones = stronger than any single signal. |
| **Agent leverage** | The same Underwriter/Scout/Verifier sells more SKUs without more model work. Margin scales with rail count. |
| **Switching cost** | A builder using two rails has 2x the data anchored to PledgeBond — switching means rebuilding both. |

---

## Multi-Ecosystem, Preference-Aware

PledgeBond is **chain-agnostic**. Rail 1 (Bags) is Solana-native today; Rail 2 (x402 credit) runs on Arc; Rail 3 (prize routing) supports 7 EVM ecosystems plus Solana.

We never hide ecosystems a user hasn't picked. Instead, we **infer preference** from connected wallet, onboarding choice, and recent activity, then **accentuate** matching rails:

- A Phantom-connected user lands on a homepage where Bags Boost CTAs are featured first.
- A MetaMask-connected user lands on a homepage where x402 credit lines are featured first.
- Both users see all rails — the *order* and *prominence* differ.
- Users can pin a primary ecosystem in profile settings.

See [BAGS_SOLANA.md → Ecosystem-Agnostic, Preference-Aware UX](./BAGS_SOLANA.md#ecosystem-agnostic-preference-aware-ux) for implementation detail.

---

## Monetization Alignment

The three revenue streams in [MONETIZATION_STRATEGY.md](../MONETIZATION_STRATEGY.md) map onto the capital stack:

| Revenue Stream | Rail | Notes |
|---|---|---|
| **AI Agent fees** ($0.001–$0.05/call) | All three | Cross-rail — same agents, more SKUs |
| **Marketplace fees** (2% of backings) | Rail 2 | Charged on successful repayment |
| **Token launch + fee-share %** | Rail 1 | New: recurring trading-volume revenue |
| **Prize routing fee** (TBD) | Rail 3 | Optional — only if escrow used |
| **Premium tiers** ($9 / $49 / Custom) | All three | Unlocks unlimited agent calls + team features |

Every dollar of revenue corresponds to a builder/backer outcome. We earn when the stack works.

---

## North Star

**Revenue per Successful Project.** A successful project is one where:
- a backer is repaid (Rail 2/3) **or** earns sustained fee-share yield (Rail 1), **and**
- the builder ships verified milestones, **and**
- the agent layer's predictions matched the outcome (calibrating future recommendations).

Hitting that target on any rail is a win. Hitting it across rails is the moat.
