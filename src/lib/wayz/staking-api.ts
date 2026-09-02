// Typed client for the backend's WAYZ staking + faucet read/write endpoints
// (Workstream C, gatewayz-backend#2246 / #2245). All wei amounts arrive as
// decimal strings — parsed to `bigint` here, at the boundary, so nothing
// downstream ever runs `Number()` on a token amount.
import { makeAuthenticatedRequest } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

export type FaucetClaimStatus = 'pending' | 'sent' | 'failed';

export interface StakingContracts {
  chain_id: number;
  token: string | null;
  staking: string | null;
}

export interface WalletStaking {
  wallet_address: string;
  staked_amount: bigint;
  daily_allowance: bigint;
  last_synced_block: number | null;
  last_synced_at: string | null;
  synced: boolean;
  total_staked: bigint;
  daily_inference_capacity: number;
  contracts: StakingContracts;
  configured: boolean;
}

export interface StakingSummary {
  total_staked: bigint;
  wallet_count: number;
  daily_inference_capacity: number;
  unstake_cooldown_seconds: number;
  last_synced_block: number | null;
  last_synced_at: string | null;
  contracts: StakingContracts;
  configured: boolean;
}

export interface FaucetClaim {
  status: FaucetClaimStatus;
  wallet_address: string;
  tx_hash: string | null;
  claimed_at: string | null;
}

export interface FaucetStatus {
  configured: boolean;
  eligible: boolean;
  min_requests: number;
  claim_amount: bigint;
  claim: FaucetClaim | null;
}

export interface FaucetNonce {
  message: string;
  expires_in: number;
}

export interface FaucetClaimResult {
  success: boolean;
  tx_hash: string;
  amount: bigint;
}

/** Thrown for any non-2xx response from a `/faucet/*` or `/staking/*` call. */
export class FaucetError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'FaucetError';
    this.status = status;
    this.detail = detail;
  }
}

/** Parses a decimal wei string into a bigint. Empty/undefined -> 0n. */
function toBigInt(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined || value === '') {
    return BigInt(0);
  }
  return BigInt(value);
}

async function extractErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body?.detail || body?.error || body?.message || response.statusText || 'Request failed';
  } catch {
    return response.statusText || 'Request failed';
  }
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new FaucetError(response.status, await extractErrorDetail(response));
  }
  return response.json();
}

/** GET /staking/wallets/{address} (public). */
export async function getWalletStaking(address: string): Promise<WalletStaking> {
  const response = await fetch(`${API_BASE_URL}/staking/wallets/${address}`);
  const body = await parseJsonOrThrow<{ success: boolean; data: Record<string, unknown> }>(response);
  const data = body.data;
  return {
    wallet_address: data.wallet_address as string,
    staked_amount: toBigInt(data.staked_amount as string),
    daily_allowance: toBigInt(data.daily_allowance as string),
    last_synced_block: (data.last_synced_block as number) ?? null,
    last_synced_at: (data.last_synced_at as string) ?? null,
    synced: Boolean(data.synced),
    total_staked: toBigInt(data.total_staked as string),
    daily_inference_capacity: (data.daily_inference_capacity as number) ?? 0,
    contracts: data.contracts as StakingContracts,
    configured: Boolean(data.configured),
  };
}

/** GET /staking/summary (public). */
export async function getStakingSummary(): Promise<StakingSummary> {
  const response = await fetch(`${API_BASE_URL}/staking/summary`);
  const body = await parseJsonOrThrow<{ success: boolean; data: Record<string, unknown> }>(response);
  const data = body.data;
  return {
    total_staked: toBigInt(data.total_staked as string),
    wallet_count: (data.wallet_count as number) ?? 0,
    daily_inference_capacity: (data.daily_inference_capacity as number) ?? 0,
    unstake_cooldown_seconds: (data.unstake_cooldown_seconds as number) ?? 0,
    last_synced_block: (data.last_synced_block as number) ?? null,
    last_synced_at: (data.last_synced_at as string) ?? null,
    contracts: data.contracts as StakingContracts,
    configured: Boolean(data.configured),
  };
}

/** GET /faucet/status?wallet_address=0x… (Bearer). */
export async function getFaucetStatus(walletAddress: string): Promise<FaucetStatus> {
  const response = await makeAuthenticatedRequest(
    `${API_BASE_URL}/faucet/status?wallet_address=${encodeURIComponent(walletAddress)}`
  );
  const body = await parseJsonOrThrow<{ success: boolean; data: Record<string, unknown> }>(response);
  const data = body.data;
  const claim = data.claim as Record<string, unknown> | null;
  return {
    configured: Boolean(data.configured),
    eligible: Boolean(data.eligible),
    min_requests: (data.min_requests as number) ?? 0,
    claim_amount: toBigInt(data.claim_amount as string),
    claim: claim
      ? {
          status: claim.status as FaucetClaimStatus,
          wallet_address: claim.wallet_address as string,
          tx_hash: (claim.tx_hash as string) ?? null,
          claimed_at: (claim.claimed_at as string) ?? null,
        }
      : null,
  };
}

/** POST /faucet/nonce (Bearer). Returns the exact message to sign verbatim. */
export async function requestFaucetNonce(walletAddress: string): Promise<FaucetNonce> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/faucet/nonce`, {
    method: 'POST',
    body: JSON.stringify({ wallet_address: walletAddress }),
  });
  const body = await parseJsonOrThrow<{ success: boolean; data: FaucetNonce }>(response);
  return body.data;
}

/** POST /faucet/claim (Bearer). */
export async function claimFaucet(walletAddress: string, signature: string): Promise<FaucetClaimResult> {
  const response = await makeAuthenticatedRequest(`${API_BASE_URL}/faucet/claim`, {
    method: 'POST',
    body: JSON.stringify({ wallet_address: walletAddress, signature }),
  });
  const body = await parseJsonOrThrow<{ success: boolean; tx_hash: string; amount: string }>(response);
  return {
    success: body.success,
    tx_hash: body.tx_hash,
    amount: toBigInt(body.amount),
  };
}

/** Maps a `FaucetError` status to short, user-facing copy for the claim flow. */
export function describeFaucetError(error: FaucetError): string {
  switch (error.status) {
    case 400:
      return 'Your claim session expired. Please try again.';
    case 401:
      return 'Wallet signature could not be verified. Please try again.';
    case 403:
      return 'This wallet is not eligible yet — complete at least one inference request first.';
    case 409:
      return 'This wallet has already claimed testnet WAYZ.';
    case 502:
      return 'The mint transaction failed. Please try again shortly.';
    case 503:
      return 'The testnet faucet is not configured yet.';
    default:
      return error.detail || 'Something went wrong. Please try again.';
  }
}
