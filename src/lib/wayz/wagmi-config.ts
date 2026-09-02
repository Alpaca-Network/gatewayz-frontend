/**
 * wagmi config for the WAYZ token/staking testnet integration.
 *
 * Built via `@privy-io/wagmi`'s `createConfig` (not plain `wagmi`) so wallets wagmi sees stay
 * in sync with Privy's connection state — see https://docs.privy.io/wallets/using-wallets/evm/using-wagmi
 */
import { createConfig } from "@privy-io/wagmi";
import { http } from "viem";
import { avalancheFuji, base, FUJI_RPC_URL } from "./chains";

export const wagmiConfig = createConfig({
  chains: [base, avalancheFuji],
  transports: {
    [base.id]: http(),
    [avalancheFuji.id]: http(FUJI_RPC_URL),
  },
});
