# PledgeBond

Credit infrastructure for builders: verified hackathon wins become collateral. We turn a hackathon win from a trophy into a receivable — and the receivable into credit. AI agents underwrite, scout, and verify via x402 nanopayments on Circle's Arc network; backers fund builders and are repaid from prize payouts.

## Features

- **Explore** — Browse projects across 7 ecosystems (Arc, Celo, Base, Linea, Arbitrum, Ethereum, Optimism) with search & filtering. *Note: Multi-chain backing is achieved via seamless cross-chain bridging to Solana using LI.FI, rather than relying on native smart contracts deployed to each respective chain.*
- **AI Agents** — Underwriter ($0.05), Scout ($0.01), Verifier ($0.01) analyze projects via x402 micropayments
- **SNS Identity** — Builders and AI agents use .sol domain names (pledgebond-scout.sol, pledgebond-underwriter.sol, etc.) via Solana Name Service integration, and Solana project creation can anchor a signed SNS ownership proof on-chain
- **Private Staking** — Backers can shield stake amounts from public explorers via Cloak (UTXO shielded pool on Solana)
- **AI Chat Assistant** — Floating helper widget powered by Featherless AI (DeepSeek-V3) with AIsa fallback, collapsible/dismissable
- **Local-First AI** — QVAC (Tether) on-device inference option keeps project data private; falls back to cloud providers when unavailable
- **Submit Projects** — GitHub auto-populate, collapsible optional sections, localStorage draft saving
- **Back Projects** — Nanopayment widget with live transaction feed and balance tracking
- **Badges** — Client-side achievement inference: Verified Winner, Multi-Ecosystem, Prolific, Proof-Backed, etc. Gold/silver/bronze tiers with animated shimmer
- **Leaderboard Sharing** — Shareable OG images for all 5 leaderboard categories (proof-builder, project, hackathon, builder, backer) with rank, movement, and metrics
- **Onboarding** — Dual-mode banner: guest value props + authenticated role-based guide. Dismissible per-mode with fade-in animation
- **SEO & Sharing** — Open Graph meta tags with dynamic badge pills, X/Farcaster share buttons on project pages and leaderboard entries

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

7 confirmed transactions on devnet — Treasury init, 2 projects created, 2 backings, milestone verification, loan repayment.

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
