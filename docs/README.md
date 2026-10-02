# PledgeBond

Decentralized platform where backers fund builders and hackathon prizes collateralize credit.

> **6★ Winner Experience:** See [SIX_STAR_ROADMAP.md](./SIX_STAR_ROADMAP.md) for the full initiative tracking — what's done (security hardening, winner moments, dark-mode migration) and what remains (scale, lifecycle, organizer tools).
>
> **New:** See [VISION.md](./VISION.md) for the wedge (builders-as-businesses, verified track record as collateral) plus the unified capital-stack narrative (Bags Token → x402 Credit → Prize Routing) and how the agentic layer prices, scouts, and verifies across all three rails.
>
> **Arc update:** See [HACKATHON_ARC.md](./HACKATHON_ARC.md) for the current Arc agent integration, including the simplified `setup → analyze → review` flow, explicit demo/live payment states, and result-source metadata.

## How It Works

1. **Backers** stake USDC on builders with 1.5x, 2x, or 3x reward multipliers.
2. **Builders** pledge expected hackathon prizes to collateralize their credit line.
3. **Market confidence** (total backing) determines the builder's credit limit.
4. **AI analysis** helps users decide what to back, with small USDC payments settling on Arc.
5. **Prize wins** are routed through the platform to automatically repay backers (principal + interest), then the builder.

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
│       ├── services/     # Business logic (Circle, Solana credit, Cloak privacy, SNS identity, QVAC local AI)
│       └── utils/        # Utilities
│
├── blockchain/           # Hardhat workspace (UUPS upgradeable contracts)
├── blockchain-solana/    # Anchor program (split vault architecture)
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
| `backing_received` | 💰 You just got backed! | Builder | Backer stakes on project |
| `payout_verified` | 🎉 Payout verified! | Builder | Cron confirms payout on-chain |
| `rank_change` | 📈 You moved up! | Builder | Weekly snapshot detects upward rank movement |
| `project_submitted` | 🚢 Project shipped! | Builder | Project submission |
| `milestone_verified` | ✅ Milestone verified | Builder/Backer | Milestone verification |
| `payout_processed` | 💰 Payout secured! | Builder/Backer | Funding processed |
| `follow` | 👥 New follower | Builder | Follow event |

### On-Chain Self-Verification Guard

The Anchor program enforces `require!(verifier != developer.key(), ErrorCode::SelfVerificationNotAllowed)` in `request_funding`. The client-side `SolanaCreditService.requestFunding` adds a parallel guard. Developers cannot set themselves as their own milestone verifier at either layer.

### Activity Logging

`POST /api/activity/log` — authenticated, allowlisted-types-only endpoint for client-initiated activity logging. Currently supports `backing_received` (resolves builder uid from wallet address via `wallet_index` lookup). Recipient must differ from the actor.

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
| `/build` | Builders | Builder dashboard: project submission, credit, milestones, badges |
| `/leaderboard` | Everyone | Builder / Backer / Hackathon rankings with shareable OG images |
| `/analyze` | Everyone | Standalone AI project analysis |
| `/profile` | Everyone | User profile with credentials and portfolio |
| `/u/[username]` | Everyone | Public builder portfolio with badges |
| `/compare` | Everyone | Side-by-side project comparison |
| `/login` | Everyone | Role picker + GitHub + wallet auth |
| `/admin/verification` | Verifiers | Milestone verification dashboard |

## Smart Contract Architecture

### Solana (Anchor): Split Vault Design

Each project has **two separate vault ATAs** to prevent insolvency:

```
Project
 ├── milestone_vault_authority → milestone_vault
 │     Holds milestone funding only. verify_milestone pays from here.
 │     Backer funds cannot be drained by milestone payouts.
 │
 └── backer_vault_authority → backer_escrow_vault
       Holds backer stakes only. claim_reward pays from here.
       Multiplier premiums funded by protocol treasury via fund_backer_rewards.
       Backers can always reclaim their principal.
```

The protocol treasury accumulates loan repayments and sponsor contributions. `fund_backer_rewards` moves treasury USDC into a project's backer escrow vault to cover the `(multiplier - 100) / 100` premium on backer payouts — analogous to the EVM `fundPrize` deposit (backers then pull via `claimPayout`).

### EVM (Solidity): UUPS Upgradeable

`BuilderCreditCore` is deployed behind an OpenZeppelin UUPS proxy. The `initialize(registry, usdcToken, admin)` function replaces the constructor pattern. `_authorizeUpgrade()` is gated to `DEFAULT_ADMIN_ROLE`.

```bash
# Deploy (deploys implementation + ERC1967 proxy in one go)
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/deployTestnet.js --network arcTestnet
npx hardhat run scripts/deployProduction.js --network base

# Upgrade later
BUILDER_CREDIT_PROXY_ADDRESS=0x26272b... npx hardhat run scripts/upgrade.js --network arcTestnet
```

When upgrading, new implementations must preserve the existing storage layout — append new variables at the end, never reorder or delete.

### Current Deployments

| Contract | Network | Address |
|----------|---------|---------|
| Solana Program | devnet | `DVzV16mVG9vHdrum9Fx9kGhzRv2GJa2mNnmTWUnKa6st` |
| BuilderCreditCore (proxy) | Arc Testnet | `0x26272b687df2c3607aCa3B6116c24B7400c3fC94` |
| HackathonRegistry | Arc Testnet | `0x6E303E2B8F386BfDEb201AeD5c2c011b98F2c6Bd` |

### Upgrading

To upgrade BuilderCreditCore with new logic:
1. Write a new contract preserving storage layout (append new vars at end)
2. Deploy the new implementation: `npx hardhat run scripts/upgrade.js --network <network>`
3. Set `BUILDER_CREDIT_PROXY_ADDRESS` env var to the proxy address

## Integrations

- **Circle W3S (Developer-Controlled Wallets)** — USDC settlement, wallet management, and smart contract execution on Arc. Single service (`RealCircleService`) handles all Circle API calls. Webhook endpoint at `/api/circle/webhook` for push-based transaction settlement. Contract calls validated against an allowlist of `BuilderCreditCore` deployments.
- **MetaMask SDK** — wallet connection
- **Solana Name Service (SNS)** — .sol identity
- **Cloak** — private USDC transfers
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
