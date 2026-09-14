// Typed client for the backend's public GPU-marketplace transparency
// endpoints (Milestone 4, W-C — gatewayz-backend#2263 #2264, spec.md §6).
// No auth; these are the aggregate-only, cached, rate-limited `/gpu/public/*`
// routes — never a source of wallet/endpoint/provider identity, only display
// aggregates (see the "aggregate-only guarantee" test in spec.md §6).
//
// IMPORTANT: these three routes return their payload DIRECTLY, with NO
// `{success, data}` envelope — confirmed against `src/routes/gpu_public.py`'s
// module docstring ("No auth, no envelope... not the `{success, data}`
// wrapper the authenticated /gpu/* routes use") and its handlers, which
// `return data`/`return list[dict]` straight from `src/db/gpu_rollups.py`.
// Do not "fix" `getJson` to unwrap `.data` — that was Fix round 1's mistake.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

export type GpuNodeStatus = 'registered' | 'active' | 'degraded' | 'offline' | 'disabled';

export interface GpuPublicRegion {
  region: string;
  nodes: number;
}

export interface GpuPublicModel {
  id: string;
  nodes: number;
}

export interface GpuPublicLastHour {
  requests: number;
  tokens: number;
  avg_latency_ms: number;
  error_rate: number;
}

/** The Chutes-style emission split (scratchpad/emission/spec.md §API) — present only once
 *  `REWARDS_MODE=emission` and at least one epoch has run. Absent under today's `per_unit`
 *  mode; callers must render unchanged (hide the strip) when this is undefined.
 *
 *  Fix round 1: `daily_emission_wayz` arrives as a STRING on the wire — confirmed against
 *  `get_public_emission_summary` (gatewayz-backend `src/services/emission/epoch.py`), which
 *  returns `"daily_emission_wayz": str(Config.WAYZ_DAILY_EMISSION)` (an env-derived Decimal,
 *  serialized as `str()`) while the `*_bps` fields are plain `int`s. `getGpuPublicSummary`
 *  coerces every numeric field defensively via `toNumber` regardless, matching
 *  provider-api.ts/rewards-api.ts's convention — this type is the post-parse shape. */
export interface GpuPublicEmission {
  daily_emission_wayz: number;
  providers_bps: number;
  stakers_bps: number;
  treasury_bps: number;
  last_epoch: string | null;
}

export interface GpuPublicSummary {
  active_nodes: number;
  approved_providers: number;
  regions: GpuPublicRegion[];
  models: GpuPublicModel[];
  last_hour: GpuPublicLastHour;
  updated_at: string;
  emission?: GpuPublicEmission;
}

export interface GpuPublicNode {
  name: string;
  region: string;
  gpu_model: string;
  vram_gb: number;
  status: GpuNodeStatus;
  uptime_24h_pct: number;
  models: string[];
}

export type GpuUtilizationWindow = '24h' | '7d';
export type GpuUtilizationGroup = 'region' | 'model';

export interface GpuUtilizationPoint {
  hour: string;
  /** The region or model id this bucket is grouped by. Confirmed against the backend's
   *  real schema (`src/schemas/gpu_public.py`, W-C) — the field is `key`, not `group`. */
  key: string;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  avg_latency_ms: number;
  error_rate: number;
  active_nodes: number;
}

export interface GpuUtilizationResponse {
  window: GpuUtilizationWindow;
  group: GpuUtilizationGroup;
  series: GpuUtilizationPoint[];
}

/** Thrown for any non-2xx response from a `/gpu/public/*` call. */
export class GpuPublicApiError extends Error {
  status: number;

  constructor(status: number) {
    super(`gpu public api request failed (${status})`);
    this.name = 'GpuPublicApiError';
    this.status = status;
  }
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new GpuPublicApiError(response.status);
  }
  return (await response.json()) as T;
}

/** Parses a decimal number that may arrive as a string or number — mirrors
 *  provider-api.ts/rewards-api.ts's `toNumber`. NaN/empty -> 0. */
function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Parses the optional `emission` block, coercing every numeric field regardless of whether
 *  the wire sends it as a string or a number (see `GpuPublicEmission`'s header comment).
 *  Missing/non-object -> undefined, so callers can gate rendering on `Boolean(emission)`. */
function parseEmission(value: unknown): GpuPublicEmission | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const r = value as Record<string, unknown>;
  return {
    daily_emission_wayz: toNumber(r.daily_emission_wayz as string | number),
    providers_bps: toNumber(r.providers_bps as string | number),
    stakers_bps: toNumber(r.stakers_bps as string | number),
    treasury_bps: toNumber(r.treasury_bps as string | number),
    last_epoch: (r.last_epoch as string | null | undefined) ?? null,
  };
}

/** GET /gpu/public/summary (public, cached 30s server-side). Every other field is returned
 *  as-is (no envelope — see this file's header comment); only the optional `emission` block
 *  is parsed, since its numeric fields' wire types are mixed (string/int — see
 *  `GpuPublicEmission`'s header comment). */
export async function getGpuPublicSummary(): Promise<GpuPublicSummary> {
  const raw = await getJson<GpuPublicSummary & { emission?: unknown }>(`${API_BASE_URL}/gpu/public/summary`);
  return { ...raw, emission: parseEmission(raw.emission) };
}

/** GET /gpu/public/nodes (public, cached 30s server-side). No wallet/endpoint/provider identity. */
export async function getGpuPublicNodes(): Promise<GpuPublicNode[]> {
  return getJson<GpuPublicNode[]>(`${API_BASE_URL}/gpu/public/nodes`);
}

/** GET /gpu/public/utilization?window=&group= (public, cached 30s server-side). */
export async function getGpuUtilization(
  window: GpuUtilizationWindow,
  group: GpuUtilizationGroup
): Promise<GpuUtilizationResponse> {
  const params = new URLSearchParams({ window, group });
  return getJson<GpuUtilizationResponse>(`${API_BASE_URL}/gpu/public/utilization?${params.toString()}`);
}
