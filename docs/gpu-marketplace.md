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

## Contract decisions made here (spec §6/§7 left these open)

- **`GET /gpu/public/utilization` response shape.** The spec only says "hourly series
  from the rollup"; it doesn't give exact JSON keys. This client assumes
  `{window, group, series: [{hour, group, requests, prompt_tokens, completion_tokens,
  avg_latency_ms, error_rate}]}` (one flat array, each point tagged with its region/model
  group so the chart can pivot into one line per group). **Must be confirmed against the
  real backend response before this ships** — see `src/lib/gpu/public-api.ts`'s
  `GpuUtilizationPoint` doc comment.
- **`GET /gpu/providers/me`'s `earnings_summary` shape.** Not spec'd beyond "earnings
  summary". Assumed `{accrued_wei, settled_wei, void_wei}` (decimal strings), mirroring
  the `/gpu/providers/me/earnings` totals.
- **Provider onboarding guide link** in the public dashboard's trust-disclosure card
  points at gatewayz-backend's GitHub-hosted
  `docs/gpu/PROVIDER_ONBOARDING.md` (W-E) rather than an in-repo `/docs/*` page — the
  onboarding doc lives in the backend repo per spec §8, not this one.

## Testing

Jest + Testing Library. API clients: URL/Bearer/status-code-error-mapping/wei-parsing
tests against fixtures that mirror the spec shapes. Hooks: mocked API modules, asserting
query keys/invalidation. Components: mocked hooks, covering loading/empty/populated/error
states, the token-reveal-once flow, https validation, and flag-off (renders nothing).
recharts is mocked in tests that render `UtilizationChart` — `ResponsiveContainer` needs
real layout that jsdom doesn't provide.
