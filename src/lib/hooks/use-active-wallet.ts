"use client";

/**
 * Client-side active-wallet access, built on Privy's `usePrivy`/`useWallets`.
 *
 * This is a CONTRACT consumed by the WAYZ staking dashboard (a parallel workstream) — keep the
 * `ActiveWallet` shape stable. Out of scope here: linking the wallet to the Gatewayz account
 * (Epic 2) and any on-chain reads/writes beyond signing and switching chains.
 */
import { useCallback, useMemo } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { isTauriDesktop } from "@/lib/browser-detection";
import { FUJI_CHAIN_ID } from "@/lib/wayz/chains";

export interface ActiveWallet {
  /** Checksummed address of the active wallet, or null when none is connected. */
  address: `0x${string}` | null;
  /** Numeric chain id the active wallet is currently on, or null. */
  chainId: number | null;
  isConnected: boolean;
  /** False until Privy has finished initialising (usePrivy().ready). */
  isReady: boolean;
  /** Privy wallet client type, e.g. "privy" (embedded), "metamask", "coinbase_wallet", "wallet_connect". */
  walletClientType: string | null;
  /** Opens Privy's connect-wallet flow (or login with wallet if not authenticated). */
  connect: () => Promise<void>;
  /** Switches the active wallet to Avalanche Fuji (43113). Resolves when done; rejects on user refusal. */
  switchToFuji: () => Promise<void>;
  /** personal_sign the given message with the active wallet; returns the 0x-prefixed signature. */
  signMessage: (message: string) => Promise<string>;
}

const NO_WALLET_ERROR = "useActiveWallet: no wallet connected";

// privy-web-provider.tsx (and thus <PrivyProvider>) is only ever mounted on web — never on
// Tauri desktop, see privy-provider.tsx. Verified against the installed @privy-io/react-auth
// (3.10.2): usePrivy()/useWallets() don't throw without a <PrivyProvider> ancestor, they just
// return safe defaults with `ready`/`wallets.length` permanently stuck at false/0. That would
// leave `isReady` false forever on desktop, so short-circuit to a disconnected-but-ready
// object instead of waiting on a provider that will never mount.
const DISCONNECTED_WALLET: ActiveWallet = {
  address: null,
  chainId: null,
  isConnected: false,
  isReady: true,
  walletClientType: null,
  connect: async () => {},
  switchToFuji: async () => {
    throw new Error(NO_WALLET_ERROR);
  },
  signMessage: async () => {
    throw new Error(NO_WALLET_ERROR);
  },
};

export function useActiveWallet(): ActiveWallet {
  // Called unconditionally, in the same order, on every render regardless of platform — the
  // Tauri-desktop short-circuit below is a plain return, not a skipped hook call.
  const { ready, authenticated, login, connectWallet } = usePrivy();
  const { wallets } = useWallets();

  // Privy orders `wallets` most-recently-connected first, so the first entry is the active one.
  const wallet = wallets[0] ?? null;

  const chainId = useMemo(() => {
    if (!wallet) return null;
    // wallet.chainId is CAIP-2 formatted, e.g. "eip155:43113".
    const parsed = Number.parseInt(wallet.chainId.split(":")[1] ?? "", 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [wallet]);

  const connect = useCallback(async () => {
    if (!authenticated) {
      login({ loginMethods: ["wallet"] });
      return;
    }
    connectWallet();
  }, [authenticated, login, connectWallet]);

  const switchToFuji = useCallback(async () => {
    if (!wallet) {
      throw new Error(NO_WALLET_ERROR);
    }
    await wallet.switchChain(FUJI_CHAIN_ID);
  }, [wallet]);

  const signMessage = useCallback(
    async (message: string) => {
      if (!wallet) {
        throw new Error(NO_WALLET_ERROR);
      }
      return wallet.sign(message);
    },
    [wallet]
  );

  if (typeof window !== "undefined" && isTauriDesktop()) {
    return DISCONNECTED_WALLET;
  }

  return {
    address: (wallet?.address as `0x${string}` | undefined) ?? null,
    chainId,
    isConnected: wallet !== null,
    isReady: ready,
    walletClientType: wallet?.walletClientType ?? null,
    connect,
    switchToFuji,
    signMessage,
  };
}
