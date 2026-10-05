# Repository Guidelines

> **Product direction:** PledgeBond is a **liquidity rail for hackathon winners** — paid in hours, not 90 days. A confirmed win is bridged with a USDC loan against the unpaid prize, plus a market on whether the organizer will actually pay. There are **no credit scores, no multipliers, and no admin-assigned reputation**. See [`docs/VISION.md`](docs/VISION.md).

A pnpm monorepo (`pnpm-workspace.yaml`) with three packages: `frontend` (Next 16 App Router, React 19), `blockchain` (Hardhat/Solidity), `snap-server`. Run everything from the root via `pnpm --filter ./frontend <script>`; package scripts are wrappers that delegate.

## Build, Test, and Development Commands

```bash
pnpm install                                # one-time
pnpm dev                                    # frontend at :3000
pnpm --filter ./frontend build              # production build (Turbopack)
pnpm --filter ./frontend test               # vitest watch
pnpm --filter ./frontend test:run           # vitest one-shot
npx tsc -p frontend --noEmit                # type check
pnpm blockchain:test                        # solidity
```

A single vitest file: `cd frontend && npx vitest run src/path/to/file.test.ts`.

## Project Structure & Architecture

- `frontend/src/stores/` — three `useSyncExternalStore` stores (`authStore.ts`, `profileStore.ts`, `walletStore.ts`) replacing the legacy `contexts/` tree (Phase 3). Cross-store calls go through module-level `*Actions` objects, never through hooks.
- `frontend/src/lib/chains/` — single source of truth for the seven EVM chains (Arc, Celo, Base, Linea, Arbitrum, Ethereum, Optimism) + Solana. Wallet-shared types/constants live in `lib/wallet/`.
- `frontend/src/lib/wallet/constants.ts` — `AGENT_PRICES` (USD costs for x402 AI agent calls), `NETWORK_CONFIGS`.
- `frontend/src/services/` — data + integrations; per-domain files (`ProjectDataService`, `DataServiceCore`, `walletService`, etc.). `DataService.ts` is a re-export shim — add new methods to `DataServiceCore`.
- Decomposition convention: large pages live in `pages/` and pull co-located subcomponents from sibling folders (`components/leaderboard/`, `components/explore/`, `components/projects/editor/`, `components/common/layout/Navbar/`). New large pages follow the same pattern — see `pages/leaderboard.js` (167 LOC) for the canonical example.
- Hydrator pattern: components that need wagmi/Solana hooks read them and write to `walletStore` via `setState` (see `stores/walletStore.ts` `WalletHydrator`).
- **Payout lead pipeline** — `PayoutLeadForm` (bottom of HackathonLeaderboardList) POSTs to `POST /api/payout-leads` which stores to Firestore `payoutLeads` collection + optionally pings Slack. `GET /api/payout-leads/verify` converts lead → Firestore project claim → leaderboard picks it up. `GET /api/payout-leads/process` is called daily by a Vercel cron (`frontend/vercel.json` `crons[]`) to process leads that have evidence URLs. Leads without evidence are marked `pending_evidence` and skipped. The cron also runs a second pass that calls `PayoutVerifierService.verify()` on claims with `payoutTxHash` or `circleTransferId`, upgrading `verificationStatus` to `payout_verified` when confirmed on-chain. Only claims with `verificationStatus` of `payout_verified` or `evidence_attached` (with a real `evidenceUrl`) surface on the public leaderboard.
- **Notification system** — `useNotificationFeed` (60s polling) reads from the `activities` collection and transforms entries into in-app notifications via `notificationStore`. Activity types: `winner_verified` (admin approves claim), `payout_verified` (cron confirms payout on-chain), `rank_change` (weekly snapshot detects upward rank movement), `project_submitted`, `payout_processed`, `follow`. The `VerificationMomentOverlay` (`components/winner/`) renders a full-screen celebratory takeover on next session open when a `winner_verified` notification is unread.
- **Credibility anchor** — `HackathonRegistry.declareWinner` / `recordPayout` anchor the `declaredAt` / `paidAt` pair on-chain. This is what makes a win underwritable and a builder's payment history public. `getPayoutStats` returns the time-to-pay distribution the leaderboard markets. **Treat these as core infrastructure, not a registry convenience.**
- **Security invariants (never relax these)**
  1. **The platform never absorbs a credit loss.** Every loan is overcollateralized or backed by a first-loss tranche.
  2. **The platform's only revenue is fees on notional**, taken atomically in the contract. Never a share of winnings, never a spread on principal.
  3. **Bridge lenders and bettors are structurally separated.** Bettor capital must never fund a loan or absorb a default.
  4. **Credibility is derived from public payment history**, never assigned by an admin role. There is no `setReputation`.
  5. **No multiplier above 100** without a named party funding it. Any upside is paid from fee revenue and recorded as such.
- **Server-controlled wallets only** — `RealCircleService.getServerControlledWallets()` is the single source of truth for which Circle wallets the server may spend from. Callers may never name the source wallet. Any new outbound transfer path must go through `transferUSDCWithReason` (which enforces this and writes a `PayoutLogs` row) or `recordDisbursement` directly.
- **Payment verification fails closed** — `verifyAuthorizationNonce` returns `false`/`null` on RPC error and the request is rejected. Never degrade to serving an unverified request.
- **Claim correlation key** — `mergeHackathonsWithVerification` in `lib/projects/projectNormalize.js` correlates claims by `claimId`, then payout tx hash. Name+URL confer nothing: a builder can duplicate both to inherit a verified status. Do not "simplify" this back to name+URL.
- **OG image handler** — `GET /api/og?type=hackathon` generates dark gradient OG cards with name, ecosystem badge, and stats. Edge runtime, no satori/puppeteer — uses raw SVG served as PNG via `Content-Type: image/svg+xml`.
- **Seed scripts** live in `scripts/` (root) and use `dotenv` with `path: ".env.local"`. Run with `--confirm` to write. Example: `node scripts/seed-payout-data.js --confirm`.

## Coding Style & Naming Conventions

- TypeScript `strict: true`; `allowJs: true`. Some files are `.js` with JSDoc type annotations.
- **Turbopack strictness**: Next 16's default Turbopack parser does NOT strip TypeScript syntax from `.js` files. Co-located `.js` files must use JSDoc (`@typedef`, `@type`), never `interface`, `type`, or `as any` casts. Renaming `.js`→`.ts` is fine for new isolated files.
- Hooks default-export (`export default useFoo`), not named — even when only one export.
- No ESLint config (Next 16 removed `next lint`); no Prettier. Match surrounding style.

## Testing Guidelines

Vitest 4.1.5 with jsdom. Tests live next to source as `*.test.ts`/`*.test.js`. Mock external SDKs (Firebase admin, nanopayment middleware, agent identity) at the module boundary with `vi.mock('@/lib/...')`. Firestore query mocks must be chainable — see `src/lib/__tests__/api/agent-routes.test.js` `fakeQuery()`.

**IMPORTANT**: Do NOT put test files inside `pages/` or `pages/api/` — Next.js treats them as routes. Place API route tests in `src/lib/__tests__/api/` and page tests in `src/lib/__tests__/pages/`. Use relative `import()` paths to the handler (e.g., `import('../../../pages/api/payout-leads/process')`) and mock `@/lib/firebase/serverOnly` with chainable collections.
Also bumped esbuild to 0.27.7 as a devDependency to fix the pre-existing esbuild binary mismatch (0.24.2 vs 0.27.7) in the test environment.

## Commit & Pull Request Guidelines

Lowercase `<type>: <description>` — `refactor:`, `fix:`, `chore:`, `feat:`. Body explains the why + measured outcome (LOC counts, test deltas, build status). One logical change per commit; atomic renames use `git mv` to preserve history. Branch is `main`; push directly (no PR template, no CI).
