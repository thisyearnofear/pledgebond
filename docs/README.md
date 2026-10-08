# PledgeBond

A liquidity rail for hackathon winners — paid in hours, not 90 days.

> **Read first:** [VISION.md](./VISION.md) is the product source of truth — the wedge, the two-pool separation, and the invariants. [MONETIZATION_STRATEGY.md](./MONETIZATION_STRATEGY.md) covers how fees are taken. To see the whole thing move real money, run the [live demo walkthrough](./DEMO_WALKTHROUGH.md).

## How it works

1. A builder wins a hackathon and the win is anchored on-chain via `declareWinner` — a dated, public claim on money that hasn't moved yet.
2. They **draw a bridge loan** against that claim, choosing their own rate and duration within bounds. Overcollateralized or backed by a first-loss tranche — the platform never carries the loss.
3. When the organizer pays out, `recordPayout` closes the loop: the loan is repaid, collateral released, and the builder's public payment history updated.
4. Alongside the loan, a **market** on whether each declared win will actually be settled. Bettors are held in a pool structurally separate from lending capital — they never fund a loan or absorb an organizer's default.

Credibility is **derived** from that payment history — coverage, speed, defaults. No admin assigns it. No credit scores, no multipliers.

## Architecture

```
/
├── frontend/             # Next.js app
│   └── src/
│       ├── components/   # UI components
│       ├── config/       # Environment config
│       ├── contexts/     # React context providers
│       ├── hooks/        # Custom hooks
│       ├── lib/          # Integrations (LiFi, Dune, GitHub analytics, Arc payment middleware, badges)
│       │   └── badges/   # Client-side badge inference (computeBadges.js)
│       ├── pages/        # Next.js pages + API routes
│       ├── services/     # Business logic (Circle, SNS identity, QVAC local AI)
│       └── utils/        # Utilities
│
├── blockchain/           # Hardhat workspace (UUPS upgradeable contracts)
├── snap-server/          # Hono-based Farcaster Snap server
└── docs/                 # Documentation
```

## Current Arc Agent UX

The main happy path is now:
1. Open **Back → Discover**
2. Run **Scout** or open **AI Agents**
3. Pay with USDC on Arc (or enable test mode to skip payments)
4. Review the returned `status`, `resultSource`, and `nextAction`
5. Decide whether to back the project

The UI now avoids ambiguous progress states and makes it clear when a result came from:
- live AI
- cache
- rule-based logic
- fallback logic
- test mode (when explicitly enabled)

## Payout Verification & Hackathon Leaderboard

A complete payout verification system and hackathon leaderboard that turns time-to-payout into a competitive signal.

### Architecture

```
PayoutVerifierService.ts     # 4-provider verification (Circle API, EVM, Solana, GenLayer jury)
payout-verify.js             # POST /api/agent/payout-verify (single + batch)
analyze.js                   # claim_verification type — rule-based signals + on-chain proof
                             # genlayer_verdict type — MilestoneArbiter jury verdict + credit signal
genlayer/submit.js           # POST /api/genlayer/submit — jury resolve + attestation
genlayer/verdict.js          # GET /api/genlayer/verdict — read path for Underwriter + UI
payoutAttestations           # Firestore collection storing attestation records
leaderboard.js               # /leaderboard page with 3 tabs (Builders / Backers / Hackathons)
hackathons/leaderboard.js    # GET /api/hackathons/leaderboard — aggregation + composite score
ClaimVerificationBadge       # Green/amber/red badge on project detail hackathon claims
GenlayerVerdictCard          # Jury verdict pill (ProofBadge language) + reason + links
```

### Verification Providers

| Provider | Method | What it Checks |
|----------|--------|----------------|
| **Circle API** | `verifyCircleTransfer()` | Transaction status, amount match (±0.01 USDC), recipient match, `complete`/`paid` status |
| **EVM (raw RPC)** | `verifyOnChainTransfer()` | Parses `Transfer` event logs from `eth_getTransactionReceipt`, decodes recipient + amount, cross-references USDC address per chain |
| **Solana** | `verifySolanaTransfer()` | Scans `preTokenBalances`/`postTokenBalances` for USDC mint changes to recipient wallet |

### Hackathon Leaderboard Scoring

Composite score for each hackathon:

- **With payout data:** `payoutSpeedScore × 0.35 + completionScore × 0.30 + builderScore × 0.20 + volumeScore × 0.15`
- **Without payout data:** `completionScore × 0.40 + builderScore × 0.35 + volumeScore × 0.25`

Payout speed color coding: ≤7d lightning, ≤30d fast, ≤90d moderate, >90d slow. Cached 5 min (stale-while-revalidate 10 min).

### Verification Badge States

| Credibility | Badge | Meaning |
|-------------|-------|---------|
| High | Green check | On-chain proof + wallet match + agent attestation |
| Medium | Amber shield | Partial proof (e.g., URL claim only) |
| Low | Red shield | No verifiable evidence |
| Loading | Gray pulse | Verification in progress |
| Jury Delivered | Gold badge | GenLayer consensus: deliverable confirmed (HIGH confidence) |
| Jury Not-delivered | Red badge | GenLayer consensus: no deliverable found |
| Jury Inconclusive | Amber badge | GenLayer consensus: insufficient public evidence |

### Leaderboard Trust Gate

Claims with `verificationStatus: "pending"` or missing `evidenceUrl` are excluded from the public leaderboard. Only claims with `verificationStatus` of `payout_verified` or `evidence_attached` (with a real `evidenceUrl`) surface publicly. This ensures unverified self-attested wins never appear on leaderboards that winners' peers and backers read.

Sharing lives in [GROWTH.md](./GROWTH.md): personalized OG cards (`/api/og/leaderboard`), `?ref=` deep links, and the K-factor measurement plan.

### Payout Verification Flow (End-to-End)

1. Payout lead submitted via `PayoutLeadForm` → `payoutLeads` collection
2. Daily cron (`/api/payout-leads/process`) processes leads with evidence URLs → creates project claims with `verificationStatus: "pending"`
3. Cron's second pass calls `PayoutVerifierService.verify()` on claims with `payoutTxHash` or `circleTransferId`
4. Verified payouts upgrade to `verificationStatus: "payout_verified"` with `payoutVerifiedAt` + `payoutActualAmount`
5. Builder receives "🎉 Payout verified!" notification with amount and project link
6. Only verified claims surface on the public leaderboard

### GenLayer Jury (Agent Tank — Future of Work)

Decentralized milestone verdicts via the `MilestoneArbiter` Intelligent Contract
(Python, GenLayer testnet). Validators fetch public evidence URLs and reach LLM
consensus — no oracle. Full brief: [GENLAYER_TANK_SUBMISSION.md](./GENLAYER_TANK_SUBMISSION.md).

```
GenlayerVerdictService.ts      # RPC client + toCreditSignal (+15 / −25 / 0), GENLAYER_MOCK offline mode
api/genlayer/submit            # POST — submit + resolve + provider:'genlayer' attestation
api/genlayer/verdict           # GET ?milestoneId= — read path for Underwriter + UI
api/agent/analyze              # type:'genlayer_verdict' — Underwriter entry point (never 500s)
GenlayerVerdictCard            # Badge-style verdict pill + reason + evidence/contract links
GenlayerDemoPanel              # /back?tab=agents one-click demo (Delivered / Not-delivered presets)
```

| Provider | Method | What it Checks |
|----------|--------|----------------|
| **Circle API** | `verifyCircleTransfer()` | Transaction status, amount match (±0.01 USDC), recipient match, `complete`/`paid` status |
| **EVM (raw RPC)** | `verifyOnChainTransfer()` | Parses `Transfer` event logs from `eth_getTransactionReceipt`, decodes recipient + amount, cross-references USDC address per chain |
| **Solana** | `verifySolanaTransfer()` | Scans `preTokenBalances`/`postTokenBalances` for USDC mint changes to recipient wallet |
| **GenLayer jury** | `resolve_milestone()` | Validators fetch evidence URL + LLM consensus → DELIVERED / NOT_DELIVERED / INCONCLUSIVE + confidence + reason |

### Notification System

Activities written to the `activities` collection are polled by `useNotificationFeed` (60s interval) and transformed into in-app notifications:

| Activity type | Notification | Recipient | Trigger |
|---|---|---|---|
| `winner_verified` | 🏆 You're a Verified Winner! | Builder | Admin approves claim |
| `loan_opened` | 💰 Loan opened | Builder | Bridge loan drawn against a declared win |
| `payout_verified` | 🎉 Payout verified! | Builder | Cron confirms payout on-chain |
| `project_submitted` | 🚢 Project shipped! | Builder | Project submission |
| `payout_processed` | 💰 Payout secured! | Builder/Lender | Prize recorded as paid |
| `follow` | 👥 New follower | Builder | Follow event |

### Self-Verification

A builder cannot declare their own win as credible evidence about themselves — the derived-credibility model depends on the win being independently evidenced. This is enforced in `HackathonRegistry.declareWinner` / `recordPayout` (host or admin only). The legacy `ErrorCode::SelfVerificationNotAllowed` guard lived in the retired Solana credit-line program; the EVM rail is the only enforcement path now.

### Activity Logging

`POST /api/activity/log` — authenticated, allowlisted-types-only endpoint for client-initiated activity logging. Activity types were retired with the credit model; `backing_received` no longer exists. Recipient must differ from the actor.

### Badge System

Client-side inference layer that derives achievement badges from existing project and user data. No backend changes needed.

```
lib/badges/computeBadges.js        # Pure computation functions
components/common/ProofBadge.js     # Presentation components (badge + group)
hooks/useBadgeNotification.js     # Toast notifications for newly earned badges
lib/analytics.js                  # trackEvent utility for badge/onboarding/sharing analytics
```

**Builder badges:** Verified Winner, Multi-Ecosystem, Prolific, Proof-Backed, Community Trusted, High Velocity.
**Project badges:** Proof Complete, Verified Win, Multi-Hackathon, High Evidence, Fast Shipper.
**Leaderboard badges:** Rank-based tiers (gold/silver/bronze) for each leaderboard category.

Rendered on builder dashboard (`/build`), public portfolio (`/u/[username]`), project detail pages, and leaderboard entries.

**Follower count integration:** `BuilderProjectGrowth` fetches live follower count from `/api/follows` and passes it to `computeBuilderBadges`, so the Community Trusted badge tiers accurately reflect social proof.

**Analytics events:** `badge_viewed`, `onboarding_banner_dismissed`, `leaderboard_share_clicked` — tracked via `lib/analytics.js` using `navigator.sendBeacon` in production.

### Key Frontend Routes

| Route | Who | What |
|-------|-----|------|
| `/` | Everyone | Landing page with leaderboard strip |
| `/explore` | Everyone | Project discovery |
| `/back` | Backers | Backer workspace: portfolio, AI analysis, discover |
| `/build` | Builders | Builder dashboard: project submission, bridge-loan positions, badges |
| `/leaderboard` | Everyone | Builder / Backer / Hackathon rankings with shareable OG images |
| `/analyze` | Everyone | Standalone AI project analysis |
| `/profile` | Everyone | User profile with credentials and portfolio |
| `/u/[username]` | Everyone | Public builder portfolio with badges |
| `/compare` | Everyone | Side-by-side project comparison |
| `/login` | Everyone | Role picker + GitHub + wallet auth |
| `/admin/verification` | Verifiers | Milestone verification dashboard |

## Smart Contract Architecture

### Solana (retired)

The legacy Anchor program (`blockchain-solana/`) implemented the previous
credit-line model — credit lines, backing multipliers, milestone vaults, a
protocol treasury. It was deleted with the liquidity-rail pivot; see
[`docs/VISION.md`](VISION.md) for the target model and git history for the
program. What remains on the Solana side is the
`PayoutVerifierService` Solana transfer scan.

### EVM (Solidity): UUPS Upgradeable

`LiquidityRail` is deployed behind an OpenZeppelin UUPS proxy. `initialize(registry, usdcToken, admin, feeRecipient)` replaces the constructor pattern. `_authorizeUpgrade()` is gated to `DEFAULT_ADMIN_ROLE`.

Because it's UUPS, `DEFAULT_ADMIN_ROLE` can upgrade the contract to arbitrary code. It should be held by a multisig, never a hot deploy key — `scripts/deployTestnet.js` accepts `ADMIN_ADDRESS` for exactly this reason and warns if it's unset on mainnet.

```bash
ADMIN_ADDRESS=<multisig> FEE_RECIPIENT_ADDRESS=<treasury> \
  npx hardhat run scripts/deployTestnet.js --network arcTestnet

# Read-only post-deploy verification; exits non-zero on failure
npx hardhat run scripts/smoke.js --network arcTestnet
```

`ADMIN_ADDRESS` receives `DEFAULT_ADMIN_ROLE` and **must be a multisig** — on a UUPS proxy that role can upgrade the contract to arbitrary code. `FEE_RECIPIENT_ADDRESS` receives `FEE_ROLE` and withdraws origination fees; it defaults to `ADMIN_ADDRESS`.

When upgrading, new implementations must preserve the existing storage layout — append new variables at the end, never reorder or delete.

### Current Deployments

| Contract | Network | Address |
|----------|---------|---------|
| LiquidityRail (UUPS proxy) | Arc Testnet | `0xa8CB00A09092203Dd3274EBc065845fe034a0d38` |
| HackathonRegistry | Arc Testnet | `0x6C523bf8639515FaCCf6F9A577758C5C415DB89b` |

Addresses per network are written to `blockchain/deployments/<network>_deployment.json` by the deploy script.

### Upgrading

`LiquidityRail` is UUPS. To upgrade:
1. Write a new contract preserving storage layout (append new vars at the end)
2. Deploy the implementation and point the proxy at it via `upgrades.upgradeProxy` from a script
3. The caller must hold `DEFAULT_ADMIN_ROLE` — i.e. the multisig, not an EOA

## Integrations

- **Circle W3S (Developer-Controlled Wallets)** — USDC settlement, wallet management, and smart contract execution on Arc. Single service (`RealCircleService`) handles all Circle API calls. Webhook endpoint at `/api/circle/webhook` for push-based transaction settlement. Contract calls validated against an allowlist of server-controlled deployments. Outbound transfers may only source from wallets in `RealCircleService.getServerControlledWallets()` — callers may not name the source wallet.
- **MetaMask SDK** — wallet connection
- **Solana Name Service (SNS)** — .sol identity
- **QVAC** — local-first on-device AI inference
- **Firebase** — auth + Firestore
- **GitHub API** — repo analytics and identity verification

## Setup

### Prerequisites
- Node.js (see `.nvmrc`)
- MetaMask or another Web3 wallet

### Install & Run

```bash
npm run setup
npm run dev
```

### Frontend checks

```bash
cd frontend
npm test -- --run src/lib/__tests__/agentIdentity.test.ts
./node_modules/.bin/tsc --noEmit
```

## License

MIT
