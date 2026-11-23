# MultiHopper Build & Route Challenge Plan

> **Status:** product slice built (Phases 1–3, mock adapter). No MultiHopper
> production onboarding or qualifying transaction volume exists yet. Do not
> submit to Superteam Earn until the real integration is verified and the
> production-volume gate is plausibly met.
>
> **Listing:** [MultiHopper Build & Route Challenge — up to $50,000 + revenue
> share](https://superteam.fun/earn/listing/multihopper-build-and-route-challenge-up-to-dollar50000-revenue-share-1)
> (Superteam Earn). Winner announcement scheduled for **December 28, 2026**.

## Why PledgeBond fits

PledgeBond already owns the problem of paying hackathon winners and proving that
payout happened. The core product is a liquidity rail for confirmed wins; the
challenge wedge is a narrower payout product:

> **Verified payout routing for hackathon prizes, grants, and agent work.**

A sponsor, organizer, or funded program has a real obligation to pay one or more
recipients. PledgeBond supplies the recipient evidence, claim state, approval
rules, and reconciliation. MultiHopper supplies the Solana transfer route. The
result is a payout the sponsor can execute and the recipient can verify.

This is different from asking small agent-API payments to create volume. A single
real payout campaign can exceed the challenge threshold; $1 x402 calls cannot.

## Why this matters beyond the challenge

The payout router is not only a bounty entry — it is the **sponsor-led path into
the credibility record** the whole strategy rests on (see
[VISION.md](./VISION.md), "Why we're onchain at all" and "defensible").

Every settled campaign produces the ground truth the rail needs: a dated,
verifiable `paidAt` for a named payer, at cohort scale. Bootstrapping that
record borrower-first means waiting for organizers to pay at their own pace;
routing the payout ourselves means the record is written by the flow of money,
not reconstructed after the fact. Sponsor-side also fixes the unit economics:
one organizer paying a cohort of winners is a bigger check than any single
builder's bridge loan, and the integration revenue share (below) is fee-on-
transaction revenue that fits the monetization rule — we never touch principal,
never underwrite.

Sequencing implication: sell the payout rail to whoever pays, let the record
accumulate, then open the credit market on top of data we generated. The
challenge's volume gate happens to force exactly this discipline.

## Challenge economics (from the listing)

- **Integration revenue share:** customers pay a 0.5% percentage fee on
  full-rate transfers; half goes to the integrator — **0.25% of qualifying
  full-fee volume** (~$2,500 per $1M routed). Revenue share does not depend on
  winning; partner onboarding and agreed terms apply.
- **Prize pool:** $5,000 guaranteed, growing with aggregated qualifying volume —
  +$1,000 per additional $400,000; $4M → $10,000; $8M → $20,000; $11M → $27,000;
  $20M aggregate across all entrants → the full $50,000.
- **Allocation:** the top three eligible products split the funded pool in
  proportion to their qualifying volume — a competition top-up, not a 1:1 match.
- **Draft-terms caveat:** the listing notes the initial $5,000 award is
  conditional on $2M aggregate qualifying volume and that variable,
  volume-proportional award mechanics were still being confirmed with Earn.
  Treat published prize fields as indicative until finalized.

## Challenge constraints that shape the product

- **Production volume only.** Devnet, testnet, and demo transactions do not
  count.
- **Minimum qualifying volume:** $100,000 through the MultiHopper-integrated
  product, during the common measurement window. Below it, no qualification.
- **How volume is measured:** qualifying volume = collected MultiHopper
  percentage fees ÷ 0.0025. Discounted transfers count proportionally.
  Principal is counted once — hops and Multi-Send recipients never multiply it.
- **Genuine use required.** Circular transfers, refunded/free/failed transfers,
  devnet activity, and prize-farming volume are excluded. Treasury movements
  need a verifiable business purpose.
- **Submission is blocked until integrated.** Do not submit a project that only
  has this plan. Integration plus production onboarding must be complete first.
- **Ranking:** verified, fee-adjusted transaction volume; product quality and
  repeat usage break ties.
- **Compliance is built in.** MultiHopper is a TRM Labs partner; screening is
  integrated at the smart-contract level — use it rather than parallel claims.
- **Submission evidence:** live product URL, demo video, repository access,
  technical docs, registered integration identifier, transaction evidence,
  traction metrics, qualifying-volume summary, and genuine customer/use-case
  evidence (sensitive customer evidence goes privately to the review team).

## Product slice

**PledgeBond Payout Router**

1. A sponsor or organizer creates a payout campaign with a funding source,
   recipient list, evidence requirements, and approval rules.
2. PledgeBond verifies the recipient claim and records the payout instruction.
3. MultiHopper routes the approved SOL/USDC payout, optionally through Multi-Send
   or programmable route parameters where those fit the flow.
4. PledgeBond records the route status and transaction evidence.
5. Recipients see payout status; sponsors see reconciliation and exceptions.
6. The existing payout-verification and leaderboard surfaces can consume the
   completed payout as evidence, without pretending routing alone proves a claim.

The first slice should be **one funded campaign**, not a general payout
marketplace.

## Where MultiHopper belongs

MultiHopper should be the transfer/routing rail after PledgeBond has decided a
payment is due:

```text
payout campaign
  -> recipient/claim verification
  -> approval rule passes
  -> MultiHopper route is created
  -> transfer settles on Solana mainnet
  -> tx evidence + route status written back
  -> payout ledger / leaderboard / agent surfaces consume the result
```

Do not use routing as a privacy claim. Public Solana history remains public;
MultiHopper reduces simple linkage, but it does not erase provenance or guarantee
anonymity.

## Reusable surfaces

- `PayoutVerifierService` — verify completed SOL/USDC transfers and attach proof
  to claims.
- `HackathonRegistry` / payout-lead pipeline — establish why a payment was due
  before it is routed.
- Firestore `activities` — surface `payout_routed`, `payout_settled`, and
  exception events.
- Agent payment surface — expose payout status or sponsor reporting through the
  existing authenticated agent/API layer where appropriate.
- Leaderboard — reflect verified payout events after settlement; never infer
  credibility from a route request alone.

## Go / no-go gate

The deciding question is:

> **Can one real sponsor or program route $100,000+ through PledgeBond during
> the measurement window?**

Proceed only if at least one is true:

- a hackathon organizer will route a real prize distribution,
- a grant/agent-work sponsor will route contributor payouts,
- an existing customer has a treasury or supplier-payment need,
- a partner already has Solana payout volume that needs verification and
  reconciliation.

If no credible volume source exists, do not build a thin wrapper hoping traffic
appears. A technically integrated product with no qualifying volume will not
qualify.

## Candidate first customers

Rank by ability to produce real volume, not ease of pitching:

1. **Hackathon/grant organizer** paying a cohort of winners.
2. **Agent-service sponsor** paying verified contributors, annotators, or bounty
   claimants.
3. **OSS funding program** paying maintainers or project teams.
4. **Agent treasury operator** that needs policy-gated recurring transfers.

Do not count user-owned treasury shuffling unless the sponsor can document a
real business purpose.

## Build plan

### Phase 0 — volume and onboarding validation

- Contact MultiHopper through the builder community and request API access,
  production onboarding requirements, and a registered integration identifier.
- Confirm the measurement window, qualification rules, and which route types are
  counted.
- Confirm whether Multi-Send, custom routing, and percentage-fee collection are
  available for this product shape.
- Identify one sponsor/use-case with a credible path to $100,000+.
- Freeze a small, non-speculative recipient set for the first campaign.

### Phase 1 — payout campaign model

**Built:** `payoutCampaigns` collection + `src/lib/payoutCampaigns.js` domain
module; `GET/POST /api/payout-campaigns` and `GET/PUT /api/payout-campaigns/[id]`
(enforces the transition map — sponsors drive draft/funding/cancel, approval is
rule- or admin-driven).

- Add a `payoutCampaign` record: sponsor, title, asset, recipients, amount,
  evidence URL, approval state, route state, settlement evidence.
- Reuse the existing claim/evidence model where possible; do not create a
  parallel verification concept.
- Add campaign status: `draft`, `awaiting_funding`, `approved`,
  `routing`, `partially_settled`, `settled`, `exception`, `cancelled`.
- Keep sponsor-held funds non-custodial where possible; PledgeBond should create
  and track the route, not absorb or rehypothecate funds.

### Phase 2 — MultiHopper adapter

- Implement a small service boundary around MultiHopper rather than scattering
  API calls through routes/components. **Built:** `src/services/MultiHopperService.ts`
  — `createRoute` / `getRouteStatus` / `isConfigured`; the real API surface is
  provisional until production onboarding confirms endpoints and fields.
- Store only the registered integration identifier, route identifiers,
  destination wallet addresses, public tx signatures, status, and failure data.
- Never store MultiHopper secrets in client env vars or committed config.
- Fail closed on onboarding, screening, route creation, or settlement errors.
- Map MultiHopper route IDs and transfer signatures back to the payout campaign.

**Environment (server-only, never `NEXT_PUBLIC_`):**

| Var | Purpose |
|---|---|
| `MULTIHOPPER_API_URL` | API base (default `https://api.multihopper.io/v1` — confirm at onboarding) |
| `MULTIHOPPER_API_KEY` | Bearer credential from MultiHopper onboarding |
| `MULTIHOPPER_INTEGRATION_ID` | Registered integration identifier (submission evidence) |
| `MULTIHOPPER_MOCK` | `1` forces the mock adapter (demo/dev); production with no key fails closed |

### Phase 3 — UI and reconciliation

**Built:** `/payouts` (list), `/payouts/new` (create), `/payouts/[id]` (sponsor
console with status actions + per-recipient transfer table). Recipient-facing
view at `/payouts/[id]?wallet=<addr>` — sanitized projection, no auth, no
sponsor-private data. `payout_routed` / `payout_settled` / `payout_exception`
activities flow into the sponsor's notification feed. Reconciliation runs via
`GET /api/payout-campaigns/[id]/route` (also auto-polled while routing).

- Add a sponsor-facing campaign page: recipients, amounts, approval state,
  route status, and tx evidence.
- Add recipient-facing status without exposing sponsor-private data.
- Reuse notifications/activity for `payout_routed`, `payout_settled`, and
  `payout_exception` events.
- Add a reconciliation report suitable for submission evidence and private
  customer review. **Not yet built** — the volume ledger/report remains open.

### Phase 4 — production campaign

- Run one mainnet campaign only after MultiHopper production onboarding.
- Preserve a machine-readable volume ledger: principal, fees, route IDs,
  signatures, timestamps, recipient counts, excluded transfers, and business
  purpose.
- Exclude non-qualifying activity explicitly rather than inflating totals.
- Record a short demo video showing a real route and settlement evidence.

## Evidence checklist

Before Superteam Earn submission:

- [ ] MultiHopper production onboarding completed
- [ ] Registered integration identifier issued
- [ ] Live product URL deployed
- [ ] One real sponsor/use-case verified
- [ ] $100,000+ qualifying volume documented or a clear decision not to submit
- [ ] Route IDs and Solana transaction signatures collected
- [ ] Qualifying-volume summary reconciled against collected fees
- [ ] Genuine customer/use-case evidence prepared
- [ ] Technical documentation updated
- [ ] Demo video recorded
- [ ] Repository review access ready
- [ ] Submission made only through Superteam Earn

## Success metrics

- qualifying full-rate volume routed
- count of distinct recipients paid
- percentage of approved payouts that settle successfully
- median time from approval to settled transaction
- exception/refund/failure rate
- repeat sponsor intent
- integration revenue at 0.25% of qualifying full-fee volume

## Risks

- **No volume source:** the largest risk; solve before implementation.
- **Cosmetic integration:** MultiHopper must move real payout funds, not just
  appear in the UI.
- **Prize-farming:** do not route self-owned, circular, or synthetic transfers.
- **Compliance:** payout recipients and sponsor purpose must be documented;
  use MultiHopper's built-in screening rather than adding parallel claims.
- **Custody creep:** PledgeBond should orchestrate and verify payouts, not
  quietly become the custodian of sponsor funds.
- **Claim inflation:** a settled route proves money moved; it does not prove a
  project claim was deserved. Keep transfer evidence and claim verification
  separate.
- **Deadline compression:** production onboarding and a real campaign matter more
  than a broad feature surface.

## Decision

PledgeBond is a plausible MultiHopper candidate **only if** the payout router is
attached to a real sponsor or program. The first milestone is not code; it is
confirming a credible path to $100,000 of genuine Solana mainnet payout volume.

Strategically, the payout router is worth building even if we never qualify —
a sponsor-paid cohort is the fastest way to accumulate the verified `paidAt`
record that prices the credit market. The challenge simply sets the deadline
(**December 28, 2026**) and pays for the integration work if volume materializes.
