import { readStakingState, type StakingPublicClient } from '../contract-reads';

const TOKEN = '0x1000000000000000000000000000000000000a' as const;
const STAKING = '0x2000000000000000000000000000000000000b' as const;
const ADDRESS = '0x3000000000000000000000000000000000000c' as const;

function mockClient(multicallImpl: jest.Mock): StakingPublicClient {
  return { multicall: multicallImpl } as unknown as StakingPublicClient;
}

describe('readStakingState', () => {
  it('shapes a fully-successful multicall into StakingState', async () => {
    const multicall = jest.fn().mockResolvedValue([
      { status: 'success', result: 100n }, // balanceOf
      { status: 'success', result: 50n }, // stakedBalanceOf
      { status: 'success', result: [10n, 12345n] }, // pendingUnstake -> (amount, unlockAt)
      { status: 'success', result: 1000n }, // totalStaked
      { status: 'success', result: 25n }, // allowance
      { status: 'success', result: false }, // paused
    ]);

    const result = await readStakingState(ADDRESS, { token: TOKEN, staking: STAKING }, mockClient(multicall));

    expect(multicall).toHaveBeenCalledWith(
      expect.objectContaining({
        contracts: expect.arrayContaining([
          expect.objectContaining({ address: TOKEN, functionName: 'balanceOf', args: [ADDRESS] }),
          expect.objectContaining({ address: STAKING, functionName: 'stakedBalanceOf', args: [ADDRESS] }),
          expect.objectContaining({ address: STAKING, functionName: 'pendingUnstake', args: [ADDRESS] }),
          expect.objectContaining({ address: STAKING, functionName: 'totalStaked' }),
          expect.objectContaining({ address: TOKEN, functionName: 'allowance', args: [ADDRESS, STAKING] }),
          expect.objectContaining({ address: STAKING, functionName: 'paused' }),
        ]),
        allowFailure: true,
      })
    );

    expect(result).toEqual({
      tokenBalance: 100n,
      stakedBalance: 50n,
      pending: { amount: 10n, unlockAt: 12345n },
      totalStaked: 1000n,
      allowance: 25n,
      paused: false,
    });
  });

  it('degrades individual failed calls to safe defaults instead of throwing', async () => {
    const multicall = jest.fn().mockResolvedValue([
      { status: 'failure', error: new Error('revert') },
      { status: 'success', result: 50n },
      { status: 'failure', error: new Error('revert') },
      { status: 'success', result: 1000n },
      { status: 'success', result: 0n },
      { status: 'success', result: true },
    ]);

    const result = await readStakingState(ADDRESS, { token: TOKEN, staking: STAKING }, mockClient(multicall));

    expect(result.tokenBalance).toBe(0n);
    expect(result.pending).toEqual({ amount: 0n, unlockAt: 0n });
    expect(result.paused).toBe(true);
  });
});
