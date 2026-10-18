# PledgeBond Smart Contracts

## Current implementation

Two contracts:

- **`HackathonRegistry.sol`** — hackathons, verifiers, and the **credibility anchor**. `declareWinner` anchors `declaredAt`; `recordPayout` is index-exact and **M-of-N**: `paidAt` is set only once `requiredSignatures` distinct verifiers attest a specific declaration — one compromised key cannot forge the payout record markets settle on. That pair is what makes an unpaid prize legible as an asset. `getPayoutStats` returns the latency distribution the leaderboard markets.
- **`LiquidityRail.sol`** — the core rail. Lifecycle: `anchorWin` binds a specific registry declaration → `proposeLoan` (lender offers terms) → `commitTranche` (named first-loss provider escrows) → `acceptLoan` (**the builder consents**: posts collateral, draws principal net of fee) → `repayLoan` / `defaultLoan`. `defaultLoan` fails closed once the registry records a payout: `dueAt` alone says nothing about whether the prize landed, so a recorded `paidAt` blocks liquidation of the builder's collateral. The payout market is parimutuel and resolves on the registry's `paidAt` or the per-win `resolutionDeadline` — never on the loan's fate. Holds collateral, tranche capacity, bet stakes, and accrued fees as **separately accounted reserves**.

### The invariants the contract enforces

1. **The platform never absorbs a credit loss.** Every loan is `OVERCOLLATERALIZED`, `TRANCHE_BACKED`, or `HYBRID` — collateral plus committed tranche always covers principal. On default the builder's collateral liquidates to the lender first, the tranche covers the shortfall, and surplus returns to its owner.
2. **Fees on notional only.** `accruedFees` is the sole withdrawable balance for `FEE_ROLE` — and it is *funded*: the fee is pulled into the contract inside `acceptLoan`, so withdrawals can never touch escrowed capital.
3. **Lenders and bettors never mix.** Bet stakes sit in a separate accounting pool from lending capital. `claimWinnings` pays only from the bet pool, pro-rata.
4. **Credibility is derived, never assigned.** `BuilderHistory` updates only from anchor, accept, repay, default, and market resolution. Builder consent is load-bearing: nobody can open a loan against someone else's win.
5. **No multiplier.** A routed prize splits by principal. Any value above 100 is a promise backed by someone other than the prize.

The audit question to answer before mainnet: *can any legitimate sequence of user actions make the platform pay principal?* It must be no.

### Known limits

- **`updateRegistry` covers staked markets, not zero-stake ones.** The guard checks `outstandingBetStakes == 0` (plus open loans, collateral, and tranches), but an anchored win can carry an `UNRESOLVED` market with no stakes. A registry swap in that window rebinds its `declarationIndex` and the market can mis-resolve against foreign data. Impact is stats-only — no claims can exist without stakes — but `BuilderHistory` can record a wrong outcome. If this ever matters, track a per-contract count of unresolved markets rather than proxying on stakes.
- **`totalBetOwed` exempts `updateRegistry` but not `updateUsdcToken`.** Resolved claims are already priced into the market record and pay out of the balance without consulting the registry — a registry swap can't strand them. A token swap can (claims pay in `usdcToken`), so `updateUsdcToken` keeps the full clean-book guard. Corollary: losing-side dust in a one-sided market is unclaimable, so `totalBetOwed` can sit permanently above zero and `updateUsdcToken` can end up frozen by dust. Admin-only and edge-case, but real.

### Interfaces

- `IHackathonRegistry.sol` — registry interface
- `ILiquidityRail.sol` — rail interface

### Mock contracts

- `MockUSDC.sol` — mock USDC for tests

## Testing

Tests live in `/test`:

- `LiquidityRail.test.js`
- `HackathonRegistry.test.js`

Run with `npx hardhat test`.

## Deploying

```bash
ADMIN_ADDRESS=<multisig> npx hardhat run scripts/deployTestnet.js --network arcTestnet
npx hardhat run scripts/smoke.js --network arcTestnet
```

`ADMIN_ADDRESS` should be a multisig. Without it the deployer key holds `DEFAULT_ADMIN_ROLE` — which on a UUPS proxy means a leaked key can upgrade the contract to arbitrary code. The deploy script warns loudly if it's unset on mainnet.

`smoke.js` runs read-only post-deploy checks and exits non-zero on any failure, so it can gate a cutover.

## See also

- [`docs/VISION.md`](../../docs/VISION.md) — product thesis and invariants
- [`docs/MONETIZATION_STRATEGY.md`](../../docs/MONETIZATION_STRATEGY.md) — how fees are taken