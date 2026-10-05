# Contributing

## Quick Start

```bash
npm run setup     # install deps + setup env
npm run dev       # frontend dev server on :3000
```

Requirements: Node 22, pnpm 9.12.

## Project Structure

```
frontend/          — Next.js app (pages, components, contexts, services)
blockchain/        — Hardhat workspace (Solidity contracts)
snap-server/       — Farcaster Snap server
docs/              — Architecture, changelog, vision
scripts/           — Dev utilities (setup, env, cleanup)
```

## Development Flow

1. **Branch from main.** Use `fix/`, `feat/`, or `chore/` prefixes.
2. **Make changes.** Run `npm run dev` in the frontend for hot reload.
3. **Type-check:** `cd frontend && npx tsc --noEmit`
4. **Test:** `cd frontend && npx vitest run` or `npm run blockchain:test` for Solidity.
5. **PR with a summary** of what changed and why.

## Coding Conventions

- **Components:** Prefer `function ComponentName() { ... }` named exports. Use `common/` for shared UI primitives (Button, Card, Modal, Toast). Keep components under 300 lines; split with composition.
- **Services:** Singleton classes in `services/`, one concern per file. API routes in `pages/api/` are thin BFF wrappers — business logic lives in services.
- **Styles:** Use semantic Tailwind tokens (`bg-surface`, `text-primary`, `border-default`) over raw colors (`bg-white`, `text-gray-900`, `border-gray-200`). See `themes.css` for the full token set. Dark mode is handled automatically via `class` strategy — test both.
- **API routes:** Each route validates method, returns consistent `{ success, data/error }` shape, and uses `withApiMiddleware` for rate limiting + CORS.
- **State:** React Context for global state (auth, wallet, theme). Server state for fetched data. Avoid prop drilling beyond 2 levels.

## Commit Messages

Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`. Keep the first line under 72 chars.

## Before Merging

- `npx tsc --noEmit` passes
- No `console.log` in production paths (use `console.warn`/`console.error` for diagnostics)
- New UI has loading/error/empty states
- New API routes use `withApiMiddleware`
