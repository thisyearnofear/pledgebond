# Torque MCP Integration — Friction Log

## Integration Overview
PledgeBond integrates Torque to track builder shipping velocity and backer engagement across the platform. Events are fired on project submissions, milestone completions, project backing, and AI agent usage.

## Setup Experience

### What Worked
- Torque docs are clear on the ingestion API shape (`POST https://ingest.torque.so/events`)
- The `userPubkey` + `eventName` + `timestamp` schema is minimal and easy to map to existing data
- Server-side proxy pattern keeps the API key secure while allowing client-initiated events

### Friction Points

| # | Category | Description | Severity |
|---|----------|-------------|----------|
| 1 | **Documentation** | No explicit REST API docs for ingestion — had to infer from quickstart + MCP examples. Would benefit from a standalone API reference page. | Medium |
| 2 | **Event Schemas** | Custom event schemas require creation via MCP tools or the server REST API (`POST https://server.torque.so/events` with `name` + `fields`). No bulk import or schema-as-code option. Discovered the server API through trial-and-error — not documented. | Medium |
| 3 | **Error Responses** | When sending malformed events, error messages could be more descriptive. Currently returns generic 4xx without field-level validation hints. | Low |
| 4 | **Leaderboard API** | No documented leaderboard retrieval API. We built our own from Firestore data + Torque events. A `GET /leaderboard` endpoint with velocity scores would save significant effort. | High |
| 5 | **Authentication** | Bearer token auth is simple but no mention of token rotation, scoping, or rate limits in docs. Would benefit from API key scopes (read-only, write-only, etc.). | Low |
| 6 | **MCP Tool Discovery** | The MCP server provides event tracking but no built-in analytics or dashboard queries. Adding query tools (top builders, event counts, velocity trends) would make the MCP much more useful. | Medium |

## Architecture Decisions

### Why a Server-Side Proxy?
The `TORQUE_API_KEY` is kept server-side only. Client code calls `/api/torque/events`, which forwards to Torque. This prevents API key exposure in browser bundles.

### Graceful Degradation
All Torque tracking is fire-and-forget. If the API key is missing or the request fails, the core app flow is never blocked. This is critical for a hackathon demo where we might not have credentials configured.

### Event Mapping
| PledgeBond Action | Torque Event | User Identifier |
|---------------------|--------------|-----------------|
| Project submitted | `project_submitted` | Firebase UID / wallet address |
| Loan opened | `loan_opened` | Wallet address |
| AI agent used | `ai_agent_used` | Wallet address |
| Milestone completed | `milestone_completed` | Firebase UID |

## Metrics We're Tracking
- **Shipping Velocity**: (projects × 5) + (milestones × 10) — weighted to reward completed work over volume
- **Lending Activity**: (total lent × 0.1) + (unique builders lent to × 10) — rewards diversification
- **AI Engagement**: Tracks which AI agents (underwriter, QVAC analysis) are most used

## Next Steps
- [x] Sign up at platform.torque.so and create project
- [x] Create custom event schemas for all 4 event types
- [x] Add `TORQUE_API_KEY`, `TORQUE_API_TOKEN`, `TORQUE_PROJECT_ID` to environment variables
- [ ] Create an active incentive program via Torque MCP for project discovery ranking
- [ ] Build richer leaderboard with time-windowed velocity (7d, 30d, all-time)
- [ ] Attach custom events to project via MCP (required for query builder / incentive targeting)
- [ ] Add real-time leaderboard updates via Torque webhooks (if available)
