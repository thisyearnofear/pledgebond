# PledgeBond Frontend

This directory contains the frontend code for the PledgeBond platform, built with Next.js.

## Directory Structure

### Components

The `components/` directory contains React components organized by feature:

- **Auth/** - Authentication-related components
- **common/** - Reusable UI components
- **contracts/** - Components for interacting with smart contracts
- **dashboard/** - Dashboard components
- **funding/** - Funding-related components
- **github/** - GitHub integration components
- **navigation/** - Navigation components
- **onboarding/** - Onboarding flow components
- **projects/** - Project management components
- **testing/** - Test components
- **wallet/** - Wallet connection components

### State

The `contexts/` tree was replaced by `stores/` in Phase 3. State lives in
`useSyncExternalStore` stores rather than React context:

- `stores/authStore.ts` - authentication
- `stores/walletStore.ts` - wallets, nanopayments, and the liquidity `rail` slice
- `stores/notificationStore.ts` - in-app notifications

`BuilderCreditContext` is gone; the rail is reached through
`services/liquidityRailService.ts` and `useBuilderCredit()`.

### Pages

The `pages/` directory contains Next.js pages and API routes:

- **api/** - API routes, including Circle API integration
- **projects/** - Project-related pages
- **ecosystems/** - Ecosystem pages
- **dashboard.js** - Main dashboard page

### Utils

The `utils/` directory contains utility functions:

- **apiMiddleware.js** - API middleware for consistent handling
- **circleApi.js** - Circle API utilities
- **rateLimit.js** - Rate limiting implementation

### Lib

The `lib/` directory contains library code:

- **firebase/** - Firebase integration
- **auth/** - Authentication utilities
- **lifiIntegration.js** - Li.Fi integration
- **usdcPayments.js** - USDC payment utilities

### Other Directories

- **config/** - Configuration files
- **constants/** - Constant values and ABIs
- **hooks/** - Custom React hooks
- **middleware/** - Next.js middleware
- **providers/** - Provider components
- **schemas/** - Validation schemas
- **services/** - Service layer
- **styles/** - CSS and styling

## Key Features

1. **Web3 Integration** - Connects to Ethereum and other chains via MetaMask
2. **Circle Wallet Integration** - Integrates with Circle for programmable wallets
3. **Cross-Chain Functionality** - Uses Li.Fi for cross-chain transfers
4. **Smart Contract Interaction** - Interfaces with PledgeBond contracts
5. **GitHub Integration** - Links GitHub repositories and activity
6. **Dashboard** - User dashboard for managing projects and funding

## Development

To run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.
