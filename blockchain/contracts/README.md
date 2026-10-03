# PledgeBond Smart Contracts

## Current implementation

Two contracts:

- **`HackathonRegistry.sol`** — hackathons, verifiers, and the **credibility anchor**. `declareWinner` / `recordPayout` anchor the `declaredAt` / `paidAt` pair for a win. That pair is what makes an unpaid prize legible as an asset: it is the receipt a bridge loan is written against, and it is the public record that produces a builder's coverage rate and time-to-pay. `getPayoutStats` returns the latency distribution the leaderboard markets.
- **`LiquidityRail.sol`** — the core rail. Bridge loans against confirmed wins, plus a payout market. Holds principal, collateral, bet stakes, and accrued fees as **separately accounted reserves**.

### The invariants the contract enforces

1. **The platform never absorbs a credit loss.** Every loan is `OVERCOLLATERALIZED` (collateral ≥ principal, default means liquidation) or `TRANCHE_BACKED` (a designated first-loss slice absorbs defaults up to its size).
2. **Fees on notional only.** `accruedFees` is the sole withdrawable balance for `FEE_ROLE`. It is incremented atomically inside `openLoan` / `settleLoan`. There is no code path that can reach principal or collateral.
3. **Lenders and bettors never mix.** Bet stakes sit in a separate accounting pool from lending principal. `settleBet` can only ever pay from the bet pool.
4. **Credibility is derived, never assigned.** `BuilderHistory` updates from settled outcomes. There is no setter and no admin role.
5. **No multiplier.** A routed prize splits by principal. Any value above 100 is a promise backed by someone other than the prize.

The audit question to answer before mainnet: *can any legitimate sequence of user actions make the platform pay principal?* It must be no.

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