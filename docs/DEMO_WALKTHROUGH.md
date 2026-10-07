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
| Builder | `BUILDER_PRIVATE_KEY` | 0.30 principal + fee, from the prize | 0.285 USDC upfront (principal − 5% fee) |
| Lender | `LENDER_PRIVATE_KEY` | 0.30 principal + 0.33 collateral escrow | 0.30 at par on settlement + collateral back to builder |
| Bettor | `BETTOR_PRIVATE_KEY` | 0.05 stake on "paid" | 0.10 — the whole pool, 2x |

Arc Testnet charges gas in USDC, so every wallet funds itself from the same
rail money; the organizer tops up demo wallets when short and re-sweeps after
settlement so the demo is repeatable.

## The eleven steps the script walks

1. **Funding wallets** — organizer tops up whoever can't cover its role.
2. **`registry.declareWinner`** (organizer) — anchors the win on-chain.
3. **`rail.declareWin`** (builder) — the unpaid prize becomes a legible, underwritable claim (`winId`).
4. **`rail.openLoan`** (lender) — builder receives principal minus the 5% origination fee. *Asserted: the lender is a separate wallet, collateral is escrowed from it, and platform revenue is exactly the fee — the platform funded nothing (invariant 1).*
5. **`rail.placeBet`** (bettor + lender hedge) — opposing stakes while the win is unresolved. *Asserted: the bet pool grew by exactly the stakes and lending reserves did not move (invariant 3 — bettor capital never funds a loan).*
6. **Organizer pays the prize** — a real USDC transfer, not a simulation.
7. **`registry.recordPayout`** (organizer) — the `paidAt` timestamp that makes time-to-pay public.
8. **`rail.settleLoan`** — loan REPAID; lender at par; builder's collateral released net of principal. Credibility (`winsSettledInFull`) is derived on-chain, never assigned (invariant 4).
9. **`rail.settleBet`** — the market resolves `PAID` because the registry proves the payout.
10. **`rail.claimBet`** — winning side takes the whole pool pro-rata (2x on a 0.05 stake); losing side claims exactly nothing. Verified from `BetClaimed` event payloads, not balances, because claimers pay their own gas.
11. **Re-sweep** — demo funds return to the organizer for the next take.

Every run lands on a fresh `winId` (state from prior runs stays on-chain as
proof it happened — see wins 1–9 on
`0xa8CB00A09092203Dd3274EBc065845fe034a0d38`).

## The order book you will see on /back?tab=discover

- **Wins 7–9 ("Bridge Demo", settled + repaid)** — the last three full
  walkthrough runs. This is the track-record strip a new lender sees before
  funding anything. Wins 8 and 9 also resolved their bettor market `PAID`;
  win 7's market (2 bets, 0.10 pool) is left open on purpose — calling
  `settleBet` on it is a one-line demo anyone can do live, and it shows
  the market resolving from the payout record, not from an admin.
- **Wins 4, 5, 6 (shown as `Win #4`…`Win #6`)** — declared while debugging
  the lender listing (they have no `registry.declareWinner` twin, which is
  why the panels fall back to the address-style name). They are deliberately
  left DECLARED and unfunded: the live UI shows a non-empty order book with
  real `placeBet` markets, so a visitor's first Fund/Bet click hits a real
  open win instead of an empty list. To clear them, fund and settle one
  through the normal path or re-run the demo — no contract change is needed
  (there is deliberately no admin cancel; invariant 4).
- **Wins 1–3** — the earliest bridge-loan runs, all without a bettor
  market: wins 1 and 2 still carry OPEN loans ($2.00 and $1.00 principal),
  win 3 completed its loan leg (settled + repaid).

## Talking points for the walkthrough

- **"Paid in hours, not 90 days"**: step 4 turns a win declared minutes ago into spendable USDC; the whole script runs in ~2 minutes.
- **Nothing is promised by the platform**: each `✔ invariant:` line is the contract refusing to be the underwriter — lenders take credit risk, bettors take resolution risk, the platform only takes the fee.
- **Credibility is a receipt**: step 8's builder history is queryable by anyone (`rail.builderHistory(address)`), and it is exactly what the next loan gets priced against.
