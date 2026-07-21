# North Star Frontend Catalog Drift — Fix Report

Branch: `fe-north-star-catalog` (worktree: `gatewayz-frontend-northstar`)
Scope: catalog data source only, per `docs/FRONTEND_NORTH_STAR_AUDIT.md` §4.

## Summary

`docs/FRONTEND_NORTH_STAR_AUDIT.md` names 4 modules as the "hardcoded-data
drift" problem: `lib/gateway-registry.ts`, `lib/data.ts`, `lib/models-data.ts`,
`lib/provider-config.ts`. Before this pass:

- `lib/data.ts` was already deleted by an earlier refactor (commit
  `821a03a1`, "cut synthetic charts and fake apps leaderboard") — nothing to
  do here.
- `lib/models-data.ts` (81 hardcoded models, developers including several the
  backend has since deleted — `qwen`, `switchpoint`, `moonshotai`, `google`,
  `meta`, `katanemo`, `alibaba`, etc.) was still live with 7 real importers.
- `lib/gateway-registry.ts` and `lib/provider-config.ts` turned out, on
  inspection, to be a different kind of module than the audit's headline
  complaint — see "Left in place" below.

## What was deleted

- **`src/lib/models-data.ts`** — the 81-model hardcoded catalog table.
- **`src/lib/provider-data.ts`** — a sibling hardcoded table keyed by exact
  model display name, providing **fabricated** per-provider latency/
  throughput/uptime numbers (literally `Math.random()`-generated) for any
  model not in its 4 manually-curated entries. Zero real data value; pure
  drift risk once `models-data.ts` (its only consumer's data source) was
  gone.
- **`src/components/models/provider-card.tsx`** — the only consumer of
  `provider-data.ts`, and itself a dead component (zero importers anywhere
  in `src`, confirmed by grep before deletion).
- **`src/lib/__tests__/models-data.test.ts`** (534 lines) — tested the
  deleted module.

## Importers repointed to the DB-backed catalog

All 7 real production importers of `models-data.ts` (plus the sole importer
of `provider-data.ts`) were repointed to the DB catalog
(`@/lib/catalog-api` / `@/lib/hooks/use-catalog` / the existing
`models-service.ts` → `/v1/models` proxy pipeline, which was already
DB-driven for its live-data path):

| File | Before | After |
|---|---|---|
| `src/lib/models-service.ts` | `getStaticFallbackModels()` fabricated a per-gateway model list from `models-data.ts` whenever the live `/v1/models` fetch returned empty/threw | Fallback removed; returns `{ data: [] }`. Also dropped the now-dead `transformModel()`, and the unused `getAllActiveGatewayIds`/`isPerMillionPricingGateway`/`isPerBillionPricingGateway` imports it needed. |
| `src/lib/model-detail-utils.ts` | Exported `transformStaticModel()` to convert a static model into `ModelDetailRecord` | Function removed (its only callers were the two files below); generic helpers (`findModelByRouteParams`, `getModelGateways`, `getRelatedModels`) untouched. |
| `src/app/models/page.tsx` | CI/static-export branch and the catch-block both rendered `staticModels` | Both now call `getModels()` from `catalog-api` (which already targets the backend directly server-side/Tauri-desktop) — or return `[]` on total failure, rather than injecting stale/deleted-provider models. |
| `src/app/models/[...name]/utils.ts` (`getPopularModels`, used by `generateStaticParams`) | Seeded the pre-rendered model list with all 81 static models + top OpenRouter models | Now calls `catalog-api.getModels()` (static export) or `models-service.getModelsForGateway('openrouter', limit)` (server mode) only. |
| `src/app/models/[...name]/page.tsx` | Optimistically pre-populated the page with a `transformStaticModel()`-derived match before the real `/api/models/detail` fetch resolved; also used `provider-data.ts`'s fabricated cost/latency numbers to pick a "recommended" gateway | Static pre-population removed (page now just shows the existing "Loading model..." state until the live fetch resolves); the recommended-gateway heuristic falls back to "first available provider" instead of fake numbers (same behavior the code already had for models with no static provider-data entry). |
| `src/app/api/models/detail/route.ts` | Matched against `TRANSFORMED_STATIC_MODELS` when the live gateway fetch failed or found nothing | Static match path removed; returns `404` (model not found) or `502` (upstream gateway fetch failed) instead of a fabricated match. |
| `src/components/layout/search-bar.tsx` | Seeded the popover with static models on mount and as its fetch-error fallback; had its own hand-rolled in-memory cache | Rewritten on top of `useModels()` (`@/lib/hooks/use-catalog`, react-query) — same lazy-fetch-on-open UX, react-query's cache replaces the custom one. |
| `src/lib/provider-data.ts` importer (`src/app/models/[...name]/page.tsx`) | see above | see above |

## Tests updated

- Deleted `src/lib/__tests__/models-data.test.ts` (tested the deleted module).
- `src/lib/__tests__/model-detail-utils.test.ts`: removed the
  `describe('transformStaticModel', ...)` block (222 lines) and the
  now-unused `StaticModelDefinition` type import.
- `src/lib/__tests__/models-service.test.ts`: removed the dead
  `require('@/lib/models-data')` (its result was already unused in that
  test) and the `describe('Static Fallback Pricing Conversion', ...)` block
  — both of its tests asserted on `result.data.find(...)` matches that would
  now always be `undefined` (the assertions were wrapped in
  `if (gptMiniModel) { ... }`, so they'd have kept "passing" vacuously; they
  were deleted instead of left as no-ops).

## Left in place (entangled — documented, not repointed)

Per the task's explicit escape hatch, two of the four named modules were
**not** touched, with `TODO(north-star)` comments added explaining why:

- **`src/lib/gateway-registry.ts`** and **`src/lib/provider-config.ts`**
  turned out to be functional plumbing, not display-only catalog tables:
  - `gateway-registry.ts` builds request headers
    (`buildGatewayHeaders`/`getGatewayApiKey`) and does gateway-id
    validation/normalization (`isValidGateway`, `normalizeGatewayId`,
    `VALID_GATEWAYS`) for the `models-service.ts` → `/v1/models` proxy
    pipeline — i.e. it's live routing infrastructure, not just a
    display/lookup table (it also holds colors/logos/priority, which *is*
    display data).
  - `provider-config.ts` holds BYOK direct-provider API base
    URLs/placeholders/model-id formatters for the Playground's "call this
    provider directly" feature, and itself imports `gateway-registry.ts`.
  - The audit's own top-of-file "Outcome" note (item 4) already flags this
    exact entanglement as unresolved: `/api/gateways` merges this registry
    with the backend's `/v1/gateways` list, and unwinding it fully requires
    a **backend decision** (move colors/logos/priority/env-var-names
    server-side, vs. keep this frontend-only permanently) — not something
    to make unilaterally in a frontend-only pass without breaking the BYOK
    feature or the `/api/gateways`/`buildGatewayHeaders` request-building
    path.
  - Both files still list gateway/provider ids beyond the backend's current
    narrowed live set, so the drift risk described in the audit is real —
    but it's routing/BYOK-config drift, not catalog-display drift (unlike
    the deleted `models-data.ts`/`provider-data.ts`, which were shown
    directly to users as "available models").

## Build / typecheck / test results

- `npx tsc --noEmit` — **clean, 0 errors** (ran after `pnpm install`, since
  `node_modules` wasn't present in the worktree).
- `pnpm build` (`next build`) — **exit 0**, all 103 pages generated
  successfully. Build logs show the new code paths actually hitting the live
  backend (e.g. `getPopularModels` pulled 284 real OpenRouter models for
  `generateStaticParams`; `/models` page's `gateway=all` fetch returned 0
  models in this build environment — logged and handled gracefully as an
  empty catalog, not masked with fake data, which is the intended behavior
  change).
- `npx jest` (full suite):
  - Before my changes (verified via `git stash` on this same branch): 21
    failed suites / 255 failed tests / 3913 total.
  - After my changes: **20 failed suites / 252 failed tests / 3862 total**
    (fewer total tests because the deleted static-fallback tests are gone;
    fewer failures, not more).
  - All remaining failures were confirmed pre-existing and unrelated to this
    change (verified identical failures with `git stash` on unmodified
    code): a `NEXT_PUBLIC_PRICING_MARKUP`-related pricing-display mismatch
    (`0.15` expected vs `0.19` received) affecting
    `models-client.test.tsx`, `models-client-multi-provider.test.tsx`,
    `pricing-display.test.tsx`, `model-pricing-utils.test.ts`,
    `PricingSection.test.tsx`; plus unrelated `AppFooter`/tier/chat-input
    test failures. None of these touch the files changed in this pass.
  - Files I directly modified (`models-service.test.ts`,
    `model-detail-utils.test.ts`) — **pass**.

## Commits

See `git log` on this branch for the exact commit hashes (reported
separately by the calling agent).
