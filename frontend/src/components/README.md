# Components Directory

Shared React components organized by domain.

## Structure

```
src/components/
├── admin/              # Admin panel components
├── Auth/               # Authentication (Login, wallet connect)
├── back/               # Backer-facing pages (Discover, Portfolio, Economy)
├── backer/             # Backer dashboard
├── common/             # Reusable UI primitives (no directories, all flat files)
│   ├── cards/          #   StatCard
│   ├── illustrations/  #   EmptyState, SuccessIllustration, lottie/
│   ├── Icons/          #   Mac, Windows, Linux icons
│   └── layout/         #   Navbar/, Footer/
├── contracts/          # Contract integration
├── dashboard/          # Builder dashboard
├── ecosystems/         # Ecosystem selection
├── ethos/              # Nautical theme components (nautical-card, compass-rose, etc.)
├── funding/            # Cross-chain funding UI
├── github/             # GitHub import/data
├── hackathons/         # Hackathon-specific components
├── onboarding/         # UnifiedOnboarding tour
├── projects/           # Project cards, details, editor
├── sections/           # Landing page sections (Hero, Features, etc.)
└── showcase/           # Demo/showcase components
```

## Import

```jsx
import { Button, Card, Modal, Toast } from '@/components/common';
import { ProjectCard } from '@/components/projects';
```

Common primitives (Button, Card, Modal, Toast, Input, LoadingStates) use semantic Tailwind tokens from `themes.css`. Run `npx tsc --noEmit` after adding or modifying components.
