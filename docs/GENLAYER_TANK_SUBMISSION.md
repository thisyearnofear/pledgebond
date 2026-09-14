# PledgeBond — GenLayer Agent Tank Submission (Future of Work)

> **Work verified by consensus, paid on outcome.** PledgeBond milestones are
> judged by a GenLayer Intelligent Contract jury that reads real evidence and
> reaches LLM consensus on-chain — no oracles, no trusted admin.

## 1. Track

**Future of Work** — *"Work verified by consensus, paid on outcome, with
portable reputation."* That sentence is PledgeBond's product: builders ship
milestones, a decentralized jury confirms delivery, payouts unlock, and the
verdict compounds into portable reputation.

(Reserve angle: **Onchain Justice** — *"Escrow released when a deliverable
meets machine-readable terms."* The same contract covers it; the appeal path
via `challenge()` is the auditable-appeal story.)

## 2. The integration (GenLayer is load-bearing, not decorative)

```
Builder marks milestone complete (+ public evidence URL)
  → POST /api/genlayer/submit → MilestoneArbiter.submit_and_resolve()
    → Validators independently fetch the evidence (gl.get_webpage — no oracle)
    → LLM consensus (eq_principle comparative) → DELIVERED / NOT_DELIVERED / INCONCLUSIVE
      → Verdict stored on-chain, attested into Firestore (provider: 'genlayer')
        → Underwriter prices credit with verdict as input (+15 / −25 / 0)
          → Project page + Agents tab render the jury card; payout unlock references the GenLayer tx
```

What GenLayer does that Solana/EVM cannot: fetch live web evidence and reason
over ambiguity inside consensus. The jury reads the actual PR/deliverable —
not a hash someone else asserted about it.

## 3. Contract

- Source: `genlayer/contracts/milestone_arbiter.py` (Python, `gl.contract`)
- Deploy: Studio → address recorded below + in `genlayer/DEPLOY.md`
- Methods: `submit_milestone` → `resolve_milestone` (jury) → `challenge` (appeal);
  `submit_and_resolve` convenience for the demo; `get_milestone` / `get_verdict` / `get_total` views
- Verdicts: `DELIVERED / NOT_DELIVERED / INCONCLUSIVE` + confidence + one-sentence reason

| Item | Value |
|---|---|
| Contract address (testnet) | `TBD — paste after Studio deploy` |
| Studio link | `TBD` |
| Seeded DELIVERED tx | `TBD` |
| Seeded NOT_DELIVERED tx | `TBD` |

## 4. Backend wiring

- `frontend/src/services/GenlayerVerdictService.ts` — transport is plain
  JSON-RPC over `GENLAYER_RPC_URL` (no new SDK dep); `GENLAYER_MOCK=true` (or
  unset RPC URL) runs the full flow offline through the identical interface.
- `POST /api/agent/analyze` with `type: 'genlayer_verdict'` — Underwriter
  entry point; returns `{ genlayer: verdict, creditSignal, summary }`, never
  500s (degrades to `genlayer-error` payload).
- `POST /api/genlayer/submit` — submit + resolve + record
  `provider: 'genlayer'` attestation in `payoutAttestations` + activity log.
- `GET /api/genlayer/verdict?milestoneId=` — read path for UI polling.
- `VerificationResult.provider` extended with `'genlayer'`; credit mapping
  `toCreditSignal`: DELIVERED +15 / NOT_DELIVERED −25 / else 0.

## 5. UI (stakeholder-designed — see §7)

- `GenlayerVerdictCard` — ProofBadge-grammar pill (gold shimmer only for
  HIGH-confidence DELIVERED), reason quote, `live jury` / `preview`
  provenance pill, `How was this decided?` progressive disclosure
  (evidence + contract + tx + method). Contract link hidden in preview.
- Project page: jury auto-resolves from the first claim's public evidence URL;
  card renders under the first hackathon claim; persisted `jury*` fields feed
  the new `jury-verified` ProofBadge (ScaleIcon) via `computeProjectBadges`.
- `/back?tab=agents&mode=jury`: `GenlayerDemoPanel` as a first-class lazy-loaded
  Jury mode tab (default for `agentsHref()`) — preset tabs (Delivered /
  Not-delivered) with expectation hints, narrated 3-step loading
  (Fetching evidence → Validators voting → Consensus), verdict card inline.
- `SourceBadge` now renders `genlayer` → "Jury" and `genlayer-mock` →
  "Jury Preview"; `claim_verification` responses carry `source: 'genlayer'`
  when the jury confirms delivery.

## 6. Demo exact path (steward-verifiable, ≤4 steps)

1. Open `/back?tab=agents&mode=jury` → **⚖️ Jury** tab → `Resolve on GenLayer`
   (or open the seeded demo project page — verdict resolves automatically).
2. Jury fetches the merged-PR evidence, validators reach consensus (~1–2 min
   live; instant in mock mode).
3. Card flips to **DELIVERED (HIGH)** with reason quote + contract link;
   Underwriter summary gains **credit +15**.
4. Payout unlock line references the GenLayer tx hash. Flip the preset to
   Not-delivered to show the −25 path.

Seed: `node scripts/seed-genlayer-demo.js --confirm` writes
`projects/genlayer-milestone-jury-demo` (Future of Work claim + public
merged-PR evidence URL).

## 7. Product design rationale (stakeholders)

- **Builders** need reassurance, not machinery: the card reads as a verdict
  badge ("Jury: Delivered"), not a consensus whitepaper. Mock/live provenance
  is always labeled — trust is the product.
- **Backers** need the credit consequence: the `+15 / −25` signal sits next to
  the verdict, one glance from verdict → backing decision.
- **Stewards/judges** need verifiability: contract link, tx hash, evidence
  link, and a 4-step path are all one click from the card. Nothing to take on
  faith.
- **Delight, honestly earned:** gold shimmer only on HIGH-confidence
  DELIVERED (matches ProofBadge tier language); loading state narrates the
  jury ("Fetching evidence → validators voting → consensus") instead of a
  dead spinner.

## 8. Submission checklist

- [ ] Contract deployed on testnet; address + Studio link pasted in §3
- [ ] Two seeded milestones resolvable in Studio alone
- [ ] Demo project seeded (`seed-genlayer-demo.js --confirm`)
- [ ] 90-sec video (Studio consensus logs + UI flip, both presets)
- [ ] Tank form: track = Future of Work, repo link, contract links, website deep link

