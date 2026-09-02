import { BaseError, ContractFunctionRevertedError, encodeErrorResult, type Hash } from 'viem';
import {
  approveAndStake,
  requestUnstake,
  decodeStakingError,
  StakingWriteError,
  type WriteContext,
} from '../contract-writes';
import { wayzStakingAbi } from '../abi/wayz-staking';

const TOKEN = '0x1000000000000000000000000000000000000a' as const;
const STAKING = '0x2000000000000000000000000000000000000b' as const;
const ACCOUNT = '0x3000000000000000000000000000000000000c' as const;
const TX_HASH = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hash;

/** Args each parameterized custom error needs to encode a real, well-formed revert payload. */
const REVERT_ARGS: Record<string, readonly unknown[]> = {
  InsufficientStake: [10n, 5n],
  StillCoolingDown: [12345n],
};

/** Builds a real viem ContractFunctionRevertedError, wrapped like a live write call would throw it. */
function buildRevertError(errorName: string): BaseError {
  const data = encodeErrorResult({
    abi: wayzStakingAbi,
    errorName: errorName as never,
    args: REVERT_ARGS[errorName] as never,
  });
  const revertError = new ContractFunctionRevertedError({ abi: wayzStakingAbi, data, functionName: 'requestUnstake' });
  return new BaseError('execution reverted', { cause: revertError });
}

function makeContext(overrides: Partial<WriteContext> = {}): {
  ctx: WriteContext;
  writeContract: jest.Mock;
  waitForTransactionReceipt: jest.Mock;
  switchToFuji: jest.Mock;
} {
  const writeContract = jest.fn().mockResolvedValue(TX_HASH);
  const waitForTransactionReceipt = jest.fn().mockResolvedValue({ status: 'success' });
  const switchToFuji = jest.fn().mockResolvedValue(undefined);

  const ctx: WriteContext = {
    walletClient: { writeContract },
    publicClient: { waitForTransactionReceipt },
    account: ACCOUNT,
    switchToFuji,
    ...overrides,
  };

  return { ctx, writeContract, waitForTransactionReceipt, switchToFuji };
}

describe('approveAndStake', () => {
  it('skips approve when allowance already covers the amount', async () => {
    const { ctx, writeContract } = makeContext();

    const hashes = await approveAndStake(ctx, {
      tokenAddress: TOKEN,
      stakingAddress: STAKING,
      amount: 100n,
      currentAllowance: 100n,
    });

    expect(writeContract).toHaveBeenCalledTimes(1);
    expect(writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'stake', args: [100n] }));
    expect(hashes).toEqual([TX_HASH]);
  });

  it('approves first when allowance is insufficient, then stakes', async () => {
    const { ctx, writeContract } = makeContext();

    const hashes = await approveAndStake(ctx, {
      tokenAddress: TOKEN,
      stakingAddress: STAKING,
      amount: 100n,
      currentAllowance: 0n,
    });

    expect(writeContract).toHaveBeenCalledTimes(2);
    expect(writeContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ functionName: 'approve', args: [STAKING, 100n] })
    );
    expect(writeContract).toHaveBeenNthCalledWith(2, expect.objectContaining({ functionName: 'stake', args: [100n] }));
    expect(hashes).toEqual([TX_HASH, TX_HASH]);
  });

  it('calls switchToFuji before sending each write', async () => {
    const { ctx, switchToFuji, writeContract } = makeContext();

    await approveAndStake(ctx, {
      tokenAddress: TOKEN,
      stakingAddress: STAKING,
      amount: 100n,
      currentAllowance: 0n,
    });

    expect(switchToFuji).toHaveBeenCalledTimes(2);
    expect(switchToFuji.mock.invocationCallOrder[0]).toBeLessThan(writeContract.mock.invocationCallOrder[0]);
    expect(switchToFuji.mock.invocationCallOrder[1]).toBeLessThan(writeContract.mock.invocationCallOrder[1]);
  });
});

describe('requestUnstake', () => {
  it('decodes a real PendingUnstakeExists revert into the friendly message', async () => {
    const { ctx, writeContract } = makeContext();
    writeContract.mockRejectedValue(buildRevertError('PendingUnstakeExists'));

    await expect(requestUnstake(ctx, { stakingAddress: STAKING, amount: 10n })).rejects.toThrow(StakingWriteError);
    await expect(requestUnstake(ctx, { stakingAddress: STAKING, amount: 10n })).rejects.toThrow(/pending unstake/i);
  });
});

describe('decodeStakingError', () => {
  it.each([
    ['ZeroAmount', /greater than zero/i],
    ['InsufficientStake', /not have enough staked/i],
    ['PendingUnstakeExists', /pending unstake request/i],
    ['NoPendingUnstake', /no pending unstake/i],
    ['StillCoolingDown', /cooling down/i],
    ['ZeroAddress', /invalid wallet address/i],
  ])('maps %s to friendly copy', (errorName, expected) => {
    const message = decodeStakingError(buildRevertError(errorName));
    expect(message).toMatch(expected);
  });

  it('falls back to the plain Error message for a non-viem error', () => {
    expect(decodeStakingError(new Error('network down'))).toBe('network down');
  });
});
