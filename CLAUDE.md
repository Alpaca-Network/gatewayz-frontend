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
**Deployment:** Firebase App Hosting, Node 18+

## Key Architecture

### Directory Layout
- `src/app/` — Next.js App Router pages + API routes
- `src/components/` — React components (187 files, `ui/` = shadcn/Radix primitives)
- `src/context/` — React Context providers (auth, gateway)
- `src/hooks/` — Custom hooks (28 files)
- `src/lib/` — Services, utilities, stores (80+ files)
- `src/lib/store/` — Zustand stores (auth, chat UI)
- `src/lib/streaming/` — SSE parser, chat streaming
- `src/types/` — TypeScript type definitions

### State Management
- **Auth:** `GatewayzAuthContext` (`src/context/gatewayz-auth-context.tsx`)
- **Gateway routing:** `GatewayContext` (`src/context/gateway-context.tsx`)
- **UI state:** Zustand stores (`src/lib/store/`)
- **Server state:** React Query (`@tanstack/react-query`)
- **Persistence:** localStorage (`gatewayz_api_key`, `gatewayz_user_data`)

### Key Services
- `src/lib/models-service.ts` — Multi-gateway model fetching (17+ providers)
- `src/lib/gateway-registry.ts` — Dynamic gateway registration
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
