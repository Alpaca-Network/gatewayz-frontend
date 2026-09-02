/**
 * Chain constants for the WAYZ token/staking testnet integration.
 *
 * The app's default chain stays Base (see privy-web-provider.tsx) — Avalanche Fuji is only
 * added as a *supported* chain so the staking dashboard (Workstream B) can switch to it
 * explicitly via `useActiveWallet().switchToFuji()`.
 */
import { avalancheFuji, base } from "viem/chains";

export const FUJI_CHAIN_ID = 43113 as const;

export const FUJI_RPC_URL =
  process.env.NEXT_PUBLIC_AVALANCHE_FUJI_RPC_URL || avalancheFuji.rpcUrls.default.http[0];

export { avalancheFuji, base };
