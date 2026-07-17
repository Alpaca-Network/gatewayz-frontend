# Gatewayz Beta - Claude Code Instructions

## Project Overview

**Gatewayz Beta** (beta.gatewayz.ai) — AI model management and routing platform. Unified interface for 300+ LLMs from 60+ providers. Next.js 15 App Router + React 18 + TypeScript 5.9.

**Backend API:** `https://api.gatewayz.ai` (env: `NEXT_PUBLIC_API_BASE_URL`), Bearer token auth.

## Quick Reference

```bash
pnpm dev              # Dev server
pnpm build            # Production build
pnpm typecheck        # Type checking
pnpm lint             # Linting
pnpm test             # Unit tests (Jest)
pnpm test:e2e         # E2E tests (Playwright)
pnpm test:all         # All tests
```

**Package manager:** pnpm (never use npm or yarn)
**Deployment:** Vercel (primary), Railway (secondary), Tauri (desktop). Firebase App Hosting scaffold was removed (dead, unused) in the 2026-07 MVP North Star refactor — see `docs/superpowers/plans/2026-07-17-frontend-mvp-refactor.md`.

## Key Architecture

**Post-refactor note (2026-07):** this codebase went through an MVP North Star alignment refactor that cut ~30k LOC of duplicate engines, dead surfaces, and hardcoded catalog data. See the plan's `## Outcome` section for what changed and why. In short: **one** chat UI tree (`chat-v2`), **one** auth model (`GatewayzAuthContext` + `session-cache.ts`, no xstate/dup context), **one** DB-driven catalog path (`catalog-api.ts` + `lib/hooks/use-catalog.ts`), prepaid-only checkout (no subscription management UI), single E2E framework (Playwright only, Cypress cut), single lockfile (pnpm).

### Directory Layout
- `src/app/` — Next.js App Router pages + API routes
- `src/components/` — React components (`ui/` = shadcn/Radix primitives, `chat-v2/` = the single surviving chat tree)
- `src/context/` — React Context providers (`gatewayz-auth-context.tsx` is the single auth API, `gateway-context.tsx`)
- `src/hooks/` — Custom hooks
- `src/lib/` — Services, utilities, stores
- `src/lib/store/` — Zustand stores (`auth-store.ts`, `chat-ui-store.ts`)
- `src/lib/streaming/` — SSE parser, chat streaming (the only streaming engine — the old `lib/streaming.ts` monolith was deleted)
- `src/lib/hooks/use-catalog.ts` — `useModels`/`useModel`/`useProviders`/`useGateways` react-query hooks; the canonical way for client components to read the model/provider/gateway catalog
- `src/lib/catalog-api.ts` — typed getters backing the catalog hooks, reading the backend's DB-driven catalog via the Next `/api/*` proxies (desktop/Tauri routes straight to the backend, since static export has no API routes)
- `src/types/` — TypeScript type definitions

### State Management
- **Auth:** `GatewayzAuthContext` (`src/context/gatewayz-auth-context.tsx`) — single auth model; the parallel xstate-flavored context, `lib/auth/` module, and dup token-refresh pair were deleted
- **Gateway routing:** `GatewayContext` (`src/context/gateway-context.tsx`)
- **UI state:** Zustand stores (`src/lib/store/`)
- **Server state:** React Query (`@tanstack/react-query`) — the caching standard; catalog-side Redis caching was retired (chat-session Redis caching is unaffected and stays)
- **Persistence:** localStorage (`gatewayz_api_key`, `gatewayz_user_data`)

### Key Services
- `src/lib/models-service.ts` — Multi-gateway model fetching (server-side; backs `/api/models`)
- `src/lib/catalog-api.ts` + `src/lib/hooks/use-catalog.ts` — DB-driven catalog getters/hooks (single source of truth for client components)
- `src/lib/gateway-registry.ts` — Frontend-only gateway display config (colors/logos/priority/env-vars) + validation/normalization; the backend `/v1/gateways` list is merged with this at `/api/gateways`. Kept deliberately (not hardcoded catalog duplication — see the refactor plan's Task 8 notes).
- `src/lib/models-data.ts` — Static model table. Kept deliberately as the Tauri static-export / CI / offline fallback only; no longer a primary data source for any live client component.
- `src/lib/chat-history.ts` — Chat session/history management
- `src/lib/api.ts` — API auth & utilities
- `src/lib/ai-sdk-chat-service.ts` — Vercel AI SDK chat service
- `src/lib/streaming/sse-parser.ts` — SSE streaming parser
- `src/lib/tier-utils.ts` — Tier system (Basic/Pro/Max)
- `src/lib/circuit-breaker.ts` — Fault tolerance for API calls

### Auth Flow
Privy (Email/Google/GitHub/Wallet) → backend validates → API key returned → stored in localStorage → `GatewayzAuthContext` provides to app.

Cross-domain: users auth on gatewayz.ai, redirected to beta.gatewayz.ai with token. See `src/components/SessionInitializer.tsx`.

### Tiers
- **Starter:** $35/month (3500 cents)
- **Pro:** $120/month (12000 cents)
- **Max:** $350/month (35000 cents)

## Conventions

### Code Style
- Always use TypeScript with proper types
- Use Tailwind CSS for styling, avoid custom CSS
- Use `"use client"` directive for interactive components
- Follow existing component hierarchy and patterns
- Use shadcn/Radix UI primitives from `src/components/ui/`

### Patterns
- Extract business logic into custom hooks (`src/hooks/`)
- Use service classes for API calls (ChatHistoryAPI, models-service, catalog-api)
- Use Zustand for UI state, React Query for server state
- Use circuit breaker pattern for external API calls
- Use SSE streaming for chat completions
- Virtual scrolling for large lists (`useVirtualScroll`)

### Adding a New Gateway
No frontend changes needed — gateways auto-discover from backend.
1. Add to backend `GATEWAY_REGISTRY` in `backend/src/routes/catalog.py`
2. Ensure models include `source_gateway` field
3. Frontend discovers automatically via `GET /gateways`

## Claude Code Workflow

### Task Management
For large tasks, use the dev docs workflow:

1. `/dev-docs [description]` — Create strategic plan
2. Review plan, then `/create-dev-docs` — Generates files in `dev/active/[task-name]/`
3. Implement phase by phase, update task files as you go
4. `/code-review` between phases
5. `/dev-docs-update` before compacting conversation

### Continuing Tasks
1. Check `dev/active/` for existing task files
2. Read all three files (plan, context, tasks) before proceeding
3. Update files as you work

### Key Slash Commands
| Command | Purpose |
|---------|---------|
| `/dev-docs [desc]` | Create implementation plan |
| `/create-dev-docs` | Generate task files from plan |
| `/dev-docs-update` | Update docs before compaction |
| `/code-review` | Review code architecture |
| `/build-and-fix` | Fix TypeScript errors |
| `/test-unit` | Run Jest tests |
| `/test-e2e` | Run Playwright tests |
| `/test-api [route]` | Test specific API route |
| `/route-research [feature]` | Map affected API routes |

### Quality
- Skills auto-activate based on keywords/files — no manual invocation needed
- Build checker runs `pnpm typecheck` after responses
- Always fix TypeScript errors before moving on
- Run `/code-review` before pushing

## Additional Docs
- `docs/blueprint.md` — Full project blueprint
- `.github/ARCHITECTURE.md` — Architecture details
- `BETA_TEAM_QUICK_START.md` — Cross-domain session transfer guide
- `docs/` — Integration guides (Statsig, Stripe, Chat API, Tiers)
- `.claude/README.md` — Claude Code infrastructure docs
