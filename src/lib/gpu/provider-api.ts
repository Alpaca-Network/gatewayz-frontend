// Typed client for the backend's authenticated GPU-provider-portal endpoints
// (Milestone 4, W-D — gatewayz-backend#2262 #2266, spec.md §3, §5.6, and
// WD-frontend.md's "Contracts" section). Bearer-authenticated via
// makeAuthenticatedRequest, calling the backend directly — same pattern as
// src/lib/wayz/staking-api.ts and src/lib/auth/wallet-auth-api.ts. Every wei
// amount arrives as a decimal string and is parsed to `bigint` here, at the
// boundary (see src/lib/wayz/staking-api.ts's header comment for why).
import { makeAuthenticatedRequest } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

export type GpuProviderStatus = 'pending' | 'approved' | 'suspended';
export type GpuNodeStatus = 'registered' | 'active' | 'degraded' | 'offline' | 'disabled';
export type GpuWorkVerification = 'pending' | 'sampled' | 'verified' | 'failed' | 'skipped';
export type GpuSettlementStatus = 'pending' | 'sent' | 'failed';

export interface GpuProvider {
  id: number;
  display_name: string;
  payout_wallet_address: string;
  contact_email: string | null;
  status: GpuProviderStatus;
  region_default: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
}

export interface GpuNodeModel {
  id: string;
  max_context: number;
}

export interface GpuNode {
  id: number;
  provider_id: number;
  name: string;
  region: string;
  gpu_model: string;
  vram_gb: number;
  bandwidth_mbps: number;
  endpoint_url: string;
  models: GpuNodeModel[];
  status: GpuNodeStatus;
  last_heartbeat_at: string | null;
  health_score: number;
  outstanding_requests: number;
  created_at: string;
}

export interface GpuEarningsSummary {
  accrued_wei: bigint;
  settled_wei: bigint;
  void_wei: bigint;
}

export interface GpuProviderMe {
  provider: GpuProvider;
  nodes: GpuNode[];
  earnings: GpuEarningsSummary;
}

export interface RegisterGpuProviderInput {
  display_name: string;
  payout_wallet_address: string;
  contact_email?: string;
  region_default?: string;
}

export interface CreateGpuNodeInput {
  name: string;
  region: string;
  gpu_model: string;
  vram_gb: number;
  bandwidth_mbps: number;
  endpoint_url: string;
  endpoint_api_key: string;
  models: GpuNodeModel[];
}

export type PatchGpuNodeInput = Partial<
  Pick<
    CreateGpuNodeInput,
    'name' | 'region' | 'gpu_model' | 'vram_gb' | 'bandwidth_mbps' | 'endpoint_url' | 'endpoint_api_key' | 'models'
  >
>;

export interface CreateGpuNodeResult {
  node: GpuNode;
  /** Shown once — the caller must not assume this is retrievable again. */
  node_token: string;
}

export interface GpuWorkRow {
  billing_ref: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  verification: GpuWorkVerification;
  created_at: string;
}

export interface GpuSettlementRow {
  id: number;
  period_start: string;
  period_end: string;
  amount_wei: bigint;
  tx_hash: string | null;
  /** Backend-computed Snowtrace URL (`_settlement_view` in gpu_earnings.py) — use this
   *  rather than reconstructing one from `tx_hash`, so a network change on the backend
   *  side doesn't silently desync this client's hardcoded testnet host. */
  tx_url: string | null;
  status: GpuSettlementStatus;
}

export interface GpuEarnings {
  accrued_wei: bigint;
  settled_wei: bigint;
  void_wei: bigint;
  work: GpuWorkRow[];
  settlements: GpuSettlementRow[];
}

/** Machine-readable error codes this client distinguishes, per WD-frontend.md's contract summary. */
export type GpuProviderErrorCode =
  | 'wallet_not_linked'
  | 'provider_exists'
  | 'endpoint_unreachable'
  | 'models_mismatch'
  | 'provider_not_approved'
  | 'not_found'
  | 'unknown_error';

/** Thrown for any non-2xx response from a `/gpu/providers*` or `/gpu/nodes*` call. */
export class GpuProviderApiError extends Error {
  status: number;
  code: GpuProviderErrorCode;

  constructor(status: number, code: GpuProviderErrorCode) {
    super(code);
    this.name = 'GpuProviderApiError';
    this.status = status;
    this.code = code;
  }
}

/** Parses a decimal wei string into a bigint. Empty/undefined -> 0n (see staking-api.ts's toBigInt). */
function toBigInt(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined || value === '') {
    return BigInt(0);
  }
  return BigInt(value);
}

// `error.detail` on a 400 here is NOT the raw reason string ("models_mismatch",
// "endpoint_unreachable") — the app-wide handler's generic-400 branch
// (src/utils/error_handlers.py -> DetailedErrorFactory.invalid_parameter) always sets
// `error.detail` to a STATIC message and puts the actual raw string in
// `error.context.parameter_value` instead. Confirmed against gatewayz-backend
// tests/routes/test_gpu.py: `test_register_node_endpoint_unreachable` (L283) and
// `test_register_node_models_mismatch` (L295) both assert
// `response.json()["error"]["context"]["parameter_value"]`, never `["error"]["detail"]`.
// Read it only as an optional disambiguation hint, never a required one.
async function readErrorParameterValue(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { context?: { parameter_value?: string } } } | null;
    return body?.error?.context?.parameter_value ?? '';
  } catch {
    return '';
  }
}

function codeForRegisterStatus(status: number): GpuProviderErrorCode {
  if (status === 400) return 'wallet_not_linked';
  if (status === 409) return 'provider_exists';
  return 'unknown_error';
}

function codeForCreateNodeStatus(status: number, parameterValue: string): GpuProviderErrorCode {
  if (status === 400) return parameterValue === 'models_mismatch' ? 'models_mismatch' : 'endpoint_unreachable';
  if (status === 403) return 'provider_not_approved';
  return 'unknown_error';
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await makeAuthenticatedRequest(url, options);
  if (!response.ok) {
    throw new GpuProviderApiError(response.status, 'unknown_error');
  }
  const body = (await response.json()) as { success: boolean; data: T };
  return body.data;
}

function parseEarningsSummary(data: Record<string, unknown>): GpuEarningsSummary {
  return {
    accrued_wei: toBigInt(data.accrued_wei as string),
    settled_wei: toBigInt(data.settled_wei as string),
    void_wei: toBigInt(data.void_wei as string),
  };
}

/** POST /gpu/providers (Bearer) -> 201 GpuProvider. */
export async function registerGpuProvider(input: RegisterGpuProviderInput): Promise<GpuProvider> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/gpu/providers`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new GpuProviderApiError(response.status, codeForRegisterStatus(response.status));
  }
  const body = (await response.json()) as { success: boolean; data: GpuProvider };
  return body.data;
}

/** GET /gpu/providers/me (Bearer) -> {provider, nodes, earnings}. `earnings.void_wei` is
 *  optional on the wire (A1 is adding it) — `parseEarningsSummary`/`toBigInt` default a
 *  missing value to 0n. */
export async function getMyGpuProvider(): Promise<GpuProviderMe> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/gpu/providers/me`);
  if (!response.ok) {
    throw new GpuProviderApiError(response.status, response.status === 404 ? 'not_found' : 'unknown_error');
  }
  const body = (await response.json()) as {
    success: boolean;
    data: { provider: GpuProvider; nodes: GpuNode[]; earnings: Record<string, unknown> };
  };
  return {
    provider: body.data.provider,
    nodes: body.data.nodes,
    earnings: parseEarningsSummary(body.data.earnings),
  };
}

/** POST /gpu/nodes (Bearer, provider must be approved) -> 201 {node, node_token} (token shown once). */
export async function createGpuNode(input: CreateGpuNodeInput): Promise<CreateGpuNodeResult> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/gpu/nodes`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const parameterValue = await readErrorParameterValue(response);
    throw new GpuProviderApiError(response.status, codeForCreateNodeStatus(response.status, parameterValue));
  }
  const body = (await response.json()) as { success: boolean; data: CreateGpuNodeResult };
  return body.data;
}

/** PATCH /gpu/nodes/{id} (Bearer, owner). */
export async function patchGpuNode(id: number, input: PatchGpuNodeInput): Promise<GpuNode> {
  return requestJson<GpuNode>(`${API_BASE_URL}/gpu/nodes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/** DELETE /gpu/nodes/{id} (Bearer, owner) -> node moves to 'disabled'. */
export async function deleteGpuNode(id: number): Promise<void> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/gpu/nodes/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new GpuProviderApiError(response.status, response.status === 404 ? 'not_found' : 'unknown_error');
  }
}

/** POST /gpu/nodes/{id}/rotate-token (Bearer, owner) -> the new one-time token. */
export async function rotateGpuNodeToken(id: number): Promise<string> {
  const data = await requestJson<{ node_token: string }>(`${API_BASE_URL}/gpu/nodes/${id}/rotate-token`, {
    method: 'POST',
  });
  return data.node_token;
}

/** GET /gpu/providers/me/earnings (Bearer). */
export async function getMyGpuEarnings(): Promise<GpuEarnings> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/gpu/providers/me/earnings`);
  if (!response.ok) {
    throw new GpuProviderApiError(response.status, 'unknown_error');
  }
  // Totals are nested under `data.totals`, not flat on `data` — confirmed against the real
  // route (gatewayz-backend `src/routes/gpu_earnings.py`'s `get_my_earnings`, approved
  // PR #2288): `{success, data: {totals: {accrued_wei, settled_wei, void_wei}, work, settlements}}`.
  const body = (await response.json()) as {
    success: boolean;
    data: {
      totals: { accrued_wei: string; settled_wei: string; void_wei: string };
      work: GpuWorkRow[];
      settlements: Array<Omit<GpuSettlementRow, 'amount_wei'> & { amount_wei: string | null }>;
    };
  };
  return {
    accrued_wei: toBigInt(body.data.totals.accrued_wei),
    settled_wei: toBigInt(body.data.totals.settled_wei),
    void_wei: toBigInt(body.data.totals.void_wei),
    work: body.data.work,
    settlements: body.data.settlements.map((row) => ({ ...row, amount_wei: toBigInt(row.amount_wei) })),
  };
}

/** Maps a `GpuProviderApiError` to short, user-facing copy for the provider portal. */
export function describeGpuProviderError(error: GpuProviderApiError): string {
  switch (error.code) {
    case 'wallet_not_linked':
      return 'That wallet is not linked to your account yet — link it under Settings → Wallets first.';
    case 'provider_exists':
      return 'You already have a GPU provider registration on this account.';
    case 'endpoint_unreachable':
      return "We couldn't reach your node's endpoint. Confirm it answers GET /v1/models over https and try again.";
    case 'models_mismatch':
      return "Your node's endpoint didn't report the model ids you listed. Check --served-model-name and try again.";
    case 'provider_not_approved':
      return 'Your provider registration is still pending admin approval.';
    case 'not_found':
      return 'Not found.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
