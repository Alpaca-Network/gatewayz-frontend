# WAYZ Staking Dashboard

## Overview

`/staking` lets a connected wallet stake WAYZ, request/cancel/withdraw an
unstake, and claim testnet WAYZ from the faucet, on Avalanche Fuji (chain id
`43113`). Built for Milestone 1 — WAYZ Token & Staking Testnet
(`Alpaca-Network/gatewayz-backend#2246`).

Nothing is deployed to Fuji yet. The page and nav link degrade cleanly until
`NEXT_PUBLIC_WAYZ_TOKEN_ADDRESS` / `NEXT_PUBLIC_WAYZ_STAKING_ADDRESS` are set
— this matches production's state today.

## Env vars

| Var | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_WAYZ_TOKEN_ADDRESS` | for staking | WAYZToken contract address on Fuji. Empty today. |
| `NEXT_PUBLIC_WAYZ_STAKING_ADDRESS` | for staking | WAYZStaking contract address on Fuji. Empty today. |
| `NEXT_PUBLIC_AVALANCHE_FUJI_RPC_URL` | no | Overrides the default public Fuji RPC (`https://api.avax-test.network/ext/bc/C/rpc`) used both by the app's wagmi config (`feat/wayz-wallet-connect`, #2243) and by this dashboard's on-chain reads — one var, not two. |
| `NEXT_PUBLIC_WAYZ_STAKING_PREVIEW` | no | Set to `true` to show the "Staking" nav link before contracts are deployed. |

## Data flow

- **Backend indexer** (`src/lib/wayz/staking-api.ts`) — `GET /staking/summary`
  and `GET /staking/wallets/{address}` (public), refreshed by the backend's
  indexer roughly every ~15 minutes. Used for the protocol-wide totals and
  the "daily inference allowance" figure.
- **Live on-chain reads** (`src/lib/wayz/contract-reads.ts`) — a single
  `multicall` (viem, no wagmi) for token balance, staked balance, pending
  unstake, total staked, allowance, and `paused()`. Used for anything that
  needs to be correct immediately after a write, since the indexer lags.
- **Writes** (`src/lib/wayz/contract-writes.ts`) — `approveAndStake`,
  `requestUnstake`, `cancelUnstake`, `withdraw`. Each switches the wallet to
  Fuji first, waits for the transaction receipt, and decodes the staking
  contract's custom errors into friendly copy (see Error mapping below).
- **Faucet** (`src/lib/wayz/staking-api.ts` + `use-wayz-staking.ts`'s
  `useClaimFaucet`) — `GET /faucet/status` for eligibility/claim state, then
  on claim: `POST /faucet/nonce` → the wallet signs the returned message
  verbatim (EIP-191 `personal_sign`) → `POST /faucet/claim`.

All wei amounts from the backend arrive as decimal strings and are parsed to
`bigint` at the API boundary (`staking-api.ts`) — never run `Number()` on a
token amount.

## Error mapping

**Staking contract custom errors** (`contract-writes.ts`):

| Error | Copy |
| --- | --- |
| `ZeroAmount` | "Amount must be greater than zero." |
| `InsufficientStake` | "You do not have enough staked WAYZ to unstake that amount." |
| `PendingUnstakeExists` | "You already have a pending unstake request — cancel it before starting a new one." |
| `NoPendingUnstake` | "There is no pending unstake request to act on." |
| `StillCoolingDown` | "This unstake is still cooling down. Check back after the cooldown ends." |
| `ZeroAddress` | "Invalid wallet address." |

**Faucet claim HTTP statuses** (`describeFaucetError` in `staking-api.ts`):

| Status | Meaning | Copy |
| --- | --- | --- |
| 400 | no nonce / expired | "Your claim session expired. Please try again." |
| 401 | bad signature | "Wallet signature could not be verified. Please try again." |
| 403 | not eligible | "This wallet is not eligible yet — complete at least one inference request first." |
| 409 | already claimed | "This wallet has already claimed testnet WAYZ." |
| 502 | mint failed | "The mint transaction failed. Please try again shortly." |
| 503 | faucet unconfigured | "The testnet faucet is not configured yet." |

## Wallet integration (Privy, via #2243)

Workstream A (`feat/wayz-wallet-connect`, gatewayz-frontend#2243, merged
`2102a8a7`) owns wallet connect, chain switching, EIP-191 signing, and the
wagmi provider mount. This dashboard consumes it through two seams:

- `src/lib/hooks/use-active-wallet.ts` — Privy-backed (`usePrivy`/
  `useWallets`). Exposes `address`, `chainId`, `isConnected`, `isReady`,
  `walletClientType`, and `connect`/`switchToFuji`/`signMessage`. Used
  directly by `WalletGate`, `StakingPageClient`, and `useClaimFaucet`
  (`signMessage` returns the 0x-prefixed signature string, passed straight
  to `POST /faucet/claim`).
- `src/lib/wayz/wallet-provider.ts#useEip1193Provider` — the single seam
  that knows the wallet's EIP-1193 provider comes from the active Privy
  wallet's `getEthereumProvider()` (async — verified against the installed
  `@privy-io/react-auth@3.10.2` types). `use-wayz-staking.ts`'s
  `useWriteContext` awaits it to build a fresh viem `WalletClient`
  (`createWalletClient({chain: avalancheFuji, transport: custom(provider)})`)
  inside each mutation's `mutationFn` — building it can't happen
  synchronously in the hook body since resolving the provider is async.
  Privy's `EIP1193Provider` type and viem's are structurally distinct (both
  describe the same `request`/`on`/`removeListener` surface, but disagree
  on `on`'s strict typing); the cast between them is safe because viem's
  `custom()` transport only ever calls `.request(...)` (verified against
  the installed `viem@2.44.2` source).

## Out of scope (this workstream)

The backend indexer/faucet (Workstream C); linking a wallet to a Gatewayz
account (Epic 2); mainnet; enforcing the daily inference allowance
client-side.
