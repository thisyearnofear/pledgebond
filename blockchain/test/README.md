# PledgeBond Test Suite

Tests for the PledgeBond smart contracts.

## Contract Tests

- **LiquidityRail.test.js** — bridge loans against confirmed wins, plus the payout market. Written around the five invariants an auditor asks first:
  1. Can any legitimate sequence of user actions make the platform pay principal? (Must be no.)
  2. Can `withdrawFees` reach anything but `accruedFees`?
  3. Can bet capital ever fund or subsidise a lending payout?
  4. Is there a setter for reputation? (There must not be.)
  5. Can a settlement be claimed on an unrelated winner's payout?
- **HackathonRegistry.test.js** — hackathons, verifiers, and the `declareWinner` / `recordPayout` credibility anchor.

`BuilderCreditCore` and its tests were removed when the credit-line model was
retired. See [`docs/CHANGELOG.md`](../../docs/CHANGELOG.md) for the pivot.

## Running Tests

```bash
npx hardhat test
```

A single file:

```bash
npx hardhat test test/LiquidityRail.test.js
```

## Test Coverage

```bash
npm run coverage
```

Writes to `coverage/`.