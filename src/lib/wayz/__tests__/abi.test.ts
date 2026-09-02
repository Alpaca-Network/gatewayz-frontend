import { getAbiItem, toEventSelector } from 'viem';
import { wayzStakingAbi } from '../abi/wayz-staking';

// The real event signatures from WAYZStaking.sol (Alpaca-Network/gatewayz-protocol,
// src/WAYZStaking.sol) — pinned here verbatim so a future ABI edit that drops or
// reorders a param (like the missing `newTotalStaked` this test was added to catch)
// fails on selector mismatch instead of silently producing an undecoded log.
const REAL_EVENT_SIGNATURES: Record<string, string> = {
  Staked: 'event Staked(address indexed staker, uint256 amount, uint256 newTotalStaked)',
  UnstakeRequested: 'event UnstakeRequested(address indexed staker, uint256 amount, uint256 unlockAt)',
  UnstakeCancelled: 'event UnstakeCancelled(address indexed staker, uint256 amount)',
  Withdrawn: 'event Withdrawn(address indexed staker, uint256 amount)',
};

describe('wayzStakingAbi event selectors', () => {
  it.each(Object.entries(REAL_EVENT_SIGNATURES))('%s matches the real WAYZStaking.sol signature', (name, signature) => {
    const abiItem = getAbiItem({ abi: wayzStakingAbi, name: name as never });
    expect(toEventSelector(abiItem)).toBe(toEventSelector(signature));
  });
});
