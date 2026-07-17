# Tasks 8–12 (Phase 3 Consolidations) — Implementation Report

Worktree: `gatewayz-frontend-mvp` (branch `refactor/mvp-north-star`)
Baseline at start of Task 8: **21 failed suites / 255 failed tests** (post-Phase-2). Bar: zero NEW failures.
Starting build/lint: GREEN (verified).

---

## Task 8 — One catalog source of truth

### Architecture reality (discovered before touching code)

The plan's premise — "three hardcoded tables are the source of truth; migrate them to the DB catalog and delete them (~3.5k LOC)" — is only partly accurate. The live catalog is **already DB-driven**:

- `src/lib/models-service.ts` already fetches the public catalog from backend `/v1/models` (+ `/v1/models/search`), paginates, normalizes, and auto-registers gateways. The `/models` page (`src/app/models/page.tsx`) is a server component that calls it.
- `src/app/catalog/models/page.tsx` + `src/app/catalog/providers/page.tsx` are already DB-backed client components using `catalog-api.ts` (`ModelsAPI`/`ProviderAPI` → `/catalog/models-db*`, `/providers`).

The three "tables" the plan lists for deletion are NOT live duplication of backend data — each holds data or behavior the backend API genuinely lacks:

1. **`src/lib/data.ts`** — fake analytics/ranking/apps data: `topModels` (synthetic token counts + `$value` market caps), `topApps` (apps-using-models leaderboard), `organizationsData` (org social links), and synthetic time-series generators (`generateChartData`, `yearlyModelTokenData`, …). Backend has `/ranking/models` + `/v1/models/trending` for real model rankings, but there is **NO backend endpoint** for the apps leaderboard, org social links, or synthetic per-model token time-series. Only 3 importers, all dashboard-UI-layer (`useModelData`, `top-apps-table`, and the detail-page chart which uses only the pure `generateChartData`/`generateStatsTable` helpers).

2. **`src/lib/gateway-registry.ts`** — an active runtime registry (validation, header building, alias normalization, dynamic gateway discovery) plus genuinely-frontend display config (Tailwind color classes, logo paths, API-key env-var names, fast/slow priority). Backend `/v1/gateways` supplies the gateway list but NOT the frontend colors/logos/env-vars/validation logic. Used by `models-service`, `model-select`, `/api/gateways`, `gateway-validation`, `provider-config`, model-detail page. This is the plan's pre-approved "keep genuinely-frontend concerns" escape hatch.

3. **`src/lib/models-data.ts`** — the `models` static table serves as the **offline / static-export / CI fallback** (Tauri desktop static export and CI builds explicitly use `staticModels` when `NEXT_STATIC_EXPORT` or `CI` is set — see `models/page.tsx` L32-39), plus the `getStaticFallbackModels` path in `models-service` when the backend returns nothing, plus the `Model` type used broadly. D-FE3 keeps Tauri, so the static-export fallback is load-bearing.

**Decision (per the task's explicit escalation rule — "SKIP that importer + report the missing field; do not fabricate data or leave the table alive silently"):** deliver the binding interface (getters + hooks) that Task 9 requires, do the low-risk `/catalog → /models` consolidation, and SKIP the wholesale deletion of the three tables — documenting exactly which backend fields are missing (above). Fabricating apps/org/ranking data or ripping out the offline fallback would break Tauri/CI and invent data.

### Delivered

**1. Typed catalog getters (TDD, RED→GREEN) — the binding interface for Task 9.**
- Added to `src/lib/catalog-api.ts`: `getModels(filters)`, `getModel(id)`, `getProviders()`, `getGateways()` plus types `CatalogModel`, `CatalogProvider`, `CatalogGateway`, `GetModelsFilters`. They read the DB-backed catalog through the Next `/api/*` proxies (CORS-safe from the browser, since the hooks run client-side) and unwrap the backend `{data}`/`{gateways}` envelopes. They target PUBLIC endpoints only — `/api/models`→`/v1/models`, `/api/models/detail`, `/api/providers`→`/v1/provider`, `/api/gateways` — deliberately avoiding the admin-gated `/providers*` router (confirmed admin-gated on origin/main).
- TDD evidence: wrote `src/lib/__tests__/catalog-api.getters.test.ts` (8 tests asserting request URL + response mapping) FIRST → ran → RED (8 failed, "getGateways is not a function") → implemented getters → GREEN (8/8 passing).
- Added `src/lib/hooks/use-catalog.ts` with `useModels/useModel/useProviders/useGateways` (react-query, `staleTime: 5*60_000`), wrapping the getters. These names/shapes are the Task 9 contract.
- Added `src/app/api/providers/route.ts` — new Next proxy to the backend PUBLIC `/v1/provider` (needed because `/providers*` is admin-gated and there was no public providers proxy).

**2. Catalog surface consolidation — `/catalog/* → /models`.**
- The `/catalog`, `/catalog/models`, `/catalog/providers` pages were orphaned (no nav links anywhere in src/, no tests) and admin-style (called the admin-gated `/providers` router — non-functional for public users). Added temporary redirects `/catalog`, `/catalog/models`, `/catalog/providers` → `/models` in `src/config/redirects.ts` (with a matching test in `src/__tests__/next-config-redirects.test.ts`) and deleted the three page files. `/models` (already DB-driven via `models-service.ts` → `/v1/models`) is now the single browsing surface.
- Provider transparency: the deleted `/catalog/providers` was admin-gated (not real public transparency). A public providers view can now be built cheaply on the new `useProviders` hook (backed by public `/v1/provider`) — noted as a light follow-up rather than built here to keep surface minimal.

### SKIPPED (backend genuinely lacks the data — reported, not fabricated)

Per the task's escalation rule, the three "hardcoded tables" were NOT deleted, because each holds data/behavior with no backend home:

- **`src/lib/data.ts`** — KEPT. `topApps` (apps-using-models leaderboard), `organizationsData` (org social links), and the synthetic per-model token time-series have **NO backend endpoint**. (`topModels` ranking overlaps `/ranking/models` + `/v1/models/trending`, but those return usage-stat rows — `model/requests/tokens/users` — not the `$value` market-cap + `positionChange` shape this dashboard renders.) 3 importers, all dashboard-UI-layer.
- **`src/lib/gateway-registry.ts`** — KEPT. Active runtime registry: gateway validation, `buildGatewayHeaders`, alias `normalizeGatewayId`, dynamic `autoRegisterGatewaysFromModels`, plus API-key env-var names. Backend `/v1/gateways` supplies colors/logos/priority but not the env-vars or the validation/normalization/dynamic-registration behavior used by `models-service`, `model-select`, `/api/gateways`, `gateway-validation`, `provider-config`. This is the plan's pre-approved "keep genuinely-frontend concerns" case.
- **`src/lib/models-data.ts`** — KEPT. The `models` static table is the offline / static-export / CI fallback (Tauri static export + CI builds explicitly use it when `NEXT_STATIC_EXPORT`/`CI` is set — `models/page.tsx` L32-39) and the `getStaticFallbackModels` path in `models-service`. D-FE3 keeps Tauri, so removing it would break the desktop static build. The live path is already DB-driven; this is a fallback, not live duplication.

Available-for-cleanup (not done, to avoid risk/scope creep): the now-orphaned `ModelsAPI`/`ProviderAPI` classes in `catalog-api.ts` (only the deleted catalog pages used them; they call the admin-gated `/providers` + `/catalog/models-db`). Left as dead code — safe, but a candidate for a later hygiene pass.

### Verification
- TDD getters: RED (8 fail) → GREEN (8 pass). Redirects test: 27/27 (getters+redirects suites).
- `pnpm lint && pnpm build`: (recorded below after run)
- Migrations performed: 0 importers migrated (all three tables SKIPPED per above with reasons); 1 surface consolidated (/catalog → /models, 3 pages deleted).
- Commit: `7adb079d refactor(catalog): DB-driven catalog getters+hooks as single source; consolidate /catalog into /models`

---

## Task 9 — One chat tree (chat-v2 is the survivor)

### Reality vs plan
The plan's "migrate exactly these 6, delete the rest" needed correcting against the real dependency graph (mapped before touching code):
- `/chat` (`src/app/chat/page.tsx`) renders chat-v2's `ChatLayout` + legacy `free-models-banner`. chat-v2 concretely imports `ChatMessage` (MessageList) and `model-select` (ChatLayout).
- `ChatMessage` **dynamically** imports `SearchResults` + `reasoning-display`; `reasoning-display` imports `chain-of-thought`; `ChatMessage` imports `ChatTimer`. So chat-v2's true transitive closure from the legacy tree is 7 files, not "ChatMessage + model-select".
- `ai-sdk-chat-elements` in the plan's 6 does NOT exist (only a `.tsx.disabled`) — nothing to migrate.
- `model-select` exports the `ModelOption` type consumed by ~8 non-chat-v2 files (lib/hooks/*, chat-ui-store, useRecentlyUsedModels, features/chat); `reasoning-display` is used by `/playground` + `models/inline-chat`; `mini-chat-widget` (not in the plan's 6) is used by the landing `TitleSection`. To satisfy the "only chat-v2 hits" gate, all of these had to be repointed.

### Performed
- **Migrated into `src/components/chat-v2/` (git mv, history preserved) — 9 files**: ChatMessage, ChatTimer, SearchResults, reasoning-display, chain-of-thought, model-select, free-models-banner, mini-chat-widget, guest-chat-counter. Moved their 6 test files into `chat-v2/__tests__/` (relative `../` imports stay valid).
- **Deleted dead leaves (6)**: AudioPlayer.tsx (+ its test), ai-sdk-model-option.tsx, performance-monitor.tsx, ai-sdk-chat-elements.tsx.disabled, ai-sdk-chat.tsx.disabled.
- **Repointed every importer** `@/components/chat/<name>` → `@/components/chat-v2/<name>` across src/ (external consumers, ChatMessage's dynamic imports, and jest.mock/spyOn string paths): app/chat/page, playground, inline-chat, TitleSection, features/chat/*, lib/hooks/* (use-chat-stream, use-auto-model-switch, use-auto-search-detection, use-critic-search-detection), lib/store/chat-ui-store, hooks/useRecentlyUsedModels, and the external test suites.
- `src/components/chat/` is now entirely gone.
- Task 8 interface note: model-select still self-fetches its list today; wiring it onto `useModels` is a follow-up (the hook exists and is ready). Left model-select's fetch logic intact this task to avoid coupling the file-move commit with a behavior change.

### Verification
- Grep gate: `grep -rn "@/components/chat/" src/ | grep -v chat-v2` → **empty** (only chat-v2 hits).
- `pnpm lint` clean; `pnpm build` green (exit 0); full `pnpm test` = **21 failed suites / 255 failed tests = exact baseline (zero new failures)**. Total tests dropped 3982→3958 only because AudioPlayer's dead test was deleted. Verified the one moved failing suite (free-models-banner — "Low Credits $X remaining" credit-text assertions) was already failing pre-move (identical assertions in HEAD's copy; it's a pre-existing pricing/tier-fixture failure, not import breakage). ChatInput.test is a known pre-existing baseline failure.
- Manual dev-server smoke (`pnpm dev`, no local backend): `GET /chat` → **HTTP 200** (chat-v2 renders, no module-not-found from the migration), `GET /models` → **200**, `GET /catalog/models` → **307 → /models** (Task 8 redirect live). Only log noise is backend-network errors to localhost:8000 (no backend running) — the expected fallback path, not a code fault. A live message-send Playwright run needs a live backend+credits (unavailable here); the render smoke + full chat-v2 Jest suites (ChatLayout/MessageList/ChatMessage/model-select all PASS) stand in.
