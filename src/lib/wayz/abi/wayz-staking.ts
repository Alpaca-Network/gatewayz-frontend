// WAYZStaking ABI — hand-written, human-readable form (viem `parseAbi`).
// Only the functions/errors/events this dashboard calls or decodes.
// Full contract: `WAYZStaking` in Alpaca-Network/gatewayz-protocol.
//
// `pendingUnstake` returns the `UnstakeRequest` struct as a tuple
// `(uint256 amount, uint256 unlockAt)` — field order verified against the
// brief (Workstream B, gatewayz-backend#2246): amount first, unlockAt second.
import { parseAbi } from 'viem';

export const wayzStakingAbi = parseAbi([
  'function stakedBalanceOf(address account) view returns (uint256)',
  'function pendingUnstake(address account) view returns (uint256 amount, uint256 unlockAt)',
  'function totalStaked() view returns (uint256)',
  'function UNSTAKE_COOLDOWN() view returns (uint256)',
  'function paused() view returns (bool)',
  'function stake(uint256 amount)',
  'function requestUnstake(uint256 amount)',
  'function cancelUnstake()',
  'function withdraw()',

  'error ZeroAmount()',
  'error InsufficientStake(uint256 requested, uint256 available)',
  'error PendingUnstakeExists()',
  'error NoPendingUnstake()',
  'error StillCoolingDown(uint256 unlockAt)',
  'error ZeroAddress()',

  'event Staked(address indexed staker, uint256 amount, uint256 newTotalStaked)',
  'event UnstakeRequested(address indexed staker, uint256 amount, uint256 unlockAt)',
  'event UnstakeCancelled(address indexed staker, uint256 amount)',
  'event Withdrawn(address indexed staker, uint256 amount)',
]);
