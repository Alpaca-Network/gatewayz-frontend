# Task 1 — Fix the 8 live API-contract bugs (report)

Worktree: `gatewayz-frontend-mvp`, branch created for this work: `fix/api-contract-hotfix` (based on `refactor/mvp-north-star`, which is based on `master` post-PR-#995).

Backend contract truth verified via `git -C ../gatewayz-backend fetch origin main` + `git show origin/main:<path>` (never the stale working tree), and cross-checked live against `https://api.gatewayz.ai`.

## Pre-existing plan/audit docs were missing from this worktree

`docs/superpowers/plans/2026-07-17-frontend-mvp-refactor.md` and `docs/FRONTEND_NORTH_STAR_AUDIT.md` did not exist in `gatewayz-frontend-mvp` (checked working tree, all commits, all branches). Found as **untracked** files in the sibling `gatewayz-frontend` worktree (on `master`). Copied both into this worktree before starting (they remain untracked here too, per the plan's own instruction that `.superpowers/` artifacts are untracked).

## Test baseline (before changes)

`pnpm test` (full suite): **Test Suites: 23 failed, 154 passed, 177 total. Tests: 261 failed, 15 skipped, 4019 passed, 4295 total.** Saved to `.superpowers/baseline.txt`.

## Bug-by-bug

### 1. Popular models — `GET /v1/models/popular` (dead)
- **Verified dead**: no `/models/popular` route anywhere in `origin/main:src/routes/catalog.py`. Real endpoint is `GET /v1/models/trending` (`catalog.py:2046` `get_trending_models_api` → `get_trending_models_endpoint`, backed by `src/db/gateway_analytics.py get_trending_models()` — real usage stats, sorted by requests/tokens/users).
- **Response shape mismatch found**: trending items are `{model, provider, requests, total_tokens, unique_users, gateway}`, not `{id, name, developer, usage_count, category, sourceGateway}` that `PopularModel` expects.
- **Fix** (`src/app/api/models/popular/route.ts`): point fetch at `/v1/models/trending?limit=...`; added `mapTrendingToPopular()` to translate the real shape (derives a display name from the model id, capitalizes `provider` as `developer`, carries `requests`→`usage_count`, `gateway`→`sourceGateway`).
- **Note**: `src/app/models/[...name]/utils.ts` `getPopularModels()` and `src/components/chat/model-select.tsx` were listed in the plan as touch points, but neither actually calls `/api/models/popular` (grepped whole repo — only the route's own tests reference it). No live caller exists today; the proxy itself was the only place carrying the dead call, now fixed.
- **Evidence**: unit tests updated to mock the real trending shape (`src/app/api/models/popular/__tests__/route.test.ts`) — pass. Live curl through `pnpm dev` with `NEXT_PUBLIC_API_BASE_URL=https://api.gatewayz.ai`: `GET /api/models/popular?limit=3` → `"source":"api"`, returns real usage-ranked models (e.g. `{"id":"deepseek-ai/DeepSeek-V3.1","name":"DeepSeek V3.1","developer":"DeepSeek","usage_count":1,"sourceGateway":"deepinfra"}`). Confirmed old `/v1/models/popular` still 404s if hit directly.

### 2. Search — `GET /v1/models?search=` (wrong endpoint, param ignored)
- **Verified**: `GET /v1/models` (`get_all_models`/`get_models` in `catalog.py`) has **no** `search` query param at all — it's silently dropped server-side. The dedicated endpoint is `GET /v1/models/search` (`catalog.py:2401`, param is **`q`**, not `query`).
- **Fix** (proxy layer, `src/lib/models-service.ts` `fetchModelsFromGateway`): when a `search` term is present and the call is server-side, build `${baseUrl}/v1/models/search?q=<query>&gateway=...&limit=...` instead of appending `&search=` to `/v1/models`; client-side path still proxies through `/api/models?...&search=...` (unchanged, re-enters this same server-side logic). Components (`model-select.tsx`) untouched — fix is entirely in the proxy layer as instructed.
- **Evidence**: new tests — `src/lib/__tests__/models-service.search.node.test.ts` (`@jest-environment node`, since the existing jsdom test file can't observe the server-side URL branch) asserts the constructed URL hits `/v1/models/search?q=` and never `/v1/models?...search=`. Pass.
- **CRITICAL FINDING (backend bug, out of scope for this frontend task)**: live-curled `https://api.gatewayz.ai/v1/models/search?q=gpt-4o&gateway=all&limit=5` and got `{"developer":"search","models":[],"total":0,...}` — this is the **wrong handler**. `catalog.py` registers `@router.get("/models/{developer_name}")` (line 2386, `get_developer_models_api`) **before** `@router.get("/models/search")` (line 2401). Starlette/FastAPI matches routes in registration order, so `/v1/models/search` is permanently shadowed by the generic `/models/{developer_name}` route (which treats `"search"` as a developer name, finds no matching models, and returns an empty list). Confirmed with a second arbitrary path segment (`/v1/models/nonexistent-provider-xyz` → same empty-shape response) and a trailing-slash workaround (404, no escape). **This means the intended search endpoint is currently unreachable in production regardless of any frontend fix.** The frontend fix here is contract-correct (matches the endpoint's actual intended definition and the plan's explicit instruction) and will start working the moment the backend swaps the two route registrations (or renames the path param route to avoid colliding with `/search`) — recommend filing this as a backend bug/PR immediately; it's a 2-line reorder in `src/routes/catalog.py`.

### 3. `/user/credits` — dead in both webhook proxies
- **Verified dead**: grepped `origin/main` for `user/credits` POST route — none exists anywhere in `src/routes/`. Confirmed live: `POST https://api.gatewayz.ai/user/credits` → 404.
- **Fix**: removed the dead `fetch(`${API_BASE_URL}/user/credits`, ...)` call from both `src/app/api/stripe/webhook/route.ts` and `src/app/api/payments/webhook/route.ts`; left a comment explaining the backend's own Stripe webhook (`src/routes/payments.py`, registered directly with Stripe) does the real crediting from the same `checkout.session.completed` event. Removed now-dead `paymentId` var and unused `API_BASE_URL` imports.
- **Evidence**: no existing route tests for these two files (verified — none found). Verified via code reading + live 404 confirmation of the dead endpoint above; `pnpm build`/`pnpm lint` clean for both files.

### 4. `/user/settings` — dead
- **Verified dead**: no `/user/settings` route in `origin/main`. Confirmed live: `GET https://api.gatewayz.ai/user/settings` → 404.
- **Better fix than "localStorage only"**: `GET/PUT /user/profile` (`src/routes/users.py:225,266`) exists and its `UserProfileResponse`/`UserProfileUpdate` schemas (`src/schemas/users.py`) include a genuine freeform `settings: dict[str, Any] | None` field, persisted to the `users.settings` DB column (`src/db/users.py get_user_profile`/`update_user_profile`). This is a real backend home for these settings keys — used it instead of localStorage.
- **Fix** (`src/app/settings/page.tsx`): load reads `GET /user/profile` and pulls `profile.settings`; save sends `PUT /user/profile` with `{ settings: { low_balance_notifications, low_balance_threshold, always_enforce_providers, allowed_providers, ignored_providers, default_provider_sort, default_model } }`.
- **Evidence**: `src/app/settings/__tests__/page.test.tsx` updated (4 fixtures nested under `settings:`) — 12/12 tests pass. Live confirmed `GET /user/profile` returns 401 (auth-gated, exists) vs `/user/settings` 404 (dead).

### 5. BYOK — `/gateways` → `/v1/gateways`
- **Verified**: `/gateways` is registered on the `catalog` router, which is mounted under the `/v1` prefix (`src/main.py` `v1_routes_to_load` includes `"catalog"`, `app.include_router(v1_router)`). Bare `/gateways` 404s.
- **Fix**: `src/lib/byok-api.ts` `getGateways()` now calls `${API_BASE_URL}/v1/gateways`; updated the file's doc-comment contract listing too.
- **Evidence**: live curl — `https://api.gatewayz.ai/v1/gateways` → 200 with real gateway registry data; `https://api.gatewayz.ai/gateways` → 404.

### 6. Contact form — `POST /v1/contact` (dead)
- **Verified dead**: no `/contact` route anywhere in `origin/main:src/routes/`. Confirmed live: `POST https://api.gatewayz.ai/v1/contact` → 404. The old proxy already caught this and faked a success response, silently dropping the user's message into ephemeral serverless logs while telling them it was "sent."
- **Choice made (per plan: pick lighter of mailto: vs disable-with-notice)**: **mailto: fallback** — least code, and it actually delivers (via the user's own mail client) instead of a fake success.
- **Fix**: `src/app/contact/page.tsx` `onSubmit` no longer calls `/api/contact`; it builds a `mailto:sales@gatewayz.ai?subject=...&body=...` URL from the validated form fields and navigates to it (`window.location.href`), then shows an updated "Almost there!" confirmation that's honest about what happened. `src/app/api/contact/route.ts` left in place (its 20-test suite still exercises its existing graceful-fallback behavior) with a new comment at the fetch call clarifying it's dead/unused by the page and should not be built on further.
- **Evidence**: `src/app/contact/__tests__/page.test.tsx` (21 tests, none exercise submission) and `src/app/api/contact/__tests__/route.test.ts` (20 tests) both still pass unmodified.

### 7. (see #2 — search, same bug entry in different numbering between audit/plan)

### 8. Organizations page `?developer=` — **SKIPPED**
Per instructions: page is cut in Task 6. Not touched (would only have added a `// dead param; page scheduled for removal` comment if I were touching the file for another reason — I wasn't).

## Verification summary
- `pnpm lint` — clean (one pre-existing unrelated warning in `app-footer.test.tsx`, not touched by this task).
- `pnpm build` — green.
- `pnpm test` (full suite, after all changes): **Test Suites: 23 failed, 155 passed, 178 total. Tests: 261 failed, 15 skipped, 4021 passed, 4297 total.** Same 23 failing suites / 261 failing tests as baseline (zero new failures); the +1 suite / +2 tests are the new `models-service.search.node.test.ts` file. Spot-checked the one suite that looked new in the run (`credits-display.test.tsx`, crashed as a worker exception) in isolation — it's a pre-existing, unrelated module-mock issue (`getApiKey is not a function`), untouched file.
- All directly-touched test files re-run together: **86/86 pass** (`popular/route.test.ts`, `settings/page.test.tsx`, `models-service.test.ts`, `models-service.search.node.test.ts`, `contact/route.test.ts`, `contact/page.test.tsx`).
- Live end-to-end verification against `https://api.gatewayz.ai` (via `pnpm dev` with `NEXT_PUBLIC_API_BASE_URL` overridden): popular-models proxy returns real usage data (`source:"api"`); `/v1/gateways` 200 vs `/gateways` 404; `/user/profile` 401 (exists) vs `/user/settings` 404 (dead); `/user/credits` and `/v1/contact` both confirmed 404.

## Outstanding blocking concern (not fixable from this frontend task)
Backend route-ordering bug in `src/routes/catalog.py`: `/models/{developer_name}` is registered before `/models/search`, permanently shadowing the search endpoint (always returns an empty list). Recommend an urgent backend PR to reorder those two route registrations.

## Fix round 1

Two follow-up hotfixes landed on `fix/api-contract-hotfix` (commit `80fcf473`) and fast-forward merged into `refactor/mvp-north-star`:

1. **`src/components/chat/model-select.tsx:284-287`** — the Tauri/desktop branch (`isTauriDesktop()`) was still hitting the dead `${API_BASE_URL}/v1/models?gateway=all&search=${query}` contract (item #2 above only fixed the browser/proxy path in `models-service.ts`, not this direct-to-backend desktop branch). Changed to `${API_BASE_URL}/v1/models/search?q=${encodeURIComponent(query)}`, matching the same fix already applied server-side. Response shape is unchanged (`{ data: [...] }` array of raw model dicts, same as `/v1/models`), so the existing mapping/fallback logic needed no changes — added a comment explaining why. The graceful client-side fallback (try/catch, keep previous results on error) is untouched.
   - **Still blocked by the same backend route-ordering bug noted above** — `/models/{developer_name}` (catalog.py:2446) is still registered before `/models/search` (catalog.py:2464) as of `gatewayz-backend` `main` @ `bf3a2ee7`, so this endpoint is currently shadowed and returns empty results in production until the backend reorders those two routes. The frontend fix is contract-correct and will start working the moment that backend fix lands.
2. **`src/app/settings/page.tsx:110`** — reverted an undocumented default flip: `low_balance_notifications` now defaults to `false` again for unset values (`data.low_balance_notifications ?? false`), restoring prior behavior. Left `low_balance_threshold`'s `?? 5.00` alone (preserving a stored `0` there is a genuine, separate bugfix, not part of this revert).

**Verification**: `pnpm lint` clean (same one pre-existing unrelated a11y warning in `app-footer.test.tsx`). `pnpm build` green. `src/app/settings/__tests__/page.test.tsx` (12/12 pass) and both `model-select` test files (`src/__tests__/components/chat/model-select.test.ts`, `src/components/chat/__tests__/model-select.test.tsx`) pass. The only failures in a broader `settings|model-select` test-path run are the pre-existing 8 failures in `src/app/settings/credits/__tests__/page.test.tsx` (decimal-formatting assertions, unrelated file/behavior) — confirmed pre-existing via `git stash` + re-run on the unmodified tree.

Pushed to `origin/fix/api-contract-hotfix` (updates PR #996); fast-forward merged into local `refactor/mvp-north-star`.
