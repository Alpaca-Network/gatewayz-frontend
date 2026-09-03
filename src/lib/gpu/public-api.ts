// Typed client for the backend's public GPU-marketplace transparency
// endpoints (Milestone 4, W-C — gatewayz-backend#2263 #2264, spec.md §6).
// No auth; these are the aggregate-only, cached, rate-limited `/gpu/public/*`
// routes — never a source of wallet/endpoint/provider identity, only display
// aggregates (see the "aggregate-only guarantee" test in spec.md §6).
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

export interface GpuPublicSummary {
  active_nodes: number;
  approved_providers: number;
  regions: GpuPublicRegion[];
  models: GpuPublicModel[];
  last_hour: GpuPublicLastHour;
  updated_at: string;
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
  const body = (await response.json()) as { success: boolean; data: T };
  return body.data;
}

/** GET /gpu/public/summary (public, cached 30s server-side). */
export async function getGpuPublicSummary(): Promise<GpuPublicSummary> {
  return getJson<GpuPublicSummary>(`${API_BASE_URL}/gpu/public/summary`);
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
