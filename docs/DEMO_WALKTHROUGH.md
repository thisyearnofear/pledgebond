# Live Demo: bridge loan + payout market, end to end

One command closes a real bridge loan **and** resolves a real payout market on
Arc Testnet with four genuinely separate wallets:

```bash
cd blockchain
npx hardhat run scripts/demo-loan.js --network arcTestnet
```

## The parties

| Role | Key | Pays for | Receives |
|------|-----|----------|----------|
| Organizer | `PRIVATE_KEY` (deployer) | the prize (0.60 USDC) | — |
| Builder | `BUILDER_PRIVATE_KEY` | 0.33 collateral at accept + 0.30 principal at repay | 0.285 USDC upfront (principal − 5% fee) |
| Lender | `LENDER_PRIVATE_KEY` | 0.30 principal at accept + 0.05 "won't pay" hedge | 0.30 at par on repayment |
| Bettor | `BETTOR_PRIVATE_KEY` | 0.05 stake on "paid" | 0.10 — the whole pool, 2x |

Arc Testnet charges gas in USDC, so every wallet funds itself from the same
rail money; the organizer tops up demo wallets when short and re-sweeps after
settlement so the demo is repeatable.

## The steps the script walks

1. **Funding wallets** — organizer tops up whoever can't cover its role.
2. **`registry.declareWinner`** (organizer/host) — anchors the win on-chain; the declaration index is the identity the rail binds to.
3. **`rail.anchorWin`** (builder) — the unpaid prize becomes a legible, underwritable claim (`winId`). One rail win per declaration — a prize can never be borrowed against twice.
4. **`rail.proposeLoan`** (lender) — offers terms against the win; nothing moves yet.
5. **`rail.acceptLoan`** (builder) — the consent moment: the builder posts their own collateral and draws principal minus the 5% origination fee in one transaction. *Asserted: the lender is a separate wallet, collateral is escrowed from the builder, and platform revenue is exactly the fee — the platform funded nothing (invariant 1).*
6. **`rail.placeBet`** (bettor + lender hedge) — opposing stakes while the win is unresolved. *Asserted: the bet pool grew by exactly the stakes and lending reserves did not move (invariant 3 — bettor capital never funds a loan).*
7. **Organizer pays the prize** — a real USDC transfer, not a simulation.
8. **`registry.recordPayout`** (verifier attestation) — the `paidAt` timestamp that makes time-to-pay public. With `requiredSignatures > 1`, this is M-of-N: one key cannot forge the record.
9. **`rail.repayLoan`** — loan REPAID; lender at par; the builder's collateral releases in the same transaction. Credibility (`loansRepaid`, `winsPaid`) is derived on-chain, never assigned (invariant 4).
10. **`rail.resolveMarket`** — the market resolves `PAID` because the registry proves the payout — independent of the loan.
11. **`rail.claimWinnings`** — winning side takes the whole pool pro-rata (2x on a 0.05 stake); the losing side's claim reverts — nothing to claim. Verified from `WinningsClaimed` event payloads, not balances, because claimers pay their own gas.
12. **Re-sweep** — demo funds return to the organizer for the next take.

Every run lands on a fresh `winId` (state from prior runs stays on-chain as
proof it happened).

> Note: wins 1–9 on `0xa8CB00A09092203Dd3274EBc065845fe034a0d38` were
> recorded against the v3 contract — the `anchorWin → propose → accept`
> lifecycle is a **fresh deployment**, not an upgrade, so new runs anchor
> on the new proxy.

## The order book you will see on /back?tab=discover

On the fresh deployment the order book starts empty — every `anchorWin`
adds a fundable win and every demo run seeds one. Re-run `demo-loan.js`
and its win lands with an open proposal attached; `demo-default.js`
PHASE=1 lands one with a committed tranche. Both scripts leave their
wins on-chain as the track-record strip a new lender sees before funding
anything, and there is deliberately no admin cancel for a stale win
(invariant 4) — old entries age out of the panel by `resolutionDeadline`.

## The default rehearsal (the unpaid path)

`blockchain/scripts/demo-default.js` runs the other branch of the rail in
two phases — the testnet clock cannot be warped and loans require
`durationDays >= 1`:

1. **PHASE=1** — shrink the market window to the loan term (`setResolutionWindow`
   — it freezes into the win at anchor, so this only affects new wins),
   declare a win, anchor it, fund it as **TRANCHE_BACKED**: the lender
   `proposeLoan`s, the organizer `commitTranche`s the first-loss capital,
   the builder `acceptLoan`s and draws the principal net of fee. Bettor
   stakes "paid", lender stakes "won't pay". State lands in
   `deployments/arcTestnet_default_rehearsal.json`.
2. **PHASE=2, after `dueAt` and the market deadline** — the organizer never
   pays: `defaultLoan` → the lender is made whole **from the organizer's
   named tranche capital** (`totalTrancheAbsorbed` moves, `accruedFees` does
   not — invariant 1), `resolveMarket` resolves the market **UNPAID** from
   the absence of a registry payout, the skeptic side claims the pool 2x,
   `withdrawTranche` correctly refuses (the tranche was consumed), and the
   builder's `loansDefaulted` + `winsUnpaid` tick-up is the receipt the next
   lender will price against (invariant 4).

## Talking points for the walkthrough

- **"Paid in hours, not 90 days"**: step 5 turns a win declared minutes ago into spendable USDC; the whole script runs in ~2 minutes.
- **Nothing is promised by the platform**: each `✔ invariant:` line is the contract refusing to be the underwriter — lenders take credit risk, bettors take resolution risk, the platform only takes the fee.
- **Credibility is a receipt**: step 9's builder history is queryable by anyone (`rail.builderHistory(address)`), and it is exactly what the next loan gets priced against.
