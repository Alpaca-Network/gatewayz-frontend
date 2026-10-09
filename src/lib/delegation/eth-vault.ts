// Reads and transaction helpers for the StakeWise V3 vault on Ethereum mainnet.
// Every function takes a viem client built on the user's own wallet provider
// (see use-eth-vault.ts), so reads go through the wallet's RPC rather than a
// host our CSP would have to allow, and nothing here holds keys or funds.
import { getAbiItem, type Address, type PublicClient } from 'viem';
import { ETH_EXIT_CLAIM_DELAY_SECONDS, ETH_VAULT_ABI, STAKEWISE_V3_FIRST_BLOCK } from './stakewise-abi';

export const ETHEREUM_MAINNET_ID = 1;

export interface VaultPosition {
  shares: bigint;
  assets: bigint;
  /** True when the vault must be harvested before it accepts deposits. */
  stateUpdateRequired: boolean;
  /** Remaining room before the vault's capacity; null when uncapped. */
  remainingCapacity: bigint | null;
}

export type ExitRequestStatus = 'queued' | 'processing' | 'claimable';

export interface ExitRequest {
  positionTicket: bigint;
  /** Unix seconds of the enterExitQueue block: part of the request's key. */
  timestamp: bigint;
  /** Checkpoint index once the queue reaches this request; null before. */
  exitQueueIndex: bigint | null;
  /** ETH value still waiting in the queue. */
  queuedAssets: bigint;
  /** ETH already exited and ready to claim (after the delay). */
  exitedAssets: bigint;
  status: ExitRequestStatus;
  /** Unix seconds after which a processed request can be claimed. */
  claimableAt: number;
}

const MAX_UINT256 = (BigInt(1) << BigInt(256)) - BigInt(1);

export async function readVaultPosition(client: PublicClient, vault: Address, user: Address): Promise<VaultPosition> {
  const read = <T>(functionName: string, args: readonly unknown[] = []) =>
    client.readContract({ address: vault, abi: ETH_VAULT_ABI, functionName, args } as never) as Promise<T>;

  const [shares, stateUpdateRequired, capacity, totalAssets] = await Promise.all([
    read<bigint>('getShares', [user]),
    read<boolean>('isStateUpdateRequired'),
    read<bigint>('capacity'),
    read<bigint>('totalAssets'),
  ]);
  const assets = shares > BigInt(0) ? await read<bigint>('convertToAssets', [shares]) : BigInt(0);
  const remainingCapacity =
    capacity === MAX_UINT256 ? null : capacity > totalAssets ? capacity - totalAssets : BigInt(0);
  return { shares, assets, stateUpdateRequired, remainingCapacity };
}

/** Converts an ETH amount to vault shares, capped at what the user holds. */
export async function assetsToShares(
  client: PublicClient,
  vault: Address,
  assets: bigint,
  maxShares: bigint,
): Promise<bigint> {
  const shares = (await client.readContract({
    address: vault,
    abi: ETH_VAULT_ABI,
    functionName: 'convertToShares',
    args: [assets],
  })) as bigint;
  return shares > maxShares ? maxShares : shares;
}

export interface OpenTicket {
  positionTicket: bigint;
  /** Unix seconds of the enterExitQueue block. */
  timestamp: bigint;
  /** Shares queued under this ticket, used to value it while still queued. */
  shares: bigint;
}

/**
 * The user's open exit requests: every ExitQueueEntered for them as receiver,
 * re-keyed through any partial claims, minus fully claimed ones.
 */
export async function readExitRequests(
  client: PublicClient,
  vault: Address,
  user: Address,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<ExitRequest[]> {
  const fromBlock = STAKEWISE_V3_FIRST_BLOCK;
  const [entered, enteredV2, claimed] = await Promise.all([
    client.getLogs({
      address: vault,
      event: getAbiItem({ abi: ETH_VAULT_ABI, name: 'ExitQueueEntered' }),
      args: { receiver: user },
      fromBlock,
      toBlock: 'latest',
    }),
    client.getLogs({
      address: vault,
      event: getAbiItem({ abi: ETH_VAULT_ABI, name: 'V2ExitQueueEntered' }),
      args: { receiver: user },
      fromBlock,
      toBlock: 'latest',
    }),
    client.getLogs({
      address: vault,
      event: getAbiItem({ abi: ETH_VAULT_ABI, name: 'ExitedAssetsClaimed' }),
      args: { receiver: user },
      fromBlock,
      toBlock: 'latest',
    }),
  ]);

  const nextTicket = new Map<bigint, bigint>();
  for (const log of claimed) {
    const { prevPositionTicket, newPositionTicket } = log.args;
    if (prevPositionTicket !== undefined && newPositionTicket !== undefined) {
      nextTicket.set(prevPositionTicket, newPositionTicket);
    }
  }

  const blockTimes = new Map<bigint, bigint>();
  const timestampOf = async (blockNumber: bigint | null): Promise<bigint> => {
    if (blockNumber === null) return BigInt(0);
    const cached = blockTimes.get(blockNumber);
    if (cached !== undefined) return cached;
    const block = await client.getBlock({ blockNumber });
    blockTimes.set(blockNumber, block.timestamp);
    return block.timestamp;
  };

  const open: OpenTicket[] = [];
  for (const log of [...entered, ...enteredV2]) {
    const { positionTicket, shares } = log.args;
    if (positionTicket === undefined || positionTicket === MAX_UINT256) continue;
    let ticket: bigint | undefined = positionTicket;
    // Follow partial claims to the ticket the remainder now lives under.
    const seen = new Set<bigint>();
    while (ticket !== undefined && nextTicket.has(ticket) && !seen.has(ticket)) {
      seen.add(ticket);
      ticket = nextTicket.get(ticket);
    }
    if (ticket === undefined || ticket === BigInt(0)) continue; // fully claimed
    open.push({ positionTicket: ticket, timestamp: await timestampOf(log.blockNumber), shares: shares ?? BigInt(0) });
  }

  return describeTickets(client, vault, user, open, nowSeconds);
}

/**
 * Current on-chain state of known exit tickets (from the event scan above, or
 * from the backend when it lists them), minus fully claimed ones.
 */
export async function describeTickets(
  client: PublicClient,
  vault: Address,
  user: Address,
  tickets: OpenTicket[],
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<ExitRequest[]> {
  const requests = await Promise.all(tickets.map((t) => describeTicket(client, vault, user, t, nowSeconds)));
  return requests
    .filter((r): r is ExitRequest => r !== null)
    .sort((a, b) => Number(b.timestamp - a.timestamp));
}

async function describeTicket(
  client: PublicClient,
  vault: Address,
  user: Address,
  ticket: OpenTicket,
  nowSeconds: number,
): Promise<ExitRequest | null> {
  const index = (await client.readContract({
    address: vault,
    abi: ETH_VAULT_ABI,
    functionName: 'getExitQueueIndex',
    args: [ticket.positionTicket],
  })) as bigint;
  const claimableAt = Number(ticket.timestamp) + ETH_EXIT_CLAIM_DELAY_SECONDS;

  if (index < BigInt(0)) {
    const queuedAssets = (await client.readContract({
      address: vault,
      abi: ETH_VAULT_ABI,
      functionName: 'convertToAssets',
      args: [ticket.shares],
    })) as bigint;
    return {
      positionTicket: ticket.positionTicket,
      timestamp: ticket.timestamp,
      exitQueueIndex: null,
      queuedAssets,
      exitedAssets: BigInt(0),
      status: 'queued',
      claimableAt,
    };
  }

  const [leftTickets, exitedTickets, exitedAssets] = (await client.readContract({
    address: vault,
    abi: ETH_VAULT_ABI,
    functionName: 'calculateExitedAssets',
    args: [user, ticket.positionTicket, ticket.timestamp, index],
  })) as readonly [bigint, bigint, bigint];

  // No tickets left under this key: it was claimed in full.
  if (leftTickets === BigInt(0) && exitedTickets === BigInt(0) && exitedAssets === BigInt(0)) return null;

  const queuedAssets =
    leftTickets > BigInt(0)
      ? ((await client.readContract({
          address: vault,
          abi: ETH_VAULT_ABI,
          functionName: 'convertToAssets',
          args: [leftTickets],
        })) as bigint)
      : BigInt(0);

  let status: ExitRequestStatus = 'queued';
  if (exitedAssets > BigInt(0)) status = nowSeconds >= claimableAt ? 'claimable' : 'processing';

  return {
    positionTicket: ticket.positionTicket,
    timestamp: ticket.timestamp,
    exitQueueIndex: index,
    queuedAssets,
    exitedAssets,
    status,
    claimableAt,
  };
}

/** Upper bound on the network fee: estimated gas at the current max fee per gas. */
export async function estimateNetworkFee(
  client: PublicClient,
  request: {
    vault: Address;
    account: Address;
    functionName: 'deposit' | 'enterExitQueue' | 'claimExitedAssets';
    args: readonly unknown[];
    value?: bigint;
  },
): Promise<{ gas: bigint; fee: bigint }> {
  const gas = await client.estimateContractGas({
    address: request.vault,
    abi: ETH_VAULT_ABI,
    functionName: request.functionName,
    args: request.args,
    account: request.account,
    value: request.value,
  } as never);
  const fees = await client.estimateFeesPerGas();
  const perGas = fees.maxFeePerGas ?? fees.gasPrice ?? BigInt(0);
  return { gas, fee: gas * perGas };
}

export function isUserRejection(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown; shortMessage?: unknown; cause?: unknown } | null;
  if (!e) return false;
  if (e.code === 4001 || e.code === 'ACTION_REJECTED') return true;
  const text = `${typeof e.shortMessage === 'string' ? e.shortMessage : ''} ${typeof e.message === 'string' ? e.message : ''}`;
  if (/user rejected|rejected the request|denied|cancel/i.test(text)) return true;
  return e.cause ? isUserRejection(e.cause) : false;
}

/** Short, user-facing copy for a failed vault read or transaction. */
export function describeVaultError(error: unknown): string {
  if (isUserRejection(error)) return 'The request was cancelled in your wallet.';
  const e = error as { message?: unknown; shortMessage?: unknown } | null;
  const text = `${typeof e?.shortMessage === 'string' ? e.shortMessage : ''} ${typeof e?.message === 'string' ? e.message : ''}`;
  if (/NotHarvested/i.test(text)) {
    return 'The vault is updating its rewards and briefly cannot accept deposits. Please try again in a few minutes.';
  }
  if (/CapacityExceeded/i.test(text)) return 'This deposit is larger than the vault has room for.';
  if (/ExitRequestNotProcessed/i.test(text)) return 'This exit is not ready to claim yet.';
  if (/insufficient funds/i.test(text)) return 'Not enough ETH in this wallet for the amount plus the network fee.';
  if (/chain|network/i.test(text) && /mismatch|switch|unsupported/i.test(text)) {
    return 'Switch your wallet to Ethereum mainnet and try again.';
  }
  return 'Something went wrong. Please try again.';
}
