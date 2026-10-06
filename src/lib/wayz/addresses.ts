// Contract addresses for the WAYZ token + staking testnet deployment on
// Avalanche Fuji. Nothing is deployed yet (Milestone 1 — WAYZ Token &
// Staking Testnet) — both env vars are empty in every environment today,
// and every consumer of this module must degrade cleanly when they are.
import type { Address } from 'viem';

export interface WayzAddresses {
  token: Address | null;
  staking: Address | null;
}

function readAddressEnv(value: string | undefined): Address | null {
  const trimmed = value?.trim();
  return trimmed ? (trimmed as Address) : null;
}

/** Reads `NEXT_PUBLIC_WAYZ_TOKEN_ADDRESS` / `NEXT_PUBLIC_WAYZ_STAKING_ADDRESS`. */
export function getWayzAddresses(): WayzAddresses {
  return {
    token: readAddressEnv(process.env.NEXT_PUBLIC_WAYZ_TOKEN_ADDRESS),
    staking: readAddressEnv(process.env.NEXT_PUBLIC_WAYZ_STAKING_ADDRESS),
  };
}

/** True only once both the token and staking contracts have addresses. */
export function isWayzConfigured(): boolean {
  const { token, staking } = getWayzAddresses();
  return Boolean(token && staking);
}

/** The /staking page gate: WAYZ is configured or explicitly previewed. */
export function isStakingEnabled(): boolean {
  return isWayzConfigured() || process.env.NEXT_PUBLIC_WAYZ_STAKING_PREVIEW === 'true';
}

/**
 * The header nav link: staking is enabled AND this build lists it.
 * STAKING_NAV_HIDDEN is inlined by next.config.ts (isStakingNavHiddenForBuild);
 * anything but an explicit 'false' keeps the link hidden, so production —
 * where /staking is unlisted — never shows it.
 */
export function shouldShowStakingNav(): boolean {
  return process.env.STAKING_NAV_HIDDEN === 'false' && isStakingEnabled();
}
