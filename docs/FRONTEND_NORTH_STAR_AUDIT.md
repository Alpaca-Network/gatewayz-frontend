> **STATUS: EXECUTED.** This audit's findings were implemented on
> `refactor/mvp-north-star` (Phases 0–4, Tasks 0–14). See the
> `## Outcome` section of
> `docs/superpowers/plans/2026-07-17-frontend-mvp-refactor.md` for what
> shipped, verification evidence, and honest deviations from this audit's
> premises (several of this doc's "hardcoded table" and "duplication"
> findings turned out to be only partly accurate once the code was actually
> migrated — see the plan's Task 8/9/11/12 notes for the corrected picture).
>
> Four items surfaced by the Phase 3 review are tracked as follow-ups:
> 1. `components/chat-v2/model-select.tsx` wired onto `useModels` — **done**.
> 2. `settings/page.tsx` + `settings/presets/new/page.tsx` wired onto
>    `useModels` — **done**.
> 3. Synthetic dashboard charts (`lib/data.ts`'s `topApps`/`organizationsData`/
>    per-model token time-series) have no backend home — **remaining**,
>    needs a product decision (build the backend endpoints, or cut the
>    dashboard surface that renders them).
> 4. `/api/gateways` still merges the frontend `gateway-registry.ts` config
>    with the backend's `/v1/gateways` list rather than reading everything
>    from the backend — **remaining**, needs a backend-merge decision (move
>    colors/logos/priority/env-var-names server-side, or keep them
>    frontend-only permanently).

# Frontend North Star Alignment Audit — 2026-07-17

Audited against `gatewayz-backend/docs/NORTH_STAR.md` (+ Amendments) and the post-refactor backend (`origin/main`, PR #2165–#2169). Repo: ~189k lines TS/TSX — larger than the refactored backend.

**Verdict: YES, the frontend needs the same treatment.** Same disease, same symptoms: parallel duplicate engines, dead monoliths, hardcoded data that drifts against the DB-driven catalog, feature surfaces for killed backend features, and repo hygiene worse than the backend's was.

## 1. Broken API contract (bugs live NOW, verified vs origin/main)

| # | Call | Caller | Status |
|---|------|--------|--------|
| 1 | `GET /v1/models/popular` | api/models/popular proxy, model-select fallback, model detail | **DEAD** — endpoint never existed; high-traffic surface |
| 2 | `POST /user/credits` | BOTH stripe + payments webhook proxies | **DEAD** — frontend-side credit sync no-ops (backend webhook does the real crediting; the proxy call 404s silently) |
| 3 | `GET/PUT /user/settings` | settings page | **DEAD** |
| 4 | `GET/POST /user/cache-settings` | settings/cache page | **DEAD** (page should be cut anyway) |
| 5 | `POST /v1/contact` | contact page proxy | **DEAD** |
| 6 | `GET /gateways` | BYOK integrations page | **PREFIX BUG** — real path is `/v1/gateways`; BYOK page (core product surface) broken |
| 7 | `GET /v1/models?search=` | chat model dropdown | **WRONG ENDPOINT** — param silently ignored; should call `/v1/models/search?q=` |
| 8 | `GET /models?developer=` | organizations page | param ignored; path-form `/v1/models/{developer}` exists |
| 9 | referral / analytics / user-memory calls | various | **DEAD post-refactor** — fixed by PR #995 (merge it) |

## 2. Feature surface vs North Star (cut list)

CUT (~8.3k LOC traced): web-vitals+analytics telemetry (~2.9k) · Terragon/Vercel coding-agent surface (`/inbox`, `/agent`, `/auth/terragon`, ~1.6k) · org analytics dashboard (~1.6k) · killed settings cluster (memory/referrals/activity/cache, ~1.5k) · dev/test routes shipped to prod (`/test-tier-display`, `/email-preview`, `/sentry-example-page`, `api/redis/test`, `api/sentry-test`) · `/redbeard` dead redirect · orphan `api/audio/transcriptions`.

DECISION NEEDED (~4.7k): **subscription/plans UI** (`/checkout` is 80% subscription-oriented — North Star is prepaid-only; keep only top-up checkout + webhook) · playground · `/start/*` + `/claude-code` + `/code` triplicated marketing · game-of-life easter egg (1.9k).

## 3. Structural duplication (the backend's disease, frontend edition)

- **Two chat UI trees**: `components/chat` (7.6k, legacy — only 6 files still referenced) vs `chat-v2` (8.4k). ~5–6k latent dead.
- **Two streaming engines**: dead `lib/streaming.ts` monolith (1,112 LOC, zero importers) vs live `lib/streaming/` dir; plus a third handler pair.
- **Three chat-state systems**: `hooks/chat/*`, `lib/hooks/use-chat-*`, `features/chat/useChatController` + zustand store.
- **Four-way auth modeling** (~3.5k): 1,742-line god-context + xstate machine + zustand store + service class + dup token-refresh pair.
- **Two catalog surfaces**: `/models` (static data) vs `/catalog/*` (DB-driven) — parallel model browsers.
- **Five caching/state paradigms**: react-query (7 files) + zustand + custom cache modules + a full server-side Redis layer (ioredis) + 63 files hitting localStorage raw.
- **14 macOS `file 2.ts`/`file 3.ts` duplicate artifacts** committed, incl. triplicate API routes.

## 4. Hardcoded-data drift (highest correctness risk)

The backend's whole refactor made the DB the catalog source of truth. The frontend still ships and predominantly USES hardcoded tables: `lib/data.ts` (81 models, 6 importers), `lib/models-data.ts` (9 importers), `lib/gateway-registry.ts` (652 lines, 75 providers, 6 importers), `lib/provider-config.ts`, client-side pricing math. The DB-driven `catalog-api.ts` has only 2 importers. **These tables already list providers deleted from the backend.**

## 5. Repo hygiene

~30 loose root junk files (dated error-analyses, committed dev logs, 72KB sentry dump, 14 test-* scripts) · **three lockfiles** (pnpm is real; package-lock + yarn.lock = 1.85MB dead) · **three test frameworks** (Cypress redundant vs Playwright; test-results/playwright-report committed) · four deploy targets (Vercel primary, Railway secondary, **Firebase dead scaffold**, Tauri desktop semi-live) · dead deps (`next-auth`, `@sampleapp.ai/sdk` — zero imports; faker in prod deps) · dual telemetry stacks (Statsig AND PostHog AND Vercel Analytics).

## Recommended plan shape (mirrors the backend refactor)

- **Phase 0 — hotfix the 8 live API bugs** (small PR, days): popular-models fallback, /user/credits removal, /gateways prefix, search endpoint, settings dead calls. Independent of any refactor. Merge #995 first.
- **Phase 1 — hygiene** (zero risk): lockfiles, root junk, dead deps, committed artifacts, Firebase scaffold, macOS dupes, orphan modules incl. `streaming.ts` (~6k LOC).
- **Phase 2 — feature cuts** (~8.3k): telemetry, coding-agent surface, org dashboard, killed settings, dev routes. + subscriptions decision (recommend: prepaid-only, cut sub management).
- **Phase 3 — consolidations**: one chat tree (finish v2, delete v1), one chat-state home, one catalog surface **fed by the DB catalog API** (delete hardcoded tables — the highest-value item), one auth model, react-query as the caching standard, one E2E framework.
- **Phase 4 — verify**: build + Playwright e2e + Sentry watch.

Estimated: ~189k → ~120–130k LOC, with the drift-prone hardcoded catalog eliminated.
