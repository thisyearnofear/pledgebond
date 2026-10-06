# API Routes

All routes are BFF (Backend-for-Frontend) wrappers under `frontend/src/pages/api/`. Business logic lives in `services/`.

## Agent (`/api/agent/*`)

| Route | Method | Purpose |
|-------|--------|---------|
| `/chat` | POST | AI chat via Featherless/AIsa cascade |
| `/analyze` | POST | Analyze a project |
| `/scout` | POST | Scout agent analysis |
| `/verify` | POST | Verify payout settlement (feeds credibility + market resolution) |
| `/payout-verify` | POST | Verify payout conditions against a chain receipt |
| `/stream` | GET | SSE event stream for live agent activity |

> `/execute` was **removed** in Phase 0. It let a 0.01 USDC toll authorize the
> agent wallet to stake platform capital at leveraged multipliers. The platform
> does not underwrite, so it does not back projects. The route now returns 410.

## Circle (`/api/circle/*`)

| Route | Method | Purpose |
|-------|--------|---------|
| `/config` | GET | Circle W3S configuration + supported tokens/chains |
| `/status` | GET | Circle API health check + ping |
| `/wallets` | GET | List wallets (optional `?walletSetId=`) |
| `/wallets` | POST | Create developer wallet |
| `/wallets/[id]` | GET | Single wallet details |
| `/wallets/[id]/balances` | GET | Token balances for a wallet |
| `/transactions` | GET | Transaction status (`?id=txId`) |
| `/transactions` | POST | Create transaction — **server-controlled wallets only**; a caller-supplied `walletId` that isn't in `getServerControlledWallets()` is rejected with 403 |
| `/transfer` | POST | USDC payout to tester (with auth) |
| `/webhook` | POST | Circle push notification (HMAC-SHA256 verified) |

## Projects (`/api/projects/*`)

| Route | Method | Purpose |
|-------|--------|---------|
| `/submit` | POST | Submit a new project |
| `/import-github` | POST | Auto-populate from GitHub repo |
| `/log` | POST | Log project activity |
| `/[slug]` | GET | Single project details |
| `/winding-down` | GET | Projects nearing wind-down |

## Hackathons (`/api/hackathons/*`)

| Route | Method | Purpose |
|-------|--------|---------|
| `/` | GET | List hackathons |
| `/[id]` | GET | Hackathon details |
| `/[id]/participants` | GET | Hackathon participants |
| `/[id]/payout-timeline` | GET | Payout schedule |
| `/leaderboard` | GET | Leaderboard scores |

## Verification (`/api/verification/*`)

| Route | Method | Purpose |
|-------|--------|---------|
| `/hackathon` | POST | Submit hackathon verification |
| `/funding` | POST | Submit funding verification |
| `/weft-callback` | POST | Weft oracle callback |

## Winner Verification (`/api/winner-verification/*`)

| Route | Method | Purpose |
|-------|--------|---------|
| `/status` | GET | Verification status |
| `/claim` | POST | Claim hackathon prize |

## Credibility

Read-only, derived from public payment history. There is deliberately **no** route
that assigns a score — credibility is computed on-chain from settled outcomes.

| Route | Method | Purpose |
|-------|--------|---------|
| `/builder/[address]/credibility` | GET | Coverage rate, avg/best days-to-pay, defaults |
| `/win/[winId]` | GET | Declared win, loan status, payout timestamps |

> The former "Scoring & Reputation" routes (`/credit/score`, `/score/preview`,
> `/reputation/score`) were **removed**. They served an admin-assigned 0–850 score
> that no longer exists as a product concept.

## Torque

| Route | Method | Purpose |
|-------|--------|---------|
| `/torque/leaderboard` | GET | Torque leaderboard |
| `/torque/incentives` | GET | Torque incentive data |
| `/torque/events` | GET | Torque event log |

## Funding (`/api/funding`)

| Route | Method | Purpose |
|-------|--------|---------|
| `createWallet` | POST | Create a Circle wallet for a user |
| `getBalance` | GET | Wallet balance |
| `getFundingHistory` | GET | Past disbursements for an address |
| `getTransferStatus` | GET | Circle transfer status |
| `checkConfiguration` | GET | Circle configuration |
| `approveTesterReward` | POST | Admin-only. Sources from `CIRCLE_PAYOUT_WALLET_ID`; the request body cannot choose the wallet. |

> **Removed in Phase 0**, each a route through which the platform was
> underwriting or a wallet could be drained:
> - `transferUSDC` — accepted a caller-supplied `sourceWalletId` with **no auth check at all**. Any unauthenticated POST could name any Circle wallet and drain it.
> - `processFunding` — disbursed up to $5,000 per developer from `CIRCLE_PLATFORM_WALLET_ID` on a credit score, with no repayment ledger.
> - `calculateFunding` — served the 0–850 credit-score funding curve.

Any new outbound transfer must go through `usdcPaymentService.transferUSDCWithReason`,
which refuses any wallet not in `RealCircleService.getServerControlledWallets()` and
writes a `PayoutLogs` row via `recordDisbursement`.

## Other

| Route | Method | Purpose |
|-------|--------|---------|
| `/activity/feed` | GET | Live activity feed |
| `/builders` | GET | Builder directory |
| `/follows` | POST | Follow/unfollow a builder |
| `/platform/stats` | GET | Platform-wide stats |
| `/portfolio/[username]` | GET | Builder portfolio |
| `/nebula` | GET | Nebula API proxy |
| `/og/*` | GET | Open Graph images (project, celebration, scout) |
| `/lifi/chains` | GET | LI.FI supported chains |
| `/admin/winner-claims` | GET | Admin: winner claims |
| `/feedback/submit` | POST | Submit feedback |
| `/feedback/lookup` | GET | Lookup feedback by ID |
| `/hello` | GET | Health check |
