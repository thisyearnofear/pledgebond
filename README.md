# PledgeBond

A liquidity rail for hackathon winners — paid in hours, not 90 days. A confirmed win becomes a bridgeable asset: the winner draws USDC against the unpaid prize and repays when the organizer pays out. Alongside it runs a market on whether declared wins will actually be settled.

We take basis points on the transactions we enable. We never underwrite, never take a share of winnings, and never absorb a credit loss.

## Product model

**Two pools, structurally separate.** This is the load-bearing design decision:

| | **Bridge lenders** | **Bettors** |
|---|---|---|
| Believe | The builder repays | The organizer pays out |
| Risk | Credit risk | Speculative, bounded at stake |
| Absorb defaults? | Yes | **Never** |

Bettor capital must never fund a loan. A bettor must never absorb an organizer that simply doesn't pay — that isn't the bet they placed.

**Every loan is either overcollateralized or backed by a first-loss tranche.** That's what makes "the platform never takes risk" true rather than aspirational. **No multipliers** — any leverage above 100 is a promise backed by someone other than the prize.

**Credibility is derived, never assigned.** Coverage rate, time-to-pay, and defaults, computed from public payment history by the contract. There is no admin who sets a score, and none can.

## Features

- **Explore** — Browse projects across 7 ecosystems (Arc, Celo, Base, Linea, Arbitrum, Ethereum, Optimism) with search & filtering
- **Public payout truth** — Who pays winners, and how fast. Verified against on-chain receipts across EVM and Solana, anchored by `HackathonRegistry.declareWinner` / `recordPayout`
- **AI Agents** — Scout ($0.01) and Verifier ($0.001) analyze projects and payouts via x402 micropayments on Arc
- **SNS Identity** — Builders and AI agents use .sol domain names via Solana Name Service; Solana project creation anchors a signed SNS ownership proof on-chain
- **Private positions** — Shield position amounts via Cloak (UTXO shielded pool on Solana)
- **AI Chat Assistant** — Floating helper widget powered by Featherless AI (DeepSeek-V3) with AIsa fallback, collapsible/dismissable
- **Local-First AI** — QVAC (Tether) on-device inference keeps project data private; falls back to cloud providers when unavailable
- **Submit Projects** — GitHub auto-populate, collapsible optional sections, localStorage draft saving
- **Badges** — Client-side achievement inference: Verified Winner, Multi-Ecosystem, Prolific, Proof-Backed, etc.
- **Leaderboard Sharing** — Shareable OG images for leaderboard categories with rank, movement, and metrics
- **Onboarding** — Dual-mode banner: guest value props + authenticated role-based guide
- **SEO & Sharing** — Open Graph meta tags with dynamic badge pills, X/Farcaster share buttons

## AI Provider Chain

The chat assistant uses a cascading provider strategy:

1. **Featherless AI** (primary) — DeepSeek-V3-0324 via OpenAI-compatible API. Set `FEATHERLESS_API_KEY`.
2. **AIsa x402** (fallback) — Perplexity Sonar via x402 nanopayment. Set `OWS_MNEMONIC`.
3. **Contextual replies** (offline fallback) — Pattern-matched responses, no API key needed.

## Quick Start

```bash
npm run setup        # install all dependencies (pnpm required)
npm run dev          # frontend dev server at localhost:3000
npm run blockchain:test  # run Solidity contract tests
```

### Testing

```bash
# Frontend unit tests
cd frontend && npx vitest run

# Type checking
cd frontend && npx tsc --noEmit

# Smart contract tests
npm run blockchain:test

# Solana program tests
cd blockchain-solana && anchor test
```

### Firebase Emulator (local dev)

```bash
# Requires firebase-tools: npm install -g firebase-tools
firebase init emulators  # one-time: select Firestore + Auth + Storage
firebase emulators:start
# Set FIRESTORE_EMULATOR_HOST=localhost:8080 and use demo-* project IDs
```

## On-Chain (Solana Devnet)

**Program:** `14uLETygxjh89fHFwYUaRRhHE9E9XrYcSh6SsF8SEw1K` ([Explorer](https://explorer.solana.com/address/14uLETygxjh89fHFwYUaRRhHE9E9XrYcSh6SsF8SEw1K?cluster=devnet))
**IDL:** `HGBAP7xUeuR3Nt99z8d2AhNDFGK5iN5sVdGd4W9jrdHr`

7 confirmed transactions on devnet — treasury init, 2 projects created, 2 position opens, verification, loan repayment.

> **Note:** the Solana program still implements the previous credit-line model
> (credit lines, backing multipliers, milestone verification). It is being
> reworked to match the EVM rail; until then, treat `blockchain-solana` as
> legacy. See [`docs/VISION.md`](docs/VISION.md) for the target model.

Latest local Solana flow:

```bash
cd blockchain-solana
anchor build
npm run idl:copy
npm run treasury:init
SNS_DOMAIN=your-name.sol npm run tx:devnet
```

The latest Anchor revision also stores:
- `builder_sns_domain`
- `builder_sns_name_account`
- `builder_identity_signature`

## Environment Variables

```env
# AI Providers
FEATHERLESS_API_KEY=your_featherless_key    # Featherless AI (primary)
OWS_MNEMONIC=your_mnemonic                  # AIsa x402 (fallback)

# Circle x402 Nanopayments
CIRCLE_GATEWAY_WALLET_ADDRESS=0x...
PRIVATE_KEY=0x...
NEXT_PUBLIC_DEMO_MODE=true                  # true for testing without real keys

# Solana / SNS
NEXT_PUBLIC_SOLANA_PROGRAM_ID=
NEXT_PUBLIC_SOLANA_RPC_URL=
SOLANA_USDC_MINT=                           # optional; defaults to devnet USDC in supported paths
SNS_DOMAIN=your-name.sol                    # used by the devnet runner

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
```

## Infrastructure

### Secret Management

Secrets are managed via **GCP Secret Manager** and synced to Vercel:

```bash
GCP Secret Manager → scripts/sync-secrets.sh → Vercel env vars
```

- **GCP Project:** `pledgebond` — 11 secrets stored in Secret Manager
- **Vercel Project:** `prj_vWDYON8jEftKOX7mcbE1OVCqDZIc` — env vars synced from GCP
- **Sync script:** `./scripts/sync-secrets.sh` (supports `--dry-run`)

To add or update a secret:
```bash
echo -n "your-value" | gcloud secrets versions add <secret-name> --project=pledgebond --data-file=-
./scripts/sync-secrets.sh  # push to Vercel
vercel --prod              # redeploy
```

### Circle Integration

- **Payments API:** `LIVE_API_KEY` for transfers and webhooks
- **W3S Wallets API:** Entity secret + `LIVE_API_KEY` for developer-controlled wallets
- **Webhook:** `https://pledgebond.vercel.app/api/circle/webhook` — signed with HMAC-SHA256
- **Test environment:** Separate `TEST_API_KEY` + test wallet set for sandbox

### Firestore

- 9 composite indexes deployed for performance (projects, webhookLogs, circleIdempotency, etc.)
- Rules deployed for 3 new collections: `circleIdempotency`, `transactionStatuses`, `webhookLogs`

## Deployment

- **Firebase:** `firebase deploy --only hosting`
- **Vercel:** `vercel --prod` (auto-deploys from main branch)
- **Indexes:** `firebase deploy --only firestore:indexes --project=pledgebond`
- **Rules:** `firebase deploy --only firestore:rules --project=pledgebond`

After updating secrets:
```bash
./scripts/sync-secrets.sh  # GCP → Vercel
vercel --prod              # redeploy
```

## Structure

- `frontend/` — Next.js app (pages, components, contexts, services)
- `blockchain/` — Hardhat workspace (Solidity contracts, deploy scripts, tests)
- `snap-server/` — Farcaster Snap server (scout + celebration snaps)
- `docs/` — [Documentation](./docs/README.md), [Colosseum submission](./docs/COLOSSEUM_SUBMISSION.md), [hackathon submission](./docs/HACKATHON_ARC.md), [changelog](./docs/CHANGELOG.md)

## Links

- **Live:** [pledgebond.com](https://pledgebond.com)
- **Mirror:** [pledgebond.vercel.app](https://pledgebond.vercel.app)

## License

MIT
