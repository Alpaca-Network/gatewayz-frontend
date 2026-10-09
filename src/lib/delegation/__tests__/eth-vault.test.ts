import { encodeFunctionData, toFunctionSelector, type PublicClient } from 'viem';
import {
  describeVaultError,
  estimateNetworkFee,
  isUserRejection,
  readExitRequests,
  readVaultPosition,
} from '../eth-vault';
import { ETH_EXIT_CLAIM_DELAY_SECONDS, ETH_VAULT_ABI } from '../stakewise-abi';

const VAULT = '0x1111111111111111111111111111111111111111';
const USER = '0x2222222222222222222222222222222222222222';
const MAX = (BigInt(1) << BigInt(256)) - BigInt(1);
const ETH = BigInt(10) ** BigInt(18);

type Reads = Record<string, (args: readonly unknown[]) => unknown>;

function fakeClient(reads: Reads, logs: Record<string, unknown[]> = {}, blocks: Record<string, bigint> = {}) {
  return {
    readContract: jest.fn(async ({ functionName, args }: { functionName: string; args?: readonly unknown[] }) => {
      const fn = reads[functionName];
      if (!fn) throw new Error(`unexpected read ${functionName}`);
      return fn(args ?? []);
    }),
    getLogs: jest.fn(async ({ event }: { event: { name: string } }) => logs[event.name] ?? []),
    getBlock: jest.fn(async ({ blockNumber }: { blockNumber: bigint }) => ({ timestamp: blocks[blockNumber.toString()] })),
    estimateContractGas: jest.fn(async () => BigInt(100_000)),
    estimateFeesPerGas: jest.fn(async () => ({ maxFeePerGas: BigInt(20_000_000_000) })),
  } as unknown as PublicClient & {
    readContract: jest.Mock;
    getLogs: jest.Mock;
    getBlock: jest.Mock;
    estimateContractGas: jest.Mock;
  };
}

describe('StakeWise ABI', () => {
  it('matches the verified V3 selectors', () => {
    expect(toFunctionSelector('deposit(address,address)')).toBe('0xf9609f08');
    expect(toFunctionSelector('enterExitQueue(uint256,address)')).toBe('0x8ceab9aa');
    expect(toFunctionSelector('claimExitedAssets(uint256,uint256,uint256)')).toBe('0x8697d2c2');
    // and the ABI encodes to them
    expect(encodeFunctionData({ abi: ETH_VAULT_ABI, functionName: 'deposit', args: [USER, USER] }).slice(0, 10)).toBe(
      '0xf9609f08',
    );
    expect(
      encodeFunctionData({ abi: ETH_VAULT_ABI, functionName: 'enterExitQueue', args: [BigInt(1), USER] }).slice(0, 10),
    ).toBe('0x8ceab9aa');
    expect(
      encodeFunctionData({
        abi: ETH_VAULT_ABI,
        functionName: 'claimExitedAssets',
        args: [BigInt(1), BigInt(2), BigInt(3)],
      }).slice(0, 10),
    ).toBe('0x8697d2c2');
  });
});

describe('readVaultPosition', () => {
  it('converts shares to assets and reports remaining capacity', async () => {
    const client = fakeClient({
      getShares: () => BigInt(2) * ETH,
      convertToAssets: ([shares]) => ((shares as bigint) * BigInt(105)) / BigInt(100),
      isStateUpdateRequired: () => false,
      capacity: () => BigInt(100) * ETH,
      totalAssets: () => BigInt(40) * ETH,
    });
    await expect(readVaultPosition(client, VAULT, USER)).resolves.toEqual({
      shares: BigInt(2) * ETH,
      assets: (BigInt(21) * ETH) / BigInt(10),
      stateUpdateRequired: false,
      remainingCapacity: BigInt(60) * ETH,
    });
  });

  it('treats max-uint capacity as uncapped and skips conversion for zero shares', async () => {
    const client = fakeClient({
      getShares: () => BigInt(0),
      isStateUpdateRequired: () => true,
      capacity: () => MAX,
      totalAssets: () => ETH,
    });
    const position = await readVaultPosition(client, VAULT, USER);
    expect(position).toMatchObject({ assets: BigInt(0), remainingCapacity: null, stateUpdateRequired: true });
    expect(client.readContract.mock.calls.map((c) => c[0].functionName)).not.toContain('convertToAssets');
  });
});

describe('readExitRequests', () => {
  const T0 = BigInt(1_700_000_000);
  const now = Number(T0) + ETH_EXIT_CLAIM_DELAY_SECONDS + 60;

  it('classifies queued, processing and claimable requests and drops claimed ones', async () => {
    const logs = {
      ExitQueueEntered: [
        { args: { positionTicket: BigInt(10), shares: ETH }, blockNumber: BigInt(1) }, // queued
        { args: { positionTicket: BigInt(20), shares: ETH }, blockNumber: BigInt(2) }, // claimable
        { args: { positionTicket: BigInt(30), shares: ETH }, blockNumber: BigInt(3) }, // processing (recent)
        { args: { positionTicket: BigInt(40), shares: ETH }, blockNumber: BigInt(1) }, // fully claimed
      ],
      V2ExitQueueEntered: [],
      ExitedAssetsClaimed: [{ args: { prevPositionTicket: BigInt(40), newPositionTicket: BigInt(0) } }],
    };
    const blocks = { '1': T0, '2': T0, '3': BigInt(now - 60) };
    const client = fakeClient(
      {
        getExitQueueIndex: ([ticket]) => (ticket === BigInt(10) ? BigInt(-1) : BigInt(0)),
        convertToAssets: ([shares]) => shares,
        calculateExitedAssets: ([, ticket]) =>
          ticket === BigInt(20) || ticket === BigInt(30) ? [BigInt(0), ETH, ETH] : [BigInt(0), BigInt(0), BigInt(0)],
      },
      logs,
      blocks,
    );
    const requests = await readExitRequests(client, VAULT, USER, now);
    const byTicket = Object.fromEntries(requests.map((r) => [r.positionTicket.toString(), r]));
    expect(Object.keys(byTicket).sort()).toEqual(['10', '20', '30']);
    expect(byTicket['10']).toMatchObject({ status: 'queued', exitQueueIndex: null, queuedAssets: ETH });
    expect(byTicket['20']).toMatchObject({ status: 'claimable', exitQueueIndex: BigInt(0), exitedAssets: ETH, timestamp: T0 });
    expect(byTicket['30'].status).toBe('processing');
    // filtered by receiver
    expect(client.getLogs.mock.calls[0][0].args).toEqual({ receiver: USER });
  });

  it('follows a partial claim to the new ticket under the original timestamp', async () => {
    const client = fakeClient(
      {
        getExitQueueIndex: () => BigInt(2),
        convertToAssets: ([shares]) => shares,
        calculateExitedAssets: ([, ticket, timestamp]) =>
          ticket === BigInt(15) && timestamp === T0 ? [ETH, BigInt(0), BigInt(0)] : [BigInt(0), BigInt(0), BigInt(0)],
      },
      {
        ExitQueueEntered: [{ args: { positionTicket: BigInt(10), shares: BigInt(2) * ETH }, blockNumber: BigInt(1) }],
        ExitedAssetsClaimed: [{ args: { prevPositionTicket: BigInt(10), newPositionTicket: BigInt(15) } }],
      },
      { '1': T0 },
    );
    const [request] = await readExitRequests(client, VAULT, USER, now);
    expect(request).toMatchObject({ positionTicket: BigInt(15), timestamp: T0, status: 'queued', queuedAssets: ETH });
  });
});

describe('estimateNetworkFee', () => {
  it('multiplies estimated gas by the max fee per gas', async () => {
    const client = fakeClient({});
    const result = await estimateNetworkFee(client, {
      vault: VAULT,
      account: USER,
      functionName: 'deposit',
      args: [USER, USER],
      value: ETH,
    });
    expect(result).toEqual({ gas: BigInt(100_000), fee: BigInt(100_000) * BigInt(20_000_000_000) });
    expect(client.estimateContractGas.mock.calls[0][0]).toMatchObject({ functionName: 'deposit', value: ETH, account: USER });
  });
});

describe('errors', () => {
  it('recognizes wallet rejections, including nested causes', () => {
    expect(isUserRejection({ code: 4001 })).toBe(true);
    expect(isUserRejection({ message: 'x', cause: { shortMessage: 'User rejected the request.' } })).toBe(true);
    expect(isUserRejection(new Error('boom'))).toBe(false);
  });

  it('maps vault reverts to plain copy', () => {
    expect(describeVaultError({ code: 4001 })).toMatch(/cancelled/);
    expect(describeVaultError(new Error('reverted with NotHarvested()'))).toMatch(/updating its rewards/);
    expect(describeVaultError(new Error('CapacityExceeded'))).toMatch(/room/);
    expect(describeVaultError(new Error('ExitRequestNotProcessed'))).toMatch(/not ready/);
    expect(describeVaultError(new Error('insufficient funds for gas'))).toMatch(/Not enough ETH/);
    expect(describeVaultError(new Error('???'))).toMatch(/Something went wrong/);
  });
});
