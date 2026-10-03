# Glossary

Defines every domain-specific term used across the codebase and docs.

---

| Term | Category | Definition |
|------|----------|------------|
| **Bettor** | Role | Participant who stakes USDC on whether a declared win will actually be paid out. Bounded downside at their stake. Held in a pool strictly separate from lending capital — bettors never fund loans or absorb defaults. |
| **Bridge Loan** | Product | USDC advanced to a builder against a confirmed, declared win. Repaid when the organizer disburses the prize. The core instrument. |
| **Bridge Lender** | Role | Capital provider who funds bridge loans. Bears credit risk: loses money when a builder defaults. |
| **Collateral** | Concept | Assets a builder locks to secure a bridge loan. Released on repayment, liquidated on default. |
| **Confirmed Win** | Concept | A hackathon win anchored on-chain via `declareWin`, producing a dated public record that makes the unpaid prize legible. The precondition for any loan. |
| **Coverage Rate** | Metric | Share of a builder's declared wins that were settled in full. Derived, never assigned. |
| **Credibility** | Metric | Public payment record: coverage, speed, and defaults. Derived from settled outcomes by the contract. There is no admin who sets it. |
| **Declared Win** | Concept | An on-chain assertion that a builder won a given hackathon and is owed a given prize. The claim that a bridge loan is written against. |
| **Default** | Concept | A bridge loan not repaid by its due date. Resolves by collateral liquidation or first-loss absorption. |
| **First-Loss Tranche** | Product | A designated capital slice that absorbs loan defaults up to its size, protecting lenders above it. The mechanism that lets the platform itself never absorb a loss. |
| **Notional Fee** | Concept | A fee charged in basis points of transaction value — loan origination and settlement. The platform's only revenue. Deliberately not a share of winnings. |
| **Overcollateralization** | Concept | Securing a loan with collateral worth more than the principal. The cleanest form of zero platform risk: default means liquidation, not a loss. |
| **Payout Verification** | Concept | Confirming an organizer's prize payment actually settled, via on-chain receipt or Circle transfer id. Feeds coverage and speed. |
| **Prize Routing** | *(deprecated)* | Old name for settling a bridge loan from a prize disbursement. Retained as the settlement step, but no longer involves platform escrow or multiplier-backed backers. |
| **Repayment** | Concept | The builder returning bridge loan principal plus the settlement fee, typically when the organizer pays the prize. |
| **Settlement** | Concept | Closing a bridge loan: repaying the lender, releasing collateral, updating the builder's credibility record. |
| **Time-to-Pay** | Metric | Days between a declared win and the prize actually landing. The North Star. |

---

## Infrastructure terms

| Term | Category | Definition |
|------|----------|------------|
| **Bags** | Service | Solana token-launch mechanism. Optional and off the critical path — not collateral for a loan, not a backer reward. |
| **Cloak** | Service | Privacy layer for shielded USDC transfers on Solana. Keeps positions and payment amounts hidden. |
| **Compass Score** | Metric | Lender portfolio health score — measures diversification and risk concentration. |
| **Entity Secret** | Config | Circle API credential used to sign requests to the W3S SDK. Server-side only — must never reach the frontend. Set via `CIRCLE_ENTITY_SECRET`. |
| **HackathonRegistry** | Contract | Source of truth for hackathons and winner declarations. `declareWinner` / `recordPayout` anchor the `declaredAt` / `paidAt` pair that makes a win underwritable and a builder's payment history public. |
| **Idempotency Key** | Config | Unique token submitted with each Circle API request to prevent duplicate transactions on retry. Persisted in Firestore (`circleIdempotency`) before submission. |
| **LiquidityRail** | Contract | Core contract replacing the deleted credit model. Holds loan principal, collateral, bet stakes, and accrued fees as separately-accounted reserves. |
| **Nanopayment** | Payment | Sub-cent USDC payment for AI agent calls via x402 protocol on Arc. |
| **QVAC** | Service | Tether's local-first AI inference SDK. On-device analysis that never sends project data to the cloud. |
| **SNS** | Identity | Solana Name Service — `.sol` domain identities for human-readable wallet addresses |
| **Torque** | Service | External incentive/boost system for project discovery (affects sorting and visibility) |
| **W3S** | SDK | Circle's Developer-Controlled Wallets SDK (`@circle-fin/developer-controlled-wallets`). Manages wallet creation, USDC transfers, and smart contract execution. Replaces the older `@circle-fin/circle-sdk` for all server-side operations. |
| **x402** | Protocol | Nanopayment protocol on Arc for per-call AI agent billing |

---

## Deleted terms

These described the previous credit-line model and must not reappear.

| Term | Why it's gone |
|------|----------------|
| **Backer** | Replaced by **Bridge Lender** (credit risk) and **Bettor** (speculation). Pooling them corrupted both prices. |
| **Builder Credit Score** | Admin-assigned, 0–850. The market prices credibility now. |
| **Credit Line** | Replaced by **Bridge Loan**, which is against a specific confirmed win rather than a general credit facility. |
| **Milestone** | The 0–850 score, credit tiers, and multiplier ladders are all gone. |
| **Multiplier** | Any value above 100 is a promise backed by someone other than the prize. Removed entirely, not lowered. |
| **Rail** (three-rail stack) | Replaced by the loan + market split. |
| **Underwriter** | The platform never underwrites. |