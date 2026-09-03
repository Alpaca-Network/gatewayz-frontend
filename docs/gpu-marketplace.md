# GPU Marketplace — frontend (Milestone 4, W-D)

Public transparency dashboard (`/gpu`) and provider portal (`/gpu/provider`) for the
community GPU compute marketplace. Design: gatewayz-backend#2261-#2267. This doc
covers the frontend side only — see gatewayz-backend's `docs/gpu/PROVIDER_ONBOARDING.md`
for the node-operator-facing guide.

## Feature flag

Both `/gpu` and `/gpu/provider`, and their nav link, are gated behind
`NEXT_PUBLIC_GPU_MARKETPLACE=true` (see `.env.example`, `src/lib/gpu/flag.ts`). Off by
default until the backend's `/gpu/*` routes ship. With the flag off, `GpuPageClient` and
`ProviderPortalClient` render `null` and never issue a query (`enabled: false` on the
underlying react-query hooks) — flipping the flag on before the backend exists is safe
(requests will 404/error, surfaced as the existing error/empty states) but pointless.

## File map

- `src/lib/gpu/public-api.ts` / `src/lib/gpu/provider-api.ts` — typed clients. Public
  endpoints are unauthenticated `fetch`; provider endpoints go through
  `makeAuthenticatedRequest` (Bearer), mirroring `src/lib/wayz/staking-api.ts` and
  `src/lib/auth/wallet-auth-api.ts`. Every wei amount is a decimal string on the wire,
  parsed to `bigint` at this boundary.
- `src/lib/gpu/format.ts` — display formatting (heartbeat age, node status labels).
- `src/lib/hooks/use-gpu-public.ts` / `use-gpu-provider.ts` — react-query hooks. Public
  hooks refetch every 30s to match the backend's 30s server-side cache (spec §6).
  Provider mutations invalidate the single `gpu-my-provider` query.
- `src/app/gpu/page.tsx` + `src/components/gpu/*` — public dashboard: summary cards,
  utilization chart (recharts, 24h/7d × region/model), nodes table, model→node mapping,
  trust disclosure.
- `src/app/gpu/provider/page.tsx` + `src/components/gpu/provider/*` — provider portal:
  registration form (wallet picker from `useLinkedWallets`), node list (rotate/disable
  with confirm), add-node dialog (validates https + at least one model, reveals the
  one-time node token), earnings section (accrued/settled/void, work + settlements with
  Snowtrace links).

## Contracts (verified against the real, merged backend code — Fix round 2)

Every fixture in this feature's tests is now copied from the backend's own test
assertions or response models, cited by file:line in the test itself — not derived
from the spec doc, which turned out to omit or misdescribe several of these.

- **`/gpu/public/summary|nodes|utilization` return the payload DIRECTLY — no
  `{success, data}` envelope.** Confirmed against `src/routes/gpu_public.py`'s module
  docstring and `tests/routes/test_gpu_public.py` (`response.json() == _SUMMARY`, no
  `.data` unwrap). `public-api.ts`'s `getJson` does not unwrap `.data` for these three;
  the authenticated `/gpu/*` routes (`gpu.py`, `gpu_earnings.py`) DO still use that
  envelope, and `provider-api.ts` still unwraps `.data` for those.
- **`GET /gpu/public/utilization` response shape**, confirmed against
  `src/schemas/gpu_public.py`: `{window, group, series: [{hour, key, requests,
  prompt_tokens, completion_tokens, avg_latency_ms, error_rate, active_nodes}]}` — each
  point tagged with `key` (the region or model id), not `group` (`group` is only the
  top-level query-param echo).
- **`GET /gpu/providers/me`'s earnings field is named `earnings`**, not
  `earnings_summary`: `{provider, nodes, earnings: {accrued_wei, settled_wei,
  void_wei?}}` (decimal strings), per `src/routes/gpu.py`'s `get_my_provider`/
  `_earnings_summary`. `void_wei` is optional on the wire there — `toBigInt` in
  `provider-api.ts` defaults a missing value to `0n`.
- **`GET /gpu/providers/me/earnings` nests its totals under `data.totals`**, not flat
  on `data` — `{data: {totals: {accrued_wei, settled_wei, void_wei}, work, settlements}}`
  per `src/routes/gpu_earnings.py`'s `get_my_earnings` (approved PR #2288) and
  `tests/routes/test_gpu_earnings.py`. Each settlement also carries a backend-computed
  `id` and `tx_url` — `EarningsSection` now links to the provided `tx_url` instead of
  reconstructing one from `tx_hash` (that duplication was a round-1 nit; fixed here since
  it's the same code path).
- **`POST /gpu/nodes`'s 400 error body doesn't carry the raw reason in `error.detail`.**
  The app-wide handler (`src/utils/error_handlers.py` ->
  `DetailedErrorFactory.invalid_parameter`) always sets `error.detail` to a static,
  unrelated string and puts the actual raw reason (`"endpoint_unreachable"` /
  `"models_mismatch"`) in `error.context.parameter_value` instead — confirmed against
  `tests/routes/test_gpu.py`'s own assertions on that exact field. `provider-api.ts`'s
  `codeForCreateNodeStatus` now reads `error.context.parameter_value`
  (`readErrorParameterValue`), not `error.detail`.
- **Provider onboarding guide link** in the public dashboard's trust-disclosure card
  points at gatewayz-backend's GitHub-hosted `docs/gpu/PROVIDER_ONBOARDING.md` on `main`
  (W-E) rather than an in-repo `/docs/*` page — the onboarding doc lives in the backend
  repo per spec §8, not this one. That file doesn't exist yet (W-E hasn't landed), so the
  link 404s until it does; harmless while this surface stays flagged off.

## Testing

Jest + Testing Library. API clients: URL/Bearer/status-code-error-mapping/wei-parsing
tests against fixtures that mirror the spec shapes. Hooks: mocked API modules, asserting
query keys/invalidation. Components: mocked hooks, covering loading/empty/populated/error
states, the token-reveal-once flow, https validation, and flag-off (renders nothing).
recharts is mocked in tests that render `UtilizationChart` — `ResponsiveContainer` needs
real layout that jsdom doesn't provide.
