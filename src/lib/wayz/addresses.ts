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

/**
 * True when this build allows the /staking route at all: Vercel preview and
 * development deployments, and `next dev`. `STAKING_ROUTE_HIDDEN` is inlined
 * by next.config.ts from the same function that emits the production-only
 * /staking redirect (src/config/redirects.ts), so the redirect, this page gate
 * and the header link cannot disagree. Fails closed: anything but an explicit
 * 'false' (e.g. the value was never inlined) keeps staking hidden.
 */
export function isStakingRouteAllowed(): boolean {
  return process.env.STAKING_ROUTE_HIDDEN === 'false';
}

/**
 * The single "show staking" condition shared by the /staking page and the
 * header nav link: the build must allow the route, and WAYZ must be
 * configured or explicitly previewed.
 */
export function shouldShowStaking(): boolean {
  return (
    isStakingRouteAllowed() &&
    (isWayzConfigured() || process.env.NEXT_PUBLIC_WAYZ_STAKING_PREVIEW === 'true')
  );
}
