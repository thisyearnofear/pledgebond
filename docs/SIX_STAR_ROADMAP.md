# 6★ Winner Experience — Progress & Roadmap

> North star: hackathon winners treated as the hero user — a Brian Chesky-style, extraordinarily loved product.

This document tracks the full initiative to elevate PledgeBond from a functional platform to a 6-star experience for hackathon winners, backers, and organizers. It is the source of truth for what's been done and what remains.

---

## What's Been Done

### Track A — Security & Trust Fixes

| # | Fix | Status | Commit |
|---|---|---|---|
| A1 | Circle wallet/transaction endpoints locked down (Firebase ID token on POST) | ✅ Done | `0293af8` |
| A2 | Winner claim trust gate (leads without evidence URL are skipped, not auto-minted) | ✅ Done | `0293af8` |
| A3 | Payout-leads verify idempotency + unified slug scheme | ✅ Done | `0293af8` |
| A4 | Public leaderboard trust gate (pending/unverified claims excluded) | ✅ Done | `0293af8` |
| A5 | Snapshot cron URL fix (`https://` prefix) + auth hardening | ✅ Done | `0293af8` |
| A6 | Referrals Firestore rule added (was silently failing) | ✅ Done | `0293af8` |
| A7 | Hand-rolled timing comparison → `crypto.timingSafeEqual` | ✅ Done | `0293af8` |
| A8 | On-chain self-verification guard (`verifier != developer` in Anchor program) | ✅ Done | `a91f008` |
| A9 | PayoutVerifierService wired into daily cron (claims auto-upgraded to `payout_verified`) | ✅ Done | `a91f008` |
| A10 | snap-server/.env audit (confirmed untracked, not in git) | ✅ Done | `a91f008` |

### Track B — Winner Moments

| # | Moment | Status | Commit |
|---|---|---|---|
| B1 | Verification Moment: admin approval → `winner_verified` activity → real-time notification + full-screen overlay | ✅ Done | `0293af8` |
| B2 | "You got backed" notification: `/api/activity/log` endpoint → builder gets 💰 notification | ✅ Done | `0293af8` |
| B3 | BackingPanel success copy: transactional → celebratory | ✅ Done | `0293af8` |
| B4 | $5k phantom bar fix (dynamic scale, 5% floor) | ✅ Done | `0293af8` |
| B5 | Payout Arrived moment: cron verification → `payout_verified` activity → 🎉 notification | ✅ Done | `a91f008` |
| B6 | Rank change celebration: weekly snapshot detects upward movement → 📈 notification | ✅ Done | `a91f008` |

### Track C — Product Design Polish

| # | Fix | Status | Commit |
|---|---|---|---|
| C1 | Brand rename from "Proof of Ship" / "Builder Credit" to "PledgeBond" across all titles, metadata, and code | ✅ Done | TBD |
| C2 | Dead redirect routes verified (proper `useRouteRedirect`, kept) | ✅ Done | `0293af8` |
| C3 | Hackathon CTAs wired (Register/Join/Submit/Explorer → real links) | ✅ Done | `0293af8` |
| C4 | `u/[username].js` migrated to semantic tokens (zero `gray-` refs, dark-mode exemplar) | ✅ Done | `a91f008` |

### Validation Status

- TypeScript: clean
- Vitest: 465/465 tests pass (was 464 at HEAD before the initiative; +1 new test)
- Production build: all routes built successfully

---

## What's Left

### Rebrand Follow-ups (PledgeBond)

| # | Item | Description |
|---|---|---|
| R1 | Create `pledgebond` Firebase / GCP project | `.env.local`, `.firebaserc`, and Firebase fallback values are set to `pledgebond`; the project must exist before deploys work. Use Blaze plan so Storage works; see Firebase strategy below. |
| R2 | ~~Rebuild and redeploy Solana program~~ | **Closed 2026-10-05:** the Anchor program was retired with the credit model — see `docs/CHANGELOG.md`. No Solana program to rebuild; the Bags integration was later removed entirely, leaving only the `PayoutVerifierService` Solana transfer scan. |
| R3 | Register `.sol` agent domains | `pledgebond-scout.sol`, `pledgebond-underwriter.sol`, `pledgebond-verifier.sol`, `pledgebond-rebalance.sol` need Solana Name Service registration. |
| R4 | Regenerate Farcaster signature | `public/.well-known/farcaster.json` frame values are updated, but the `accountAssociation` signature is still for the old domain and must be regenerated. |
| R5 | GitHub / Vercel / DNS migration | Rename the GitHub repo to `thisyearnofear/pledgebond`, point Vercel project to `pledgebond.vercel.app`, and configure `pledgebond.com` DNS. |
| R6 | Verify social / support URLs | Any remaining placeholder links (Calendly, Discord, etc.) were removed; replace with real support channels when ready. |

### Firebase Strategy (Updated)

**Decision: keep Firebase, but move the new `pledgebond` project to the Blaze plan.**

- Firebase project IDs cannot be renamed. The old project can have its display name changed, but the codebase already points to a project ID of `pledgebond` in `.firebaserc`, `frontend/src/config/publicConfig.js`, and `.env.example`, so a new project is the clean option.
- Spark (no-cost) is not viable for this app because Cloud Storage for Firebase requires Blaze as of September 2024. On Spark, Storage calls return 402/403 errors.
- Blaze still provides the same no-cost Firestore and Auth quotas; you only pay for overages. For early-stage usage, the bill will likely be $0 while removing the Spark restrictions.
- No-cost limits on Blaze: 1 GiB Firestore storage, 50k reads/day, 20k writes/day, 20k deletes/day, 10 GiB egress/month; 50k MAU for Auth; 5 GB Storage stored, 1 GB downloaded/day.
- Long-term migration off Firebase is possible but should be staged: Storage first (small surface), then Auth, then Firestore last (large surface). For launch, the integration is pragmatic and cost-effective.

### Medium Priority — Scale & Reliability

| # | Item | Impact |
|---|---|---|
| S1 | Full-collection scans on hot path (`ProjectDataService.loadAllProjects`, `hackathons/leaderboard.js` do `db.collection("projects").get()` with no `where`/`limit`) | Firestore read costs dominate at 10k+ projects. Needs cursor pagination with existing `ecosystem+createdAt` index. |
| S2 | Server-side GitHub cache (`github_cache` collection exists in rules but isn't read by the read path; per-project fan-out hits 5k/hr ceiling) | Cold cache = N×4 proxy calls per page load. Needs shared server cache layer. |
| S3 | In-memory rate limiters on serverless (all rate limiters are per-instance Maps; Vercel serverless makes them advisory) | Sensitive routes (payout-leads POST, agent x402) need Upstash Redis or Vercel KV. |
| S4 | Auth-listener race in `authStore.attachAuthListener` (serial `getDoc` calls between `loading: true/false`; rapid sign-out→sign-in can apply stale profile) | Needs generation token to discard stale loads. |
| S5 | Firestore rules/code drift (`circleWebhookEvents` collection written by webhook but not declared in rules) | Server SDK bypasses rules so it works, but rules are out of sync. |

### Product Design — The Winner Lifecycle

| # | Item | Description |
|---|---|---|
| P1 | 5-stage winner lifecycle | Verification → Curated Backer Match (72h window) → Milestone Unlock → Payout Day → Reputation Compounding. Each stage needs a ritualized moment. Only Verification is done. |
| P2 | Capital Agent for winners | Repurpose the agent layer to answer the winner's question: "Given my verified win + GitHub history, what's my recommended rail mix, projected capital, and backer match?" Currently agents only serve backers. |
| P3 | Productize "Get Paid Today" | The `build.js?ref=payouts` copy promises speed but there's no corresponding feature. Verified winners should request accelerated payout with a visible countdown and payout-day moment. |
| P4 | Unify winner entry doors | `WinnerGate.js` and `PayoutLeadForm.js` have different data schemas, verification paths, and outcomes. Should share one form, one path, one queue. |

### UI/UX Polish

| # | Item | Description |
|---|---|---|
| U1 | Migrate remaining pages to semantic tokens | `hackathons/[id].js`, `projects/[ecosystem]/[slug]/index.js`, `profile.js` still use raw `bg-gray-50` etc. `u/[username].js` is done; others follow the same pattern. |
| U2 | Backer portfolio ceremony | No portfolio-level "your backing earned X% return" celebration. Backers need outcome-side moments, not just decision-side. |
| U3 | Partial semantic-token adoption in components | Several components use raw Tailwind palette alongside semantic tokens. Needs a sweep for consistency. |

### Organizers

| # | Item | Description |
|---|---|---|
| O1 | Organizer self-serve + dashboard | Organizers have no self-serve onboarding (admin-only). No dashboard showing "your hackathon's winners, their verified status, their funding raised on PoS." Would make PoS the post-hackathon follow-through layer. |

---

## Architecture Notes (Updated)

### Winner Verification Flow (End-to-End)

1. Builder submits claim via `WinnerGate.js` → `POST /api/winner-verification` → `winnerClaims` collection (status: `pending`)
2. Admin reviews in `/admin/winner-claims` → `PUT /api/admin/winner-claims` (action: `approve`)
3. Approval writes `hackathonWinners/{uid}` + sets `verifiedWinner: true` on user doc + writes `winner_verified` activity
4. Builder sees notification (🏆) within 60s + full-screen Verification Moment overlay on next session
5. Builder's public portfolio (`/u/[username]`) shows Verified Winner badge

### Payout Verification Flow (End-to-End)

1. Payout lead submitted via `PayoutLeadForm` → `payoutLeads` collection
2. Daily cron (`/api/payout-leads/process`) processes leads with evidence URLs → creates project claims with `verificationStatus: "pending"`
3. Cron's second pass calls `PayoutVerifierService.verify()` on claims with `payoutTxHash` or `circleTransferId`
4. Verified payouts upgrade to `verificationStatus: "payout_verified"` with `payoutVerifiedAt` + `payoutActualAmount`
5. Builder receives "🎉 Payout verified!" notification with amount and project link
6. Only verified claims surface on the public leaderboard

### Notification System

Activities written to the `activities` collection are polled by `useNotificationFeed` (60s interval) and transformed into notifications:

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

### Self-Verification Guard

The retired Solana Anchor program once enforced `ErrorCode::SelfVerificationNotAllowed` client- and on-side. Today the guard is structural: `HackathonRegistry.declareWinner` / `recordPayout` are host-or-admin only, and credibility is derived from that public payment history — a builder cannot vouch for themselves because the registry records who declared and who paid, not what a score says.

### Trust Gate (Leaderboard)

Claims on the public leaderboard must pass:
- `verificationStatus` is `payout_verified` **or** `evidence_attached` with a real `evidenceUrl`
- Claims with `verificationStatus: "pending"` are excluded entirely
- Claims with `verificationStatus: "evidence_attached"` but no `evidenceUrl` are excluded

This ensures unverified self-attested wins never appear on leaderboards that winners' peers and backers read.

### Activity Logging Endpoint

`POST /api/activity/log` — authenticated, allowlisted-types-only endpoint for client-initiated activity logging. Currently supports `backing_received` (resolves builder uid from wallet address via `wallet_index` lookup). Recipient must differ from the actor.
