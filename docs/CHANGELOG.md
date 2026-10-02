# Changelog

## 2026-09-14 — GenLayer Agent Tank: MilestoneArbiter jury (Future of Work)

Decentralized milestone verdicts via a GenLayer Intelligent Contract, wired end-to-end in mock-safe mode ahead of the Sep 17 Tank deadline.

### Contract (Day 1)
- `genlayer/contracts/milestone_arbiter.py` — `submit_milestone` → `resolve_milestone` (validators fetch evidence via `gl.get_webpage`, LLM consensus via `eq_principle comparative`) → `challenge` (appeal); `submit_and_resolve` for demos; `get_milestone` / `get_verdict` / `get_total` views
- `genlayer/DEPLOY.md` — Studio deploy + faucet + seeding steps
- `.env.example` — `GENLAYER_RPC_URL`, `GENLAYER_CONTRACT_ADDRESS`, `GENLAYER_MOCK`

### Backend (Day 2 AM)
- `frontend/src/services/GenlayerVerdictService.ts` — JSON-RPC client (no new dep), `mock` flag on verdicts, `toCreditSignal` (+15 / −25 / 0)
- `POST /api/agent/analyze` `type: 'genlayer_verdict'` — Underwriter entry point (never 500s)
- `claim_verification` now resolves a jury verdict per claim (signals `jury_delivered` / `jury_not_delivered` / `jury_inconclusive`), returns `jury` payload + `source: 'genlayer'` when confirmed, persists `juryVerdict/juryConfidence/juryReason/juryCreditBoost/juryResolvedAt/juryContract` onto claims
- `POST /api/genlayer/submit` + `GET /api/genlayer/verdict` — submit/attest + read path; `VerificationResult.provider` gains `'genlayer'`

### Product design (Day 2 PM — stakeholders)
- `GenlayerVerdictCard` rewritten in ProofBadge grammar: tiered pill, gold shimmer only when earned, `live jury`/`preview` provenance, reason quote, progressive-disclosure details (contract link hidden in preview)
- `jury-verified` badge in `computeProjectBadges` (ScaleIcon mapped in `ProofBadge`), fed by persisted jury fields — no re-resolve per view
- `HACKATHON_VERIFICATION_FIELDS` extended so jury state survives project edits
- `GenlayerDemoPanel` on `/back?tab=agents`: preset tabs with expectation hints, narrated 3-step loading, touch-size CTA, `role=tablist` + `aria-live`/`role=alert`
- `SourceBadge` renders `genlayer` → "Jury", `genlayer-mock` → "Jury Preview"
- Project page: jury auto-resolves from first claim evidence, card under first hackathon claim
- `scripts/seed-genlayer-demo.js` — Future of Work demo project seed (dotenv + `--confirm` convention)

### Tests
- `genlayer-routes.test.js` — 9 tests: submit/verdict/analyze routes, graceful degradation, card render states (delivered/not-delivered/null, expand disclosure)
- `navigation.test.js` + `ai-redirects.test.jsx` — jury-first routing (`agentsHref()` defaults to `mode=jury`; `/analyze` → `mode=analyze`)

### Stakeholder UX + performance (same day)
- **Jury as first-class mode:** new `⚖️ Jury` tab on Agents (`/back?tab=agents&mode=jury`, lazy-loaded), default mode for `agentsHref()`; footer + `/back` preserve it. Demo no longer stacked above all modes.
- **Performance:** `useProjectData` bounded to 60 docs + 90s shared module cache + in-flight dedupe (was unbounded full-collection read per mount); search debounced 220ms in `useProjectFilters`; `LiveAgentTicker` subscribes only while visible (`IntersectionObserver`) and pauses rotation in hidden tabs; leaderboard per-tab loading lanes (slow Torque can't blank Payouts tab); landing strip fetch deferred to idle with skeleton height reserve (no CTA shift).
- `SourceBadge` renders `genlayer` → "Jury", `genlayer-mock` → "Jury Preview"

### Docs
- `docs/GENLAYER_TANK_SUBMISSION.md` — track, load-bearing integration diagram, contract table (TBDs for post-deploy paste), demo path, design rationale, checklist
- `docs/README.md` — 4-provider verification, jury badge states, GenLayer Jury section

## 2026-09-04 — Rebrand to PledgeBond

Full codebase rename from "Proof of Ship" / "Builder Credit" to "PledgeBond". ~140 tracked files updated plus the logo asset; 466/466 Vitest tests pass, TypeScript clean, production build clean.

### Brand & Metadata
- All user-facing copy, page titles, OG/Twitter meta tags, and social share text now use "PledgeBond".
- Package names updated: root `pledgebond`, frontend `pledgebond-frontend`, blockchain `pledgebond-blockchain`.
- Logo asset renamed from `frontend/public/POS.png` to `frontend/public/pledgebond.png`.

### Domains & Integrations
- Default URLs and config fallbacks point to `pledgebond.com` / `pledgebond.vercel.app`.
- SNS agent identities moved to `pledgebond-scout.sol`, `pledgebond-underwriter.sol`, `pledgebond-verifier.sol`, `pledgebond-rebalance.sol`.
- Solana SNS identity protocol namespace changed from `proof-of-ship:sns-identity:v1` to `pledgebond:sns-identity:v1`.
- Removed placeholder Calendly and Discord links that pointed to non-existent accounts.

### Docs
- Updated README, SETUP_GUIDE, HACKATHON_ARC, COLOSSEUM_SUBMISSION, BAGS_SOLANA, VISION, and others.
- Added rebrand progress and follow-ups to `docs/SIX_STAR_ROADMAP.md`.
- `.env.example` updated with the new project name.

### Follow-ups Required
- Create the `pledgebond` Firebase / GCP project and populate `.env.local`.
- Rebuild and redeploy the Anchor program so the new `pledgebond:sns-identity:v1` namespace matches clients.
- Register the new `.sol` agent domains.
- Regenerate the Farcaster `accountAssociation` signature for `pledgebond.com`.
- Rename the GitHub repo to `thisyearnofear/pledgebond` and configure Vercel / DNS for `pledgebond.com`.

## 2026-08-01 — 6★ Winner Experience (Round 2): On-Chain Guard, Payout Verification, More Moments

A second pass focused on remaining trust gaps, the Payout Arrived moment, rank-change celebration, and dark-mode migration of the winner's public portfolio. 6 items, 465/465 tests pass, build clean.

### Trust & Integrity

**Self-verification guard (on-chain + client)**
- `blockchain-solana/programs/.../lib.rs` — Added `require!(verifier != developer.key(), ErrorCode::SelfVerificationNotAllowed)` in `request_funding`. The on-chain program now rejects any attempt to set the developer as their own milestone verifier. Previously the program accepted any signer, allowing developers to self-verify milestones.
- `frontend/src/services/SolanaCreditService.ts` — Client-side guard: throws if `verifier.equals(publicKey)` before constructing the transaction. Defense-in-depth alongside the on-chain check.
- New error code: `SelfVerificationNotAllowed`.

**PayoutVerifierService in the cron path** (`api/payout-leads/process.js`)
- The daily cron now runs a second pass after processing leads: for each project with claims that have a `payoutTxHash` or `circleTransferId` but aren't yet `payout_verified`, it calls `PayoutVerifierService.verify()` (Circle API, EVM RPC, or Solana RPC depending on evidence). When verification confirms, the claim's `verificationStatus` is upgraded to `payout_verified` with `payoutVerifiedAt` and `payoutActualAmount` set. Previously `PayoutVerifierService` existed but was never called in any automated path — claims stayed as `evidence_attached` indefinitely.

**snap-server/.env audit**
- Confirmed the file is NOT tracked in git (untracked on disk only). The `.gitignore` patterns are working correctly. No action needed. If the Firebase private key was ever committed in history, it should be rotated — but it was never in the repo.

### Winner Moments

**Payout Arrived moment** (`api/payout-leads/process.js`, `hooks/useNotificationFeed.js`, `NotificationBell.jsx`)
- When the cron's verification pass confirms a payout, a `payout_verified` activity is written to the `activities` collection. The builder receives a "🎉 Payout verified!" notification in their bell within 60s, with the hackathon name, amount, and a link to the project. Previously the payout promise ("Get Paid Today, Not in 67 Days") had no in-product payoff moment — now it does.

**Rank change celebration** (`api/leaderboard/snapshot.js`, `hooks/useNotificationFeed.js`)
- The weekly leaderboard snapshot cron now compares new builder rankings against the previous snapshot. When a builder moves up, a `rank_change` activity is written: "You moved up N spots on the Proof Builders leaderboard — now #X!" The builder sees an "📈 You moved up!" notification with a link to `/leaderboard`. Only upward movement triggers a celebration (downward is silent). Previously the `MovementIndicator` was just a 3px chevron with no notification.

### Dark-Mode Migration

**`u/[username].js` — winner's public portfolio migrated to semantic tokens**
- Replaced all raw `bg-gray-50` → `bg-surface-primary`, `bg-gray-100` → `bg-surface-secondary`, `bg-gray-200` → `bg-surface-hover`, `text-gray-600 dark:text-gray-400` → `text-secondary`, `text-gray-500 dark:text-gray-400` → `text-tertiary`, `text-gray-400 dark:text-gray-500` → `text-tertiary`, `border-gray-200` → `border-default`, `bg-white` (dropdown/cards) → `bg-surface`. Added `dark:from-amber-950/30 dark:to-yellow-950/20` to the badges gradient card. Zero `gray-` references remain. The winner's most-shared page is now the dark-mode exemplar, not the exception.

### Validation

- TypeScript: clean
- Vitest: 465/465 pass
- Production build: all routes built successfully

---

## 2026-08-01 — 6★ Winner Experience: Security Hardening + Winner Moments + Polish

A full-stack pass to close trust gaps, build celebratory moments for verified hackathon winners, and fix UX inconsistencies — all oriented around the north star of treating winners as the hero user. 3 tracks, 17 changes, 465/465 tests pass (+1 new), build clean.

### Track A: Security & Trust Fixes

**A1 — Circle wallet/transaction endpoints locked down** (`api/circle/[[...slug]].js`)
`handleTransactions` POST and `handleListCreateWallets` POST now require a Firebase ID token, mirroring the existing `handleTransfer` auth pattern. Previously these money-movement endpoints had no auth check at all — only a 60/min in-memory rate limit. Added `verifyAuthToken()` and `verifyAdmin()` helpers. GET routes remain public.

**A2 — Winner claim trust gate** (`api/payout-leads/process.js`)
The daily cron no longer auto-mints claims with `verificationStatus: "evidence_attached"` and `evidenceUrl: null`. Leads without an evidence URL (announcement link) are now marked `pending_evidence` and skipped. Claims start as `"pending"` until verified via `PayoutVerifierService` or admin review. Idempotency check added — already-verified leads are skipped.

**A3 — Payout-leads verify idempotency + slug unification** (`api/payout-leads/verify.js`)
Slug scheme unified to `name-lead-{leadId[:8]}` (was `name-lead` — diverged from process.js). 409 returned if lead is already verified. Duplicate-claim check before appending to `projects.hackathons[]` — existing claim for the same `leadId` is updated, not duplicated.

**A4 — Public leaderboard trust gate** (`api/hackathons/leaderboard.js`)
Claims with `verificationStatus: "pending"` or missing `evidenceUrl` are excluded from the public leaderboard. Unverified self-attested wins can no longer appear publicly — the trust contract that the entire value proposition rests on.

**A5 — Snapshot cron URL + auth fix** (`api/leaderboard/snapshot.js`)
Fixed broken self-fetch URL — `VERCEL_URL` has no scheme, so `fetch("vercel-xxx.vercel.app/api/...")` threw "Failed to parse URL". Prefixed `https://`. Auth guard now hard-fails in production when `CRON_SECRET` is unset (was conditional on `VERCEL && CRON_SECRET`, weaker than process.js's posture).

**A6 — Referrals Firestore rule** (`firestore.rules`)
Added `referrals/{userId}` rule — `allow create: if isAuthenticated() && request.auth.uid == userId`. The client-side write in `authStore.ts:120` was being silently denied (no rule existed) and swallowed by a catch block. Referral attribution now works.

**A7 — Timing-safe comparison** (`lib/agentAuth.js`)
Replaced hand-rolled char-by-char comparison with `crypto.timingSafeEqual` (Node `crypto` module). The old code leaked key length before comparison and was hand-rolled crypto.

### Track B: Winner Moments

**B1 — Verification event trigger** (`api/admin/winner-claims.js`)
When admin approves a winner claim, a `winner_verified` activity is written to the `activities` collection via `logActivity()`. This feeds the existing `useNotificationFeed` polling loop (60s interval) — no new infrastructure needed.

**B2 — Notification transform** (`hooks/useNotificationFeed.js`, `NotificationBell.jsx`)
Added `winner_verified` and `backing_received` activity types. Winners see "🏆 You're a Verified Winner!" in their notification bell within 60s of admin approval. Builders see "💰 You just got backed!" when someone stakes on their project.

**B3 — Verification Moment overlay** (`components/winner/VerificationMomentOverlay.jsx`, new)
Full-screen celebratory takeover shown on the next session open after verification. Dark gradient, gold shimmer, badge rising in center, hackathon name displayed, "You're now part of an exclusive group of proven builders" copy, dual CTAs ("View My Profile" / "Explore First"). Respects `prefers-reduced-motion`. Shows once per verification (localStorage-gated by notification ID).

**B4 — Overlay wired into app root** (`pages/_app.js`)
`VerificationMomentOverlay` dynamically imported (SSR disabled) and rendered at app root after `AIChatWidget`.

**B5 — "You got backed" builder notification** (`api/activity/log.js` new, `BackingPanel.js`, `back/BackingModal.js`)
New authenticated activity-logging endpoint — allowlisted types only, resolves builder uid from wallet address via `wallet_index` lookup. Both backing surfaces (BackingPanel, BackingModal) now fire a `backing_received` activity after success. BackingPanel success messages replaced from transactional `Transaction: 0x1234...` to celebratory `🎉 Backed! {amount} USDC at {mult}x — repaid when {builder} wins.`

**B6 — $5k phantom bar fix** (`BackingPanel.js`)
Replaced hardcoded `/ 5000` denominator (which made every low-volume project's bar look perpetually empty) with a dynamic scale: `max(1000, totalBacking * 2)` with a 5% floor. Renamed "Backer Confidence" to "Community Backing".

### Track C: Product Design Polish

**C1 — Brand unification** (`build.js`, `back.js`, `signup.js`, `admin/verification.js`, `admin/payout-simulation.js`, `_document.js`)
All "PledgeBond" page titles replaced with "PledgeBond". One brand, one trust cue.

**C2 — Dead redirect routes verified** (`compare.js`, `scout.js`, `analyze.js`)
Audited these as proper `useRouteRedirect` redirects with meta-refresh fallbacks and loading spinners — not dead stubs. Kept as-is.

**C3 — Hackathon CTAs wired** (`hackathons/[id].js`)
"Register" / "Join Hackathon" buttons now link to `hackathon.registrationUrl` (new tab, `noopener noreferrer`). Hidden entirely when no registration URL exists (was showing dead buttons). "Submit Project" links to `/projects/new`. "View on Explorer" links to Etherscan. All use `min-h-touch` for mobile.

### Docs

**AGENTS.md** — Fixed stale references: `SubmissionService` removed (no longer exists), "hourly" cron corrected to "daily", payout-lead pipeline description updated to reflect the evidence-URL trust gate and leaderboard verification gate.

### Validation

- TypeScript: clean (`npx tsc --noEmit`)
- Vitest: 465/465 pass (was 464 at HEAD; +1 new test for the evidence-URL trust gate)
- Production build: all routes built successfully (Turbopack)

---

## 2026-06-02 — Code Quality: Test Coverage Wave, Vercel Build Leak, Hydrator Split, Dark-Mode Pass

A focused day of compounding quality work — 7 atomic commits covering test coverage, real production bugs surfaced and fixed, a Vercel build leak caught early, a single-concern refactor, and a dark-mode contrast pass driven by user feedback. Test count grew from 149 → 315 (+166 tests, +111%).

### Test Coverage for Phase 4b / 4c / 4d (0 → 22 test files)

Fills the 0-test gap on the three page-decomposition phases:

- **`components/leaderboard/*` (10 test files)** — `MovementIndicator`, `tabs` (truncateAddress + generateShareText), `EmptyState` (5 tabs + fallback), `ShareButton` (X/Farcaster share + og ref URL + analytics), `FastestPayoutHero` (sort + speed filter + runner-up + 3-tier payout color), `LeaderboardRow` (builders/backers copy + explorer + SNS), `HackathonLeaderboardRow` (4-tier payout color/label), plus 3 list wrappers.
- **`components/explore/*` (7 test files)** — `ActiveFilterChips`, `ExplorePagination` (pageNumbers edge cases), `ExploreBuilderCard` (follow-button self-hide), `ExploreProjectCard`, `ExploreProjectListItem`, `TrendingSection` (dismiss + slug-aware bookmark), `constants` (option shape).
- **`components/projects/editor/*` (3 test files)** — `ProjectEditorStepNav` (wizard step indicators + Continue/Back), `ProjectEditorReview` (10 fields + milestones + funding), `ProjectEditorCelebration` (copy + share + view/submit navigation).

**Infrastructural**: `vitest.config.ts` now ships a `jsxInJs` Vite plugin so `*.test.{js,jsx}` files can import `.js` source files containing JSX (the repo's convention pre-dates Next 16's Turbopack strictness — many components are `.js` with JSX). Uses esbuild's `loader: 'jsx'` with `jsx: 'automatic'` so React 19's runtime is fine.

### Vercel Build Leak — `formatUSDC` was dragging `firebase-admin` into the client bundle

**`lib/format.js`** (new) — Pure `Intl.NumberFormat` + `getFundingTier` helper, zero imports. Replaces the long-standing `formatUSDC`/`getFundingTier` functions in `lib/usdcPayments.js` which were entangled with `RealCircleService` (a `firebase-admin` consumer). `usdcPayments.js` now re-exports from `format.js` for backward compat.

**`components/DeveloperDashboard.js`** — Now imports `formatUSDC` from `@/lib/format` instead of `@/lib/usdcPayments`. The Vercel build was failing with 25 module-not-found errors (`child_process`/`fs`/`net`/`tls`/`http2` — all from `firebase-admin`'s transitive Node imports being pulled into the browser bundle by Turbopack).

### Firestore `snap.exists` Shape Bug (5 Sites)

`DocumentSnapshot.exists` is a boolean **property**, not a method. Calling `snap.exists()` returns `undefined` (not a boolean), so the guards silently passed through and the code crashed one line later at `snap.data()` on a missing document.

Fixed 5 pre-existing sites that were flagged but left from the earlier 3-site fix:
- `services/ProjectDataService.ts:112` (`getProject`) — would have returned the wrong shape on miss
- `pages/projects/[ecosystem]/[slug]/index.js:150` (admin check) — `currentUser.isAdmin` always read as `false`
- `lib/campaignService.js:105` (`getCampaign`) — would have returned a half-shape rather than `null`
- `lib/campaignService.js:283` (`reviewSubmission`) — admin error swallowed, submission not updated
- `components/Auth/UserProfile.js:88` (profile loader) — user edits would not persist on first load

Pattern sweep confirms 0 `snap.exists()` call sites remain.

### Hydrator Decomposition — `WalletHydrator` → `EvmWalletHydrator` + `SolanaWalletHydrator`

**`stores/walletStore.ts`** — The 64-LOC `WalletHydrator` was a monolithic component reading wagmi and Solana wallet-adapter hooks side-by-side, with 4 mixed effects. Split into two single-purpose components, each owning one chain family's hook surface + store write:
- **`EvmWalletHydrator`** — reads `useAccount` / `useChainId` / `usePublicClient` / `useWalletClient` and writes to `walletStore.evm` (account sync + balance fetch, 2 effects)
- **`SolanaWalletHydrator`** — reads `useSolanaWallet` / `useSolanaConnection` and writes to `walletStore.solana` (wallet sync + balance fetch, 2 effects)

**`providers/AppProviders.js`** — Mounts both in order. The `stores` barrel re-exports the two named functions. Same wagmi + Solana hook surface, same store shape, same re-render frequency — just two re-render boundaries instead of one. No API changes to `walletStore` consumers.

### Dark-Mode Contrast Pass (User-Reported)

**`components/sections/PaymentFlow.js`** — Flow arrows and the secondary `🤖 Agent → 🧠 LLM Inference → Arc L2` strip were rendered with `text-gray-400 dark:text-gray-500` / `text-gray-300 dark:text-gray-600` — Tailwind anti-pattern where the dark variant is *darker* than the light one. Contrast fell to ~3.5:1 in dark mode (below WCAG AA 4.5:1) on the teal-950/50 section background. Fixed by flipping the dark variants to be lighter than their light counterparts.

**`components/sections/Hero.js`, `CapitalStack.js`, `UserJourney.js`, `FeatureSection.js`** — Follow-up audit on the other 4 landing sections. The same `text-gray-X dark:text-gray-Y` anti-pattern was a one-off in PaymentFlow; in the other sections, the related "no dark variant at all" issue caused light-only pills/tiles to clash with the dark backdrop. Added `dark:bg-X-900/40 dark:text-X-300` (or equivalent) to the Hero "Exclusive to Past Hackathon Winners" pill, the Three Rails visual's purple/blue/green pill+label triples, the UserJourney step-connector line, and the FeatureSection icon tile.

### Explore Tab Lazy-Loading

**`pages/explore.js`** — ProjectsTab / BuildersTab / HackathonsTab were eagerly imported through the `@/components/explore` barrel. All three tabs (and their card subcomponents) shipped in the initial landing-page bundle regardless of which tab the user opened first. `ProjectsTab` alone is 19.6 KB and pulls in the project-quality library + bookmark/fetch logic. Converted all three tabs to `next/dynamic` with `ssr: false` and `loading: () => null`. Tab chrome (TabBar, Breadcrumbs, LiveAgentTicker, ErrorBoundary, TrendingSection) remains eager.

### Scout `reasoningTrace` Temporal Dead Zone

**`pages/api/agent/scout.js`** — The Firestore `set()` call referenced `reasoningTrace` inside the object literal at the original line 139-156, but the `let reasoningTrace = null` declaration sat 50 lines later at the original line 190. Triggered `ReferenceError: Cannot access 'reasoningTrace' before initialization` at runtime, swallowed by the surrounding `try/catch` so the endpoint kept returning results — but Firestore was never updated with the reasoning trace, ecosystem analysis, or result source.

Fixed by hoisting the four let-decls (`ecosystemAnalysis`, `reasoningTrace`, `aisaPayment`, `resultSource`) above the Firestore log call. The order is now: declare → log → execute (POST + execute=1) → AIsa enrichment → fallback → return.

Also bumped the chat-endpoint test's per-test timeout to 15s. It consistently completes in ~4-5s (module-load overhead from the dynamically-imported handler chain) but vitest's 5s default was always within ~50ms of tripping.

---

## 2026-05-25 — Agentic Economy: Live Agent Runs, Reasoning Traces, Scout Portfolio

Real-time agent activity feed, AI reasoning traces, and a public portfolio page for the Proof Scout agent — moving from mock data to live on-chain agent infrastructure.

### Live Agent Activity Feed

- **`components/common/LiveAgentTicker.js`** — Replaced `MOCK_ACTIVITIES` with a live Firestore `onSnapshot` subscription to the `agent_runs` collection. Displays real agent runs (execution, scout, underwrite) with live stats: total runs and successful executions.
- **`components/dashboard/AgentAuditLog.js`** — Replaced `MOCK_LOGS` with real Firestore data. Added type-aware formatting for each agent run type (execution → emerald, scout → purple, underwrite → blue). Clicking "View Trace →" now opens an inline reasoning trace viewer instead of a no-op hover effect.

### Reasoning Traces (Trading-R1)

- **`pages/api/agent/scout.js`** — Modified the AIsa LLM prompt to request structured JSON output with `reasoningTraces` for each top-3 recommended project + an `ecosystemSummary`. Falls back to rule-based reasoning traces from scoring breakdown data when AIsa is unavailable.
- **Stored in `agent_runs`** — `reasoningTrace`, `ecosystemAnalysis`, and `resultSource` are now persisted on every scout run, making them available for the audit log and portfolio page.

### Scout Portfolio Page (`/scout`)

- **`pages/scout.js`** (new) — Public portfolio page for the Proof Scout agent:
  - Live stats: projects evaluated, backings executed, total staked, success rate
  - Latest reasoning traces from scout runs
  - Recent Arc on-chain settlements with explorer links
  - Live agent activity feed
  - "Copy Scout" CTA with social trading explainer modal
  - Share to X button with analytics tracking
  - OG meta tags for social sharing
- **`pages/api/agent/runs.js`** (new) — Public endpoint returning recent agent runs from Firestore with optional project slug filtering.
- **`pages/api/agent/copy.js`** (new) — Subscription API for the "Copy Scout" feature. Manages `copy_scout_subscriptions` in Firestore with subscribe/unsubscribe/status actions.
- **`components/common/layout/Navbar/Navbar.js`** — Added "Scout" to main navigation with `CpuChipIcon`.

---

## 2026-05-25 — Badge System, Leaderboard Sharing, Onboarding Rewrite, Backing Panel Review Step

Client-side badge inference, shareable leaderboard OG images, dual-mode onboarding banner, and a safer backing flow with review confirmation.

### Badge System (Client-Side Inference)

Zero backend changes — badges are derived from existing project and user data.

- **`lib/badges/computeBadges.js`** — Pure functions:
  - `computeBuilderBadges(portfolio)` — Verified Winner, Multi-Ecosystem, Prolific, Proof-Backed, Community Trusted, High Velocity
  - `computeProjectBadges(project)` — Proof Complete, Verified Win, Multi-Hackathon, High Evidence, Fast Shipper
  - `computeLeaderboardBadges(entry, type)` — rank-based badges for proof-builder / project / hackathon / builder / backer tabs
- **`components/common/ProofBadge.js`** — `ProofBadge` (individual) + `ProofBadgeGroup` (collection with overflow, staggered animations, tier-based styling)
- **`hooks/useBadgeNotification.js`** — Detects newly earned badges by comparing against a `localStorage` cache and fires toast notifications. Deduped by badge ID.

**Where badges appear:**
- Builder dashboard (`/build`) — builder-level badge card + project-level badges on each project card
- Public portfolio (`/u/[username]`) — builder badges in the profile sidebar
- Project detail page — project badges card in the right sidebar
- Leaderboard entries — inline rank badges with movement indicators

**Tier system:** gold (animated shimmer + glow), silver, bronze, default.

### Leaderboard Sharing & OG Images

- **`pages/api/og/leaderboard.js`** (new) — Edge-runtime OG image generator for all 5 leaderboard types. Renders rank, name, movement indicator, ecosystem badge, and type-specific metrics. Cached at CDN edge.
- **`pages/leaderboard.js`** — Added `ShareButton` component with X (Twitter) and Farcaster share links. Dynamic OG meta tags per highlighted entry via `?ref=<rank>` query parameter.
- **`components/common/LeaderboardStrip.js`** (new) — Homepage strip showing "Top Proof Builder", "Fastest Payout", "Most Proven Project" with live data from `/api/hackathons/leaderboard` and `/api/platform/stats`.
- **`components/common/LeaderboardRankBadge.js`** (new) — Self-contained rank fetcher with in-memory caching (5-min TTL) and movement tracking (up/down/new/stable).
- **`pages/api/og.js`** — Updated to render badge pills on both profile and project OG images.

### Onboarding Banner Rewrite

- **`components/common/OnboardingBanner.js`** — Complete rewrite to dual-mode:
  - **Guest banner** (unauthenticated) — Platform value props, CTAs: Sign Up, Explore, Sign In
  - **Auth banner** (authenticated, onboarding complete) — Role-based step-by-step guide
  - Dismissible per-mode with separate `localStorage` keys
  - Skips guest banner on `/login` and `/signup` paths
  - Fade-in slide-down animation on mount (`mounted` state + `transition-all duration-500`)

### Backing Panel Review Step

- **`components/BackingPanel.js`** — Added a review confirmation stage before transaction submission:
  - Displays: amount, multiplier, potential return, risk level with color coding
  - Risk labels: "Lower Risk (priority repayment)", "Balanced", "Higher Reward (repaid last)"
  - "Edit" button returns to form and clears any error
  - "Confirm Stake" proceeds to `handleBackProject`
  - Duplicate error/success alert blocks removed (they already rendered above the conditional)
  - Success path resets stage to `"form"` and clears inputs

### Follower Count Integration

- **`BuilderProjectGrowth.js`** — Fetches live follower count from `/api/follows?targetUserId=` and passes it to `computeBuilderBadges`. The **Community Trusted** badge now tiers correctly (bronze/silver/gold) based on actual follower count instead of hardcoding `0`.

### Accessibility

- **`components/common/OnboardingBanner.js`** — Respects `prefers-reduced-motion: reduce`. When the user has reduced motion enabled, the banner appears immediately without the fade-in/slide-down animation or the 50ms mount delay.

### Analytics Tracking

- **`lib/analytics.js`** (new) — Lightweight `trackEvent(event, properties)` utility. Logs to console in development; uses `navigator.sendBeacon` in production with `fetch` fallback. Never blocks user flow.

**Tracked events:**
- `onboarding_banner_dismissed` — fired on guest/auth banner dismiss (properties: `mode`, `role`)
- `badge_viewed` — fired once per mount in BuilderProjectGrowth when builder badges render (properties: `page`, `badge_ids`, `badge_tiers`, `count`)
- `leaderboard_share_clicked` — fired on X and Farcaster share buttons in leaderboard (properties: `platform`, `entry_type`, `rank`, `entry_name`)

### Mobile Rendering

- **`BuilderProjectGrowth.js`** — Reduced builder badge `max` from 8 to 5 to prevent horizontal overflow on narrow viewports.
- **`pages/u/[username].js`** — Reduced public portfolio badge `max` from 8 to 5 for consistent mobile experience.

### Bug Fixes

- **`BuilderProjectGrowth.js`** — Badge computation now derives `verifiedWinner` and `winnerData.totalWins` from the builder's own project hackathon claims (scanning for winner outcomes with payout proof) instead of hardcoding `false`.
- **`BuilderProjectGrowth.js`** — Removed incorrect named import of `ProofBadge` (default export, unused in this file).
- **`pages/u/[username].js`** — Badges card now renders at `builderBadges.length > 0` (was `> 1`), consistent with the builder dashboard.
- **`hooks/useBadgeNotification.js`** — Removed array index `${idx}` from toast deduplication keys so badge reordering no longer causes duplicate notifications.
- **`components/common/LeaderboardRankBadge.js`** — Added 5-minute TTL to the module-level fetch cache so stale rank data refreshes during long sessions.

### Files Changed
`components/BackingPanel.js` | `components/common/OnboardingBanner.js` |
`components/common/ProofBadge.js` | `components/common/LeaderboardRankBadge.js` |
`components/common/LeaderboardStrip.js` | `components/projects/BuilderProjectGrowth.js` |
`hooks/useBadgeNotification.js` | `lib/badges/computeBadges.js` (new) |
`lib/analytics.js` (new) | `pages/leaderboard.js` |
`pages/u/[username].js` | `pages/index.js` |
`pages/projects/[ecosystem]/[slug]/index.js` | `pages/api/og.js` |
`pages/api/og/leaderboard.js` (new) | `pages/api/hackathons/leaderboard.js` |
`pages/api/torque/leaderboard.js` | `pages/api/portfolio/[username].js` |
`styles/globals.css`

---

## 2026-05-25 — Vercel Build Fix & Circle Webhook Activation

Resolved Vercel production build failures and successfully activated the Circle webhook endpoint.

### Build Fixes
- **pnpm version**: Bumped `packageManager` from `pnpm@9.12.0` to `pnpm@9.15.9` — fixes `ERR_PNPM_META_FETCH_FAIL` / `ERR_INVALID_THIS` (URLSearchParams incompatibility with Node 22 on Vercel).
- **Corepack**: Added `ENABLE_EXPERIMENTAL_COREPACK=1` Vercel env var so the build image honors the `packageManager` field.
- **Deployment ID**: Replaced hardcoded `deploymentId: 'stable'` in `next.config.js` with `process.env.VERCEL_DEPLOYMENT_ID` fallback — each deploy gets a unique skew-protection ID.

### Deployment Protection
- Changed Vercel SSO protection from `prod_deployment_urls_and_all_previews` to `preview` only — production endpoints must be publicly reachable for webhooks.

### Circle Webhook (`/api/circle/webhook`)
- Rewrote handler from HMAC-SHA256 (incorrect) to ECDSA-SHA256 with Circle public key fetch (correct scheme for Programmable Wallets/CPN).
- Public keys fetched via `GET /v2/cpn/notifications/publicKey/{keyId}` using `CIRCLE_API_KEY`, cached in-memory.
- `webhooks.test` verification pings return 200 immediately (before signature check) — safe since they carry no sensitive data.
- All real events (transactions, transfers) require valid ECDSA signature.
- Webhook verified and active in Circle Console — listening to 15 events (gateway, contracts, transactions, challenges, rampSession, modularWallet).

### Files Changed
`package.json` | `frontend/next.config.js` | `frontend/src/pages/api/circle/webhook.js`

---

## 2026-05-24 — Secrets Population, Vercel Deployment & Webhook Registration

Infrastructure completion: populated GCP secrets, synced to Vercel, deployed Firestore indexes, and registered Circle webhook.

### GCP Secret Manager
- Populated 9 of 11 secrets with actual values from local `.env` files and circle-recovery documents:
  - `circle-api-key`, `circle-entity-secret`, `circle-wallet-set-id`, `circle-agent-wallet-id` — from `frontend/.env.local`
  - `firebase-private-key`, `firebase-client-email` — from Firebase Admin SDK config
  - `github-token` — fine-grained PAT from `.env`
  - `featherless-api-key` — from Featherless.ai dashboard
  - `agent-api-key` — auto-generated via `openssl rand -hex 32`
- Secrets `circle-platform-wallet-id` and `circle-webhook-secret` remain empty (require Circle Console).
- Used entity secret from `~/Documents/circle-recovery/` to authenticate W3S API via `@circle-fin/developer-controlled-wallets` SDK.

### Vercel Env Sync
- `scripts/sync-secrets.sh` fixed for bash 3.x compatibility (macOS default) — replaced associative arrays with parallel arrays.
- Synced all 9 populated secrets + 8 config vars to Vercel production environment.
- Config vars synced: `FIREBASE_PROJECT_ID`, `CIRCLE_ENVIRONMENT`, `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_SOLANA_*`, `BUILDER_CREDIT_ARC_ADDRESS`, `ALLOW_DEMO_PAYMENTS`.

### Firestore Indexes
- Deployed 9 composite indexes to production: `ships_logs`, `follow_events`, `projects` (×3), `payoutAttestations`, `circleIdempotency`, `webhookLogs`, `winnerClaims`.
- Removed 2 single-field indexes on `projects` (`createdAt`, `submittedAt`) — Firestore auto-creates these.

### Circle Webhook Registration
- Created webhook subscription via Circle Payments API (`POST /v1/notifications/subscriptions`).
- Endpoint: `https://pledgebond.com/api/circle/webhook`.
- Status is "pending" — requires endpoint to be live for Circle verification.
- SDK used: `@circle-fin/circle-sdk` with `LIVE_API_KEY`.

### Environment Variables
- `.env.example`: No changes needed (already updated in prior pass).

### Files Changed
`scripts/sync-secrets.sh` | `firestore.indexes.json` | `docs/CHANGELOG.md`

### Secrets Populated
- `circle-platform-wallet-id`: `382dfd9c-9ef1-555d-a8f3-c362d71144b0` (from Circle Console → App ID)
- Remaining: `circle-webhook-secret` (from Circle Console → Webhooks after endpoint verification)

### Vercel Build Fix
- Fixed ESLint peer dependency conflict: `eslint-config-next@16.2.6` requires `eslint >=9.0.0`
- Updated eslint from `^8.57.0` to `^9.0.0`
- Created `eslint.config.mjs` with flat config for ESLint v9
- Removed deprecated `.eslintrc.json`
- Successfully deployed to production: `https://pledgebond.vercel.app`

---

## 2026-05-24 — GCP Secret Manager & Firestore Rules for New Collections

Infrastructure hardening for the Circle API consolidation and demo flow sunset.

### GCP Secret Manager
- Enabled `secretmanager.googleapis.com` on the `pledgebond` GCP project.
- Created 11 secrets: `circle-api-key`, `circle-entity-secret`, `circle-wallet-set-id`, `circle-webhook-secret`, `circle-platform-wallet-id`, `circle-agent-wallet-id`, `firebase-private-key`, `firebase-client-email`, `github-token`, `agent-api-key`, `featherless-api-key`.
- Created `scripts/sync-secrets.sh` — pulls secrets from GCP Secret Manager and sets them as Vercel environment variables. Supports `--dry-run`.

### Firestore Rules
- Added rules for `circleIdempotency` (admin read, server-side write only).
- Added rules for `transactionStatuses` (admin read, server-side write only).
- Added rules for `webhookLogs` (admin read, server-side write only).
- Deployed updated rules to production.

### Firestore Indexes
- Added composite index for `circleIdempotency` (circleTxId + createdAt).
- Added composite index for `webhookLogs` (transactionId + receivedAt).

### Environment Variables
- `.env.example`: Added `CIRCLE_WEBHOOK_SECRET`, replaced `NEXT_PUBLIC_DEMO_MODE=true` with `ALLOW_DEMO_PAYMENTS=false`, added GCP Secret Manager header.
- CI workflow: Replaced `NEXT_PUBLIC_DEMO_MODE` with `ALLOW_DEMO_PAYMENTS`.

### Files Changed
`firestore.rules` | `firestore.indexes.json` | `.env.example` | `.github/workflows/ci.yml` |
`scripts/sync-secrets.sh` (new)

---

## 2026-05-24 — Demo Flow Sunset: Real Payments First

Replaced the auto-enabled demo mode with an explicit opt-in test mode.
Real x402 nanopayments are now the default experience for all users.

### Middleware (`nanopayment.js`)
- `isDemoMode()` renamed to `isTestMode()`. No longer auto-activates from `NODE_ENV === 'development'`.
- Test mode now requires explicit `ALLOW_DEMO_PAYMENTS=true` env var.
- Production guard: test mode is always disabled when `NODE_ENV === 'production'`, regardless of env var.
- `demoModeFlow()` renamed to `testModeFlow()`. Header changed from `x-demo-key: demo` to `x-test-mode: true`.
- `req.nanopayment.demo` field renamed to `req.nanopayment.testMode`.

### Client (`NanopaymentContext.tsx`)
- Default flipped: real payments first. Test mode only if user explicitly toggled it on (persisted in localStorage).
- localStorage key changed from `nanopayment-demo-mode` to `nanopayment-test-mode`.
- No longer auto-initializes test wallet in development.
- `x-demo-key` header replaced with `x-test-mode` header.

### UI (`NanopaymentWidget.js`, `EconomyTab.js`)
- Primary CTA changed from "Start in demo mode" to "Set up payment wallet".
- Test mode available as a small secondary link: "Or skip payments with test mode".
- Toggle label changed from "Demo mode" to "Test mode".
- Description changed from "Use simulated USDC" to "Payments skipped. Responses marked as test mode."
- Status bar changed from "Demo analysis mode" to "Test mode — payments skipped".

### Agent Endpoints
- `resultSource` no longer returns "demo" — always returns the actual source (rule_based, live_ai, cached, fallback).
- `paymentStatus` field changed from "demo" to "test_mode" when test mode is active.
- `paymentDemo` field renamed to `paymentTestMode` in execute.js.
- Chat help text no longer mentions demo mode.

### Files Changed
`nanopayment.js` | `NanopaymentContext.tsx` | `NanopaymentWidget.js` | `EconomyTab.js` |
`agent/scout.js` | `agent/underwrite.js` | `agent/verify.js` | `agent/chat.js` |
`agent/execute.js` | `agent/stream.js`

---

## 2026-05-24 — Circle API Consolidation: Mock Removal, W3S Migration, Webhooks

Production-hardening pass that eliminates all mock/fallback paths, consolidates
Circle integrations onto the W3S SDK, and adds push-based transaction settlement.

### Mock & Fallback Removal
- **`RealCircleService.ts`**: `processDeveloperFunding()` now throws when Circle API is not configured instead of silently returning mock data. `mockFunding()` method deleted.
- **`usdcPayments.js`**: Complete rewrite — delegates to `RealCircleService` instead of importing `@circle-fin/circle-sdk`. No mock fallback paths remain.
- **`FundingInterface.js`**: UI message changed from "demo mode" to "Funding unavailable — Circle API credentials not configured."

### SDK Consolidation (old `@circle-fin/circle-sdk` → W3S)
- **`api/circle/transactions.js`**: Migrated from `circle.wallets.*` to `realCircleService.createTransaction/getTransactionStatus`.
- **`api/circle/wallets/[id].js`**: Migrated to `realCircleService.getWalletById()`.
- **`api/circle/wallets/[id]/balances.js`**: Removed `formatTokenAmount` import from old utils.
- **`api/circle/config.js`**: Migrated from `getCircleEnvironment()` to `realCircleService.getConfig()`.
- **`api/circle/transfer.js`**: Replaced raw `fetch` calls to old REST API with `realCircleService.createTransaction()`.
- **`agent/execute.js`**: Migrated from raw REST + `generateEntitySecretCiphertext` to `realCircleService.createTransaction()` for contract execution.
- **`utils/circleApi.js`**: Stripped to pure formatting helpers (`formatCircleError`, `formatTokenAmount`). Old SDK initialization removed. Now dead code for API routes.
- **`CrossChainFunding.js`**: Removed `usdcPaymentService` import (was pulling `@circle-fin/circle-sdk` into client bundle). Now imports standalone `calculateFundingAmount` from `lib/funding/calculateFundingAmount.ts`.
- **`lib/funding/calculateFundingAmount.ts`** (new): Pure function module with no server-only or SDK imports. Safe for client components.

### Idempotency Persistence
- **`RealCircleService.ts`**: All `createTransaction`, `createWallet`, and `createContractExecutionTransaction` calls now check Firestore (`circleIdempotency` collection) before submitting. Records stored before Circle call, updated with transaction ID after.
- **`RealCircleService.ts`**: `generateIdempotencyKey()` now uses `crypto.randomUUID()` for deterministic keys. Overload accepts caller-provided idempotency key.

### Webhook Endpoint
- **`api/circle/webhook.js`** (new): Receives Circle push notifications for transaction status changes. HMAC-SHA256 signature verification. Updates `circleIdempotency`, `PayoutLogs`, and `transactionStatuses` Firestore collections. Requires `CIRCLE_WEBHOOK_SECRET` env var.

### Contract Validation
- **`RealCircleService.ts`**: `validateContractCall()` checks `contractAddress` against `BUILDER_CREDIT_CORE_ADDRESSES` allowlist and validates calldata function selector against known signatures (`backProject`, `approve`, `transfer`).

### Configuration Checks
- **`RealCircleService.ts`**: `isClientConfigured()` (apiKey + entitySecret) for transaction-only ops. `isWalletConfigured()` (+ walletSetId) for wallet operations. `getTransactionStatus()` uses `isClientConfigured()` so it works without `walletSetId`.
- **`RealCircleService.ts`**: `createTransaction()` uses `createContractExecutionTransaction()` (correct W3S SDK method) for contract calls instead of `createTransaction()` with mixed-in fields.
- **`RealCircleService.ts`**: `config.feeLevel` wired through to both `createTransaction()` and `createContractExecutionTransaction()`. Defaults to `"HIGH"` only when not specified.

### Files Changed
`RealCircleService.ts` | `usdcPayments.js` | `usdcPayments.test.js` | `CrossChainFunding.js` |
`FundingInterface.js` | `agent/execute.js` | `api/circle/config.js` | `api/circle/transactions.js` |
`api/circle/transfer.js` | `api/circle/wallets/[id].js` | `api/circle/wallets/[id]/balances.js` |
`api/circle/webhook.js` (new) | `lib/funding/calculateFundingAmount.ts` (new) | `utils/circleApi.js`

---

## 2026-05-21 — Whole-Platform Reduction Pass: Naming, Routes, Data, and Polish

This was a systematic multi-phase consolidation addressing every dimension identified
in the architectural review: naming coherence, route count, data layer consolidation,
and UI consistency.

### Phase 0 — Quick Wins
- **Fixed stale docs**: `docs/README.md` route table now matches the actual 13 routes
- **Added glossary**: `docs/GLOSSARY.md` — 18 domain terms defined in one place
- **Fixed dead collection ref**: `COLLECTIONS.USER_PROFILES` → `USERS` (matched Firestore rules)
- **Composite indexes added**: 4 indexes for projects (createdAt, ecosystem+createdAt, ecosystem+status) and payoutAttestations
- **Removed cross-chain verification fallback**: `VerificationService` no longer accepts EVM hashes for Solana projects or vice versa

### Phase 1 — Naming & Metaphor Consolidation
- **`expedition` → `project` everywhere**: renamed `useExpeditionData` → `useProjectData`, `ExpeditionCard` → `ProjectCard`, `expeditionMetrics` → `projectMetrics`, `components/expedition/` → `components/backer/`. 10+ consumer files updated.
- **`war-room` → `verification`**: `admin/war-room.js` → `admin/verification.js`, `useWarRoomData` → `useVerificationData`, Navbar label updated to "Verification Dashboard"
- **War-room `expeditions` → `hackathonGroups`**: the Firestore concept was about hackathon groupings for verifier assignment, not projects

### Phase 2 — Route Reduction (18 → 13 pages)
- **Removed**: `fleet.js`, `campaigns.js`, `feedback.js`, `design.js`, `about.js` — each redirected via `next.config.js` to closest equivalent
- **Merged auth**: `signup.js` replaced with redirect to `/login?mode=signup`

### Phase 3 — Data Layer Consolidation

**3.1 — Single `projects` collection:**
- **Writes**: removed dual-writes to `projects_{ecosystem}` in 4 files (submit.js, [slug].js, winding-down.js, DataService.ts)
- **Reads**: consolidated 6 read paths to query `projects` directly instead of iterating 8 ecosystem collections
- **Config**: `collections.ts` simplified — removed `PROJECTS` map, `getProjectCollection()`, `getAllProjectCollections()`
- **Rules**: collapsed 6 per-ecosystem Firestore rules blocks into one `/projects/{projectId}` block

**3.2 — WalletContext split (1,167 → 502 lines):**
- **NanopaymentContext.tsx** (273 lines) — extracted nanopayment state, payForAgent, deposit, and useNanopayment hook
- **CircleContext.tsx** (138 lines) — extracted Circle wallet creation, USDC transfer, useCircleWallet hook
- **CreditContext.tsx** (251 lines) — extracted PledgeBond, backProject, chain balance management
- **WalletContext.tsx** (502 lines) — stripped down to pure connection-only logic (MetaMask SDK + Solana adapter + network switching + token balances)
- All existing consumers continue to work via re-exports from WalletContext
- New context tree: WalletProvider → CircleProvider → CreditProvider → NanopaymentProvider

**3.3 — DataService split (736 → 4 files):**
- **DataServiceCore.ts** (387 lines) — caching infrastructure, GitHub API proxy, stats calculation
- **ProjectDataService.ts** (200 lines) — project loading (loadAllProjects, getProject), search, ecosystem stats
- **SubmissionService.ts** (77 lines) — project submission with validation and admin queue
- **DataService.ts** (7 lines) — pure re-exports hub; no consumer changes needed

**3.4 — Server/client split fix:**
- Moved `VerificationService.js` from `services/` to `lib/verification/` — correctly signals server-only code

### Phase 4 — Semantic Token Migration
- 143+ raw Tailwind class instances replaced with semantic CSS tokens across 9 high-traffic pages
- Patterns: `bg-white dark:bg-gray-800` → `bg-surface`, `text-gray-900` → `text-primary`, `border-gray-200` → `border-default`
- Pages migrated: explore.js (biggest win, ~100 replacements), leaderboard.js, back.js, build.js, compare.js, analyze.js, profile.js, admin/verification.js, transactions.js

### Phase 5 — UI Polish
- **Footer enriched**: 4-column layout with navigation links (Discover, Build, Resources, Status) and build version badge
- **Dark mode sweep**: remaining `bg-white` and `text-gray-900` without `dark:` variants fixed in 6 additional files
- **Mobile**: verified existing patterns are adequate (min-h-touch, responsive grids)

### Phase 6 — Firestore Transaction Safety
- **submit.js**: project write + permission grant wrapped in `db.runTransaction()`
- **payout-verify.js**: project claim update wrapped in `db.runTransaction()`

### Files Changed
`blockchain/contracts/HackathonRegistry.sol` | `docs/README.md` | `docs/CHANGELOG.md` | `docs/GLOSSARY.md` |
`docs/REDUCTION_PLAN.md` | `docs/PHASE3_PLUS.md` |
`frontend/src/contexts/WalletContext.tsx` | `frontend/src/contexts/NanopaymentContext.tsx` |
`frontend/src/contexts/CircleContext.tsx` | `frontend/src/contexts/CreditContext.tsx` |
`frontend/src/services/DataService.ts` | `frontend/src/services/DataServiceCore.ts` |
`frontend/src/services/ProjectDataService.ts` | `frontend/src/services/SubmissionService.ts` |
`frontend/src/services/PayoutVerifierService.ts` | `frontend/src/services/BuilderCredentialService.ts` |
`frontend/src/hooks/useProjectData.js` | `frontend/src/hooks/useVerificationData.js` |
`frontend/src/components/backer/ProjectCard.js` |
`frontend/src/components/common/layout/Footer/Footer.js` |
`frontend/src/components/common/layout/Navbar/Navbar.js` |
`frontend/src/components/common/BuilderTrust.tsx` |
`frontend/src/pages/leaderboard.js` | `frontend/src/pages/explore.js` |
`frontend/src/pages/back.js` | `frontend/src/pages/build.js` |
`frontend/src/pages/analyze.js` | `frontend/src/pages/profile.js` |
`frontend/src/pages/compare.js` | `frontend/src/pages/transactions.js` |
`frontend/src/pages/signup.js` | `frontend/src/pages/admin/verification.js` |
`frontend/src/pages/api/projects/submit.js` | `frontend/src/pages/api/projects/[slug].js` |
`frontend/src/pages/api/projects/winding-down.js` |
`frontend/src/pages/api/agent/payout-verify.js` |
`frontend/src/pages/api/hackathons/[id]/payout-timeline.js` |
`frontend/src/config/collections.ts` | `firestore.rules` | `firestore.indexes.json` |
`frontend/next.config.js`

### Files Created
- `frontend/src/services/PayoutVerifierService.ts` — verification service
- `frontend/src/pages/api/agent/payout-verify.js` — payout verification API
- `frontend/src/pages/api/hackathons/leaderboard.js` — leaderboard aggregation API

### Files Changed
- `frontend/src/pages/api/agent/analyze.js` — added `claim_verification` type
- `frontend/src/pages/leaderboard.js` — added Hackathons tab with FastestPayoutHero + ranked list
- `frontend/src/pages/projects/[ecosystem]/[slug]/index.js` — added ClaimVerificationBadge + analyze integration

## 2026-05-21 — Circle Agent Wallet Integration Verified

- Created ARC-TESTNET agent wallet via Circle API: `e7034022-f0c8-5c35-8f96-667b680c250b` (`0xdea33f28b244cf467a402808757bf75065cb7ee8`)
- Wallet funded with $20 USDC on Arc Testnet
- `execute.js` rewritten to use Circle's raw REST API for contract execution (SDK v10.3.1 has an axios interceptor bug with `createContractExecutionTransaction`)
- Uses `generateEntitySecretCiphertext` from SDK (works) + direct HTTPS POST to `/v1/w3s/developer/transactions/contractExecution` (works)
- Full flow verified: Circle signs and submits contract calls on Arc — approve USDC → backProject
- SDK bug tracked: `TypeError: Cannot read properties of undefined (reading 'config')` at line 46 of SDK bundle — axios response interceptor issue
- Created `frontend/scripts/create-agent-wallet.mjs` for future wallet creation
- `RealCircleService.createTransaction()` extended with contractAddress + calldata support (can be used once SDK is fixed)

## 2026-05-21 — Circle Agent Wallet Migration (execute.js)

- Solana program redeployed to **`DVzV16mVG9vHdrum9Fx9kGhzRv2GJa2mNnmTWUnKa6st`** on devnet
- EVM BuilderCreditCore redeployed on Arc Testnet via UUPS proxy:
  - Proxy: `0x26272b687df2c3607aCa3B6116c24B7400c3fC94`
  - Implementation: `0x2088E6C2c958E6d0d0b35d98b2d3B0E598527718`
  - HackathonRegistry: `0x6E303E2B8F386BfDEb201AeD5c2c011b98F2c6Bd`
- Deployment scripts refactored to deploy ERC1967 proxy directly (compatible with Arc RPC)
- `.env.example` and IDL updated with new deployed addresses
- Verified: registry, USDC token, admin role, sample hackathon all working on-chain

## 2026-05-21 — Architecture Fixes: Vault Solvency, EVM Upgradeability, Firestore Security

### Solana: Split Vault Architecture (fixes backer insolvency)
- **Root cause:** Single vault per project held both milestone funds and backer stakes. `verify_milestone` could drain it before backers claimed — the test worked around this by artificially minting USDC into the vault.
- **Fix:** Split into two vaults per project:
  - `milestone_vault` — milestone funding only, paid out via `verify_milestone`
  - `backer_escrow_vault` — backer stakes only, paid out via `claim_reward`
- Milestone payouts can no longer drain backer funds — each vault is isolated by PDA seed.
- New `fund_backer_rewards` instruction: protocol treasury funds multiplier premiums into the backer escrow vault (mirrors the EVM `fundPrize` deposit).
- New `withdraw_treasury` instruction: addresses the previous "no withdraw instruction exists" gap.
- `request_funding` creates both vault ATAs at project creation time.
- Frontend `SolanaCreditService.ts` updated with new PDA helpers (`getMilestoneVaultAuthorityPda`, `getBackerVaultAuthorityPda`) and account mappings for all instructions.
- Tests rewritten: validate vault isolation (milestone vault drains while escrow vault stays intact), `fund_backer_rewards` flow, no more artificial minting workaround.

### EVM: UUPS Upgradeability for BuilderCreditCore
- **Root cause:** Constructor-based deployment with no proxy pattern. `initialize()` was unreachable (guard checked `usdcToken == address(0)` but constructor already set it). Upgrades required full redeployment + state migration.
- **Fix:** Migrated to OpenZeppelin UUPS upgradeable pattern:
  - Added `Initializable`, `UUPSUpgradeable` imports
  - Constructor replaced with `_disableInitializers()`
  - `initialize(registry, usdcToken, admin)` sets all state and grants all roles
  - `_authorizeUpgrade()` gated to `DEFAULT_ADMIN_ROLE`
  - Storage layout preserved — same variables, same order
- New `scripts/upgrade.js` for future upgrades
- `deploy.js`, `deployTestnet.js`, `deployProduction.js` updated to use `upgrades.deployProxy()` with kind `"uups"`
- Tests updated to use `upgrades.deployProxy()` and include upgradeability test

### Firestore: Locked Down World-Writable Collections
- **Root cause:** `agentCache`, `agent_runs`, and `wallet_index` were `allow write: if true` (acknowledged in inline comments as hackathon-only). Four env vars used in code but missing from `.env.example`.
- **Fix:** All three collections set to `allow write: if false` — server-side admin SDK bypasses rules, so API routes continue to work while malicious clients are blocked.
- `agent_runs` read also restricted to admin-only.

### Files Changed
- `blockchain-solana/programs/blockchain-solana/src/lib.rs` — split vault, new instructions
- `blockchain-solana/tests/blockchain-solana.ts` — vault isolation tests
- `frontend/src/services/SolanaCreditService.ts` — new PDA helpers + account mappings
- `blockchain/contracts/BuilderCreditCore.sol` — UUPS upgradeable
- `blockchain/scripts/deploy.js`, `deployTestnet.js`, `deployProduction.js` — UUPS proxy deployment
- `blockchain/scripts/upgrade.js` — new upgrade script
- `blockchain/test/BuilderCreditCore.test.js` — UUPS-compatible tests
- `firestore.rules` — locked agentCache, agent_runs, wallet_index

## 2026-05-05 — QVAC Service Rewrite (Honest Local-First Architecture)

- Rewrote QvacService.ts from scratch — removed fake browser-based `import('@qvac/sdk')` that never worked
- New architecture: QVAC runs as a local HTTP server (`qvac serve`), service calls `localhost:PORT/v1/chat/completions` (OpenAI-compatible)
- Auto-detects local QVAC server via `/v1/models` health check with 10s cooldown cache
- Provider chain: QVAC local → Featherless cloud → AIsa → Rule-based fallback (same prompts, same structure)
- Updated /analyze page: removed fake "Load Model" button, added honest dual-path UI with "Retry Connection" and `qvac serve` instructions
- Source badge shows "On-Device (QVAC)" vs "Cloud API (Featherless)" — transparent about where inference runs
- Updated COLOSSEUM_SUBMISSION.md Local-First AI section with accurate architecture description
- Updated BuilderTrust component with score ring, tier, and behavioral signal chips
- Updated FairScoreService to match real FairScale API spec (GET-based, api2.fairscale.xyz, correct response shape)

## 2026-05-05 — Trust Infrastructure Redesign

- Created BuilderTrust.tsx — single source of truth for trust display across all surfaces
- BuilderTrustCompact: compact pill in ExpeditionCard badge row (score ring + tier + top behavioral signal)
- BuilderTrustFull: dedicated trust panel in BackingPanel before stake button (score, tier, badges, signal chips)
- BuilderTrustSkeleton: loading state so cards don't pop in jarringly
- deriveSignals() maps FairScale's 15-signal features to human-readable chips (active days, wallet age, conviction, dump history)
- BackingPanel: trust panel between description and multiplier selector — first thing backer sees before committing capital
- UserProfile: BuilderTrustFull below Ethos score
- Replaced FairScoreBadge usage across ExpeditionCard, BackingPanel, UserProfile

## 2026-05-05 — Soft-Delete with Grace Period

- DELETE handler checks for active backings before hard-deleting
- If backings exist, sets status to winding_down with 30-day expiry
- Quality gate in useExpeditionData filters out winding_down projects
- New /api/projects/winding-down endpoint: GET to list, POST to process expired projects (auto-extends if backings still active)
- Created FairScoreService.js, FairScoreBadge.tsx, useFairScore.ts hook, /api/reputation/score endpoint

## 2026-05-04 — Privacy as Platform Feature (Cloak Redesign)

- Reframed Cloak privacy from a buried toggle to a platform guarantee
- Created `PrivacyShield.js` with three exports:
  - `PrivacyOnboarding`: 3-step interactive explainer (The Problem → How We Protect You → It's Automatic) with visual comparisons of public vs shielded explorer views
  - `PrivacyInline`: compact purple callout for BackingPanel
  - `PrivacyBadge`: "Positions Shielded" badge for headers
- `back.js`: First-time backers see PrivacyOnboarding walkthrough on /back, PrivacyBadge in page header
- `BackingPanel.js`: Replaced PrivatePaymentsToggle with PrivacyInline guarantee (automatic, no toggle)
- `DiscoverTab.js`: Empty state shows privacy message; inline backing modal shows privacy guarantee before confirm
- `OnboardingBanner.js`: Backer step 3 changed from "Stake & Earn" to "Stake Privately"
- Cleared 16 skeleton projects from generic `projects` collection (zero descriptions, no ecosystem/GitHub)
- Platform now clean for user-driven submissions only

## 2026-05-04 — SNS Agent Domain Registration on Devnet

- Registered 4 agent .sol domains on Solana devnet: pledgebond-scout.sol, pledgebond-underwriter.sol, pledgebond-verifier.sol, pledgebond-rebalance.sol
- All domains owned by project wallet (G33naaudTAyEWFnfLET51aWGNLry5BwUtZt6KwcniFoj)
- Created `scripts/register-agent-domains.js` — registers all 4 domains via `createNameRegistry`, idempotent (skips existing)
- Created `scripts/verify-agent-domains.ts` — verifies domain ownership and prints explorer links
- Results written to `docs/agent-domain-results.json`

## 2026-05-04 — Cloak Demo Mode + Interactive Panel

- Added `getIntegrationStatus()`, `isMainnet()`, and `runDemoFlow()` to CloakPaymentService
- Created `CloakDemoPanel.js` — interactive 5-step demo with step-by-step progress, technical toggle (shows SDK method names), and run/reset controls
- `PrivatePaymentsToggle` now shows Demo/Live badge instead of hiding when Cloak isn't deployed on devnet
- Integrated CloakDemoPanel into the Back page AI Agents tab
- Created `/api/cloak/status` endpoint returning integration health, cluster, demo mode flag, and feature list

## 2026-05-04 — QVAC Standalone /analyze Page

- Created `/analyze` page — standalone project analysis with QVAC status indicator, project selector from Firestore, structured results (score/strengths/risks/recommendation), and credit score explanation via `qvacService.explainCreditScore()` (previously unused)
- Created `/api/agent/analyze` — cloud fallback endpoint using Featherless -> AIsa provider chain, includes rule-based analysis when no API keys set
- Added /analyze to Navbar navigation

## 2026-05-04 — Quality-Gated Backer Discovery

- `useExpeditionData` now loads from ecosystem collections (projects_solana, projects_celo, etc.) instead of sparse `projects` collection
- Quality gate filters out skeleton projects: must have name, 15+ char description, ecosystem, and GitHub URL
- `expeditionMetrics` derives meaningful variation from real project fields: description quality, GitHub presence, socials, team size, recency, stable hash variation
- Health baseline lowered to 30 (was 50), multiplier ranges 1.2x-2.5x based on completeness
- ExpeditionCard shows ecosystem badge, category, description preview, builder identity, Code/Website links
- DiscoverTab adds ecosystem filter, sort by Health/Confidence/Multiplier/Newest
- Updated 33 metric unit tests

## 2026-05-04 — Login & Auth Fixes

- Fixed TDZ error in login.js: moved computed vars and hooks above early returns (Rules of Hooks)
- Added 'Start over' button on login page: disconnects wallet, logs out, resets state
- Auto-detect walletFamily from connected state; auto-redirect returning users
- Clear phantom 'builder' role when no GitHub connected

## 2026-05-02 — SNS Ownership Proof Anchored On-Chain

- Extended the Solana `Project` account to store:
  - `builder_sns_domain`
  - `builder_sns_name_account`
  - `builder_identity_signature`
- Updated `request_funding` so project creation now requires:
  - a real SNS name account
  - a canonical builder identity-claim message
  - a preceding `Ed25519Program` verification instruction
- Updated `SolanaCreditService` to:
  - resolve the builder's primary `.sol`
  - derive the SNS name-account key
  - sign the identity-claim message with the connected wallet
  - prepend the Ed25519 proof instruction automatically
- Updated `devnet-transactions.ts` to require `SNS_DOMAIN` and reproduce the proof-aware Solana flow
- Updated Solana tests to exercise the SNS-aware requestFunding path using `SNS_DOMAIN` and `SNS_NAME_ACCOUNT`
- Updated frontend project persistence/read paths so `builderSnsDomain` and `builderSnsNameAccount` are stored and displayed directly

## 2026-05-02 — Solana Devnet Deployment + 7 Confirmed On-Chain Transactions

- Deployed Anchor program to Solana devnet: `14uLETygxjh89fHFwYUaRRhHE9E9XrYcSh6SsF8SEw1K`
- IDL uploaded on-chain: `HGBAP7xUeuR3Nt99z8d2AhNDFGK5iN5sVdGd4W9jrdHr`
- Created `devnet-transactions.ts` — full transaction runner: treasury init, project creation, backer staking, milestone verification, loan repayment
- 7 confirmed transactions on Solana Explorer (devnet)
- Fixed Cloak Keypair/wallet-adapter mismatch — BackingPanel now generates ephemeral Keypair, funds via browser wallet
- Wired agent SNS identities into API responses (scout, underwrite, verify, chat)
- SnsIdentityBadge added to FundingInterface, ProjectDetails, DiscoverTab, PortfolioTab, ExpeditionCard
- Added blockchain-solana to pnpm workspace
- Frontend uses `NEXT_PUBLIC_SOLANA_PROGRAM_ID` env var for program address

## 2026-05-02 — QVAC Local-First AI Integration + Colosseum Submission

- Created `QvacService` — local-first AI inference via Tether's QVAC SDK
- Lazy-loaded @qvac/sdk with `webpackIgnore: true` for build-time safety
- Local project analysis, credit score explanation, and general completion
- Falls back to cloud providers (Featherless -> AIsa) when QVAC unavailable
- Wired QVAC into AI chat widget as first-choice provider with "on-device" badge
- Created Colosseum Frontier Hackathon Public Goods submission narrative
- Fixed lockfile drift from partial QVAC SDK install

## 2026-05-02 — Cloak Private Payments Integration

- Added Cloak SDK integration for shielded USDC transfers on Solana
- Created `CloakPaymentService` — deposit, withdraw, partial withdraw, batch payout, compliance scan
- Created `PrivatePaymentsToggle` component — purple shield toggle for Solana wallets
- Updated `BackingPanel.js` — backers can opt into shielded staking; amounts hidden from public explorers
- Supports backer staking, builder payouts, and batch treasury disbursements
- Viewing key support for compliance/audit without exposing transaction amounts

## 2026-05-02 — SNS Identity Track Integration

- Added SNS (Solana Name Service) integration for human-readable .sol domain identities
- Created `SnsService.ts` — resolves .sol names from wallet addresses with 5-min cache
- Created `useSnsName` React hook — lazy resolution with loading state and fallback
- Created `SnsIdentityBadge` component — displays .sol name with purple verification icon
- Updated `UserProfile.js` — linked Solana wallets show .sol names instead of truncated addresses
- Updated `login.js` — connected Solana wallet displays resolved .sol name
- Updated `UserContext.tsx` — backer wallet sign-in resolves .sol names for display names
- Created `lib/agentIdentity.ts` — defines .sol domain identities for all 4 AI agents
- Updated agent API responses (scout, underwrite, verify) to include `agent.snsDomain` field
- Updated `TransactionFeed.js` — agent transactions display .sol domain identities
- Updated snap-server Farcaster manifest with `agentIdentities` object
- Installed `@bonfida/spl-name-service` dependency

## 2026-04-24 — AI Chat Widget + Featherless AI + Docs Update

- Added floating AI Chat Assistant widget (`AIChatWidget.js`) accessible from every page
- Widget is collapsible (minimize button), dismissable (X with sessionStorage persistence), and reopenable (tiny pill)
- Chat API (`/api/agent/chat`) uses cascading AI providers: Featherless AI (DeepSeek-V3-0324) → AIsa Perplexity Sonar → contextual fallback
- Added `FEATHERLESS_API_KEY` env var for primary AI provider
- Updated README with features overview, AI provider chain docs, and env var reference
- Updated HACKATHON_ARC.md with all new features, files, and dual AI provider chain

## 2026-04-23 — UI Polish, Search, Onboarding, Project Flow

- Added search & filtering on explore page (real-time by name/description/category)
- Added onboarding banner (dismissible 3-step walkthrough for first-time visitors)
- Added SEO meta tags (Open Graph, Twitter Card) in `_document.js`
- Added IP-based rate limiting (30 req/min) to all agent API routes
- Added X/Farcaster share buttons on project detail pages
- Redesigned `/back` page Economy tab with agent explainer cards and cost breakdown
- Added TransactionFeed component showing live x402 nanopayment activity
- Added navbar balance indicator (⚡ $X.XX) linking to `/back` page
- Enriched profile page with My Projects section, nanopayment stats, transaction feed
- Fixed dead `/shippers` link → `/explore`, added Arc hero section on landing page
- Added all 7 ecosystems (Arc, Celo, Base, Linea, Arbitrum, Ethereum, Optimism) to explore page
- Improved project add/edit/delete flow: optional contract address, GitHub auto-populate, collapsible sections, localStorage drafts, delete with confirmation
- Toned down nautical theme on key pages, improved dark mode support
- Visual x402 flow diagram on landing page showing payment chain

## 2026-04-22 — AIsa x402 Integration + Nanopayment Fixes

- Wired AIsa Perplexity Sonar into all 3 agent endpoints (underwrite, scout, verify)
- Added `aisaClient.js` singleton x402-paying fetch client for AIsa endpoints on Arc Testnet
- Fixed missing `crypto` import in `nanopayment.js` that crashed all agent API routes
- Fixed `NanopaymentContext.tsx` demo mode (direct state init, demo-mode fetch with `x-demo-key` header)
- Added `NanopaymentProvider` and `UserBehaviorProvider` to `AppProviders.js`
- Fixed navbar Sign In button visibility (removed broken `hidden xs:flex` class)
- Updated `package-lock.json` to include `@x402/evm`, `@x402/fetch`, `zod` dependencies

## 2026-04-18 — Docs consolidation & mock data cleanup

- Removed 12 dead pages (`issues/*`, `pulls/*`, `releases/*`, `nebula-test`, `components`)
- Replaced `mockUserId` in hackathon detail page with real `useAuth()` user
- Removed `mockEvidence` fallback from war-room — uses real evidence feed only
- Removed `generateMockFundingApplication` from FundingStatusTracker — shows empty state when no data
- Consolidated 8 docs into 3 (`README.md`, `PRODUCTION_READINESS.md`, `CHANGELOG.md`)
- Deleted stale docs: `AGENT.md`, `DEMO_SCRIPT.md`, `ETHOS_INTEGRATION.md`, `HACKATHON.md`, `SETUP_GUIDE.md`, `CONSOLIDATION_PLAN.md`

## 2026-04-17 — Codebase consolidation (Phases 1–6)

### Phase 1: Dead code removal
- Deleted duplicate scripts between `/scripts` and `/blockchain/scripts`
- Deleted unused services (SocialProtocolService, EthosService, BaseService, ServiceManager)
- Collapsed DataService into EnhancedDataService
- Deleted old GithubProvider and legacy pages that depended on it
- Removed dead `/credit` nav link (page didn't exist yet)

### Phase 2: Auth consolidation
- Merged IdentityContext logic into AuthContext (IdentityContext kept for login wallet-linking)
- Renamed DecentralizedAuthContext → ReputationContext (it does scoring, not auth)

### Phase 3: BuilderCredit wired up
- Mounted BuilderCreditProvider in `_app.js`
- Merged two dashboards (`/dashboard` + `/builder-dashboard`) into single `/dashboard` with real contract data
- Created `/credit` page with live contract data (score, credit line, backings, collateral)

### Phase 4: Navigation consolidated
- Reorganized nav by user role: Explore / Build / Back / Verify

### Phase 5: Provider tree reduced
- Lazy-loaded expensive providers (LiFi, Circle, UserBehavior, Reputation)

### Phase 6: Remaining cleanup
- Merged `/ecosystems/celo.js` and `/ecosystems/base.js` into dynamic `/ecosystems/[id].js`

## 2026-04-17 — Snap + Mini-app

- Replaced Farcaster Frames with Snap + Mini-app standard
- Added scout snap and celebration snap

## Earlier — Feature development

- PR #10: Verification War Room dashboard
- PR #9: Dynamic multipliers and backer portfolio
- PR #8: Expedition Marketplace and admin payout simulation
- PR #7: Backer-Driven Liquidity Loop
- PR #6: Predictive credit loop
- PR #5: Predictive credit dashboard
- Hybrid Identity System, Linea Frontiers, token allocation, tester tasks, feedback system
