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
| `NEXT_PUBLIC_FUJI_RPC_URL` | no | Overrides the default public Fuji RPC (`https://api.avax-test.network/ext/bc/C/rpc`) used for on-chain reads. |
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

## What's stubbed pending #2243

Workstream A (`feat/wayz-wallet-connect`, gatewayz-frontend#2243) owns wallet
connect, chain switching, and EIP-191 signing (Privy), plus mounting the
wagmi provider app-wide. Until that merges, two files on this branch are
minimal STUBs — each carries a `// STUB — superseded by
feat/wayz-wallet-connect (#2243)...` header on line 1, and the orchestrator
keeps that branch's version on merge:

- `src/lib/hooks/use-active-wallet.ts` — always reports "disconnected"; every
  action (`connect`, `switchToFuji`, `signMessage`) rejects.
- `src/lib/wayz/chains.ts` — re-exports `FUJI_CHAIN_ID`, `FUJI_RPC_URL`, and
  the `avalancheFuji`/`base` viem chain objects that #2243's real version
  will also export, so this branch and #2243 agree on the same interface.

Everything downstream of `useActiveWallet` (reads, writes, the dashboard
components) is written against that interface, so swapping the stub for
#2243's real implementation is a two-file change with no ripple elsewhere.

The single choke point for the wallet's EIP-1193 provider is
`src/lib/wayz/wallet-provider.ts#getEip1193Provider` — it reads
`window.ethereum` today; after #2243 merges it should read the active Privy
wallet's `getEthereumProvider()` instead, and nothing else in `src/lib/wayz/`
needs to change.

## Out of scope (this workstream)

Wallet/Privy configuration (Workstream A); the backend indexer/faucet
(Workstream C); linking a wallet to a Gatewayz account; mainnet; enforcing
the daily inference allowance client-side.
