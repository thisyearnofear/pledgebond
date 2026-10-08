# Growth — Sharing

How leaderboard sharing brings new builders in, and what guards it.

## Shareable surface (shipped)

Leaderboard entries render personalized OG cards via `GET /api/og/leaderboard`
(Edge runtime, `@vercel/og`, 1200×630, per-type gradient): giant rank numeral,
movement indicator, ecosystem badge, and type-specific metrics across 5 types
(`proof-builder`, `project`, `hackathon`, `builder`, `backer`).

- Resolution: `useLeaderboardOG` turns `?ref=<type>-<rank>` into the
  highlighted entry + OG meta tags (`frontend/src/hooks/useLeaderboardOG.js`).
- Sharing: `ShareButton` opens X / Farcaster intents with the deep link
  (`frontend/src/components/leaderboard/ShareButton.js`).
- Render: `frontend/src/pages/api/og/leaderboard.js`.
- Copy: `SHARE_TEXT_VARIANTS` in `frontend/src/components/leaderboard/tabs.js`
  — 3 variants per entry type. Index 0 preserves the original copy; 1–2 are
  test variants. `pickShareVariant` picks randomly; the index travels in the
  share URL (`?v=`) so clicks, landings, and signups attribute per-variant.

## Guardrail (enforced in code)

`isShareableEntry(entryType, entry)` (`tabs.js`) doubles credibility as
distribution control: `ShareButton` returns `null` for anything not shareable,
so nothing in a shared OG card is self-attested.

- Hackathon entries: always shareable — the listing API only emits them after
  the verified-claim trust gate (`payout_verified` / `evidence_attached` +
  real `evidenceUrl`).
- All other types: require `(entry.verifiedWins || 0) > 0`.

Limit: the OG endpoint itself is unauthenticated — anyone can render
`?type=hackathon&rank=1&name=Alice`. The guardrail is upstream (which entries
get a `ShareButton`), not at image render. Torque-sourced tabs
(builders/lenders) are not win-gated the way hackathon tabs are.

## Measurement (shipped)

Share URLs carry `?ref=<type>-<rank>&s=<sharerCode>&v=<variant>`:

- Sharer identity: `pages/leaderboard.js` hydrates `setSharerCode` from the
  signed-in uid (`generateReferralCode`); `ShareButton` attaches `s=` + `v=`.
- Landing: first-touch wins — `storeReferralCode` + `storeShareAttribution`
  (`frontend/src/lib/gamification/referral.js`, `pos_share_attr`), then
  `funnel_step` with `step: "landing"`.
- Click: `ShareButton` fires `leaderboard_share_clicked` (now with `variant`)
  plus `funnel_step` with `step: "clicked"`, `funnel: "share"`.
- Signup: `authStore.ts` writes a `referrals` doc with
  `source: "leaderboard_share"`, `shareCode`, `shareVariant`, `shareRef`.
- Sink: `POST /api/analytics/event` allowlists the `share` funnel and the
  `variant` / `entryType` / `rank` / `platform` / `ref` props into
  `funnelEvents`.

Worksheet: `node scripts/compute-share-k-factor.js [--days=N]` (read-only) —
`K = invites-per-sharer × landing→signup conversion`, with a per-variant
clicked / landed / signups / conv breakdown. That table is what the copy test
is scored on.

## Next experiments (instrumented, awaiting data)

1. K-factor worksheet on live shares → new builders.
2. 48-hour read on the badge/share copy variants (v0 vs v1 vs v2).

## Non-goals

No token incentive for shares — it creates a sybil incentive aimed directly
at the credibility signal (see `VISION.md` Explicitly not doing).
