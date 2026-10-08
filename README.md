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
- **SNS Identity** — Builders and AI agents use .sol domain names via Solana Name Service
- **Private positions** — Shield position amounts via Cloak (UTXO shielded pool on Solana)
- **AI Chat Assistant** — Floating helper widget powered by Featherless AI (DeepSeek-V3) with AIsa fallback, collapsible/dismissable
- **Local-First AI** — QVAC (Tether) on-device inference keeps project data private; falls back to cloud providers when unavailable
- **Submit Projects** — GitHub auto-populate, collapsible optional sections, localStorage draft saving
- **Badges** — Client-side achievement inference: Verified Winner, Multi-Ecosystem, Prolific, Proof-Backed, etc.
- **Leaderboard Sharing** — Shareable OG images for leaderboard categories with rank, movement, and metrics
- **Onboarding** — Authenticated role-based guide (builder/backer steps). Single dismiss flag, fade/slide transition, respects `prefers-reduced-motion`
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
```

### Firebase Emulator (local dev)

```bash
# Requires firebase-tools: npm install -g firebase-tools
firebase init emulators  # one-time: select Firestore + Auth + Storage
firebase emulators:start
# Set FIRESTORE_EMULATOR_HOST=localhost:8080 and use demo-* project IDs
```

## On-Chain (Arc Testnet)

The liquidity rail lives on **Arc Testnet** (chain `5042002`, USDC-native gas):

| Contract | Address |
|----------|---------|
| LiquidityRail (UUPS proxy) | `0xa8CB00A09092203Dd3274EBc065845fe034a0d38` |
| HackathonRegistry | `0x6C523bf8639515FaCCf6F9A577758C5C415DB89b` |

Declarations, loan opens, and settlements from the demo loop are on-chain and
verifiable on the [Arc explorer](https://testnet.arcscope.net). Deploy with
`pnpm --filter ./blockchain deploy:arctestnet` (see [`docs/README.md`](docs/README.md)).

> The legacy Solana credit-line program (`blockchain-solana/`, Anchor) was
> retired with the liquidity-rail pivot — see [`docs/VISION.md`](docs/VISION.md).
> What remains on the Solana side is the Bags token launch + fee-share SDK
> (`frontend/src/services/SolanaBagsService.ts`) for the coming-soon "bags" rail.

## Environment Variables

```env
# AI Providers
FEATHERLESS_API_KEY=your_featherless_key    # Featherless AI (primary)
OWS_MNEMONIC=your_mnemonic                  # AIsa x402 (fallback)

# Circle x402 Nanopayments
CIRCLE_GATEWAY_WALLET_ADDRESS=0x...
PRIVATE_KEY=0x...
NEXT_PUBLIC_DEMO_MODE=true                  # true for testing without real keys

# Solana / SNS (payout verification + Bags rail)
NEXT_PUBLIC_SOLANA_RPC_URL=
SOLANA_USDC_MINT=                           # optional; defaults to devnet USDC in supported paths

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
- `docs/` — [Documentation](./docs/README.md), [vision](./docs/VISION.md), [growth](./docs/GROWTH.md), [Colosseum submission](./docs/COLOSSEUM_SUBMISSION.md), [hackathon submission](./docs/HACKATHON_ARC.md), [changelog](./docs/CHANGELOG.md)

## Links

- **Live:** [pledgebond.com](https://pledgebond.com)
- **Mirror:** [pledgebond.vercel.app](https://pledgebond.vercel.app)

## License

MIT
