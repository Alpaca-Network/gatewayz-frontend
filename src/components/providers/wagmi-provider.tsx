"use client";

/**
 * wagmi provider for the WAYZ token/staking testnet integration.
 *
 * Only ever mounted from privy-web-provider.tsx, which is itself only imported on web (never
 * on Tauri desktop — see privy-provider.tsx) — so this never renders without a <PrivyProvider>
 * ancestor, which @privy-io/wagmi's WagmiProvider requires to keep wagmi's connection state in
 * sync with Privy.
 */
import type { ReactNode } from "react";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import { wagmiConfig } from "@/lib/wayz/wagmi-config";

export function WayzWagmiProvider({ children }: { children: ReactNode }) {
  return <PrivyWagmiProvider config={wagmiConfig}>{children}</PrivyWagmiProvider>;
}
