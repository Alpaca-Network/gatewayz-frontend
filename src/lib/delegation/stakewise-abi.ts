// The slice of the StakeWise V3 EthVault ABI this panel calls. Verified against
// stakewise/v3-core @ fc70cbe (v5.0.1, 2026-06-25):
//   contracts/interfaces/IVaultEthStaking.sol  deposit
//   contracts/interfaces/IVaultEnterExit.sol   enterExitQueue, getExitQueueIndex,
//                                              calculateExitedAssets, claimExitedAssets, events
//   contracts/interfaces/IVaultState.sol       getShares, convertToAssets/Shares,
//                                              isStateUpdateRequired, capacity, totalAssets
// Selectors are unchanged since vault v1, so this also drives older deployed vaults.
//
// Exit flow: enterExitQueue(shares, receiver) records the request under
// (receiver, block.timestamp, positionTicket); positionTicket comes from the
// ExitQueueEntered event. Once processed, getExitQueueIndex(positionTicket) is
// >= 0, calculateExitedAssets reports what is claimable, and claimExitedAssets
// pays it out after the vault's claim delay. A partial claim re-files the
// remainder under the newPositionTicket in ExitedAssetsClaimed.
export const ETH_VAULT_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'referrer', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'enterExitQueue',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ name: 'positionTicket', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getExitQueueIndex',
    stateMutability: 'view',
    inputs: [{ name: 'positionTicket', type: 'uint256' }],
    outputs: [{ name: '', type: 'int256' }],
  },
  {
    type: 'function',
    name: 'calculateExitedAssets',
    stateMutability: 'view',
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'positionTicket', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'exitQueueIndex', type: 'uint256' },
    ],
    outputs: [
      { name: 'leftTickets', type: 'uint256' },
      { name: 'exitedTickets', type: 'uint256' },
      { name: 'exitedAssets', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'claimExitedAssets',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'positionTicket', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'exitQueueIndex', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getShares',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'convertToAssets',
    stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ name: 'assets', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'convertToShares',
    stateMutability: 'view',
    inputs: [{ name: 'assets', type: 'uint256' }],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'isStateUpdateRequired',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'capacity',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalAssets',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'ExitQueueEntered',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'receiver', type: 'address', indexed: true },
      { name: 'positionTicket', type: 'uint256', indexed: false },
      { name: 'shares', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'V2ExitQueueEntered',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'receiver', type: 'address', indexed: true },
      { name: 'positionTicket', type: 'uint256', indexed: false },
      { name: 'shares', type: 'uint256', indexed: false },
      { name: 'assets', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ExitedAssetsClaimed',
    inputs: [
      { name: 'receiver', type: 'address', indexed: true },
      { name: 'prevPositionTicket', type: 'uint256', indexed: false },
      { name: 'newPositionTicket', type: 'uint256', indexed: false },
      { name: 'withdrawnAssets', type: 'uint256', indexed: false },
    ],
  },
] as const;

/**
 * Minimum wait between entering the queue and claiming, for StakeWise's
 * Ethereum vaults (v3-core test/helpers/EthHelpers.sol: 15 hours). Only used
 * to label a request; every claim is simulated first, so a different on-chain
 * delay shows up as "not ready yet" rather than a failed transaction.
 */
export const ETH_EXIT_CLAIM_DELAY_SECONDS = 15 * 60 * 60;

/**
 * No StakeWise V3 vault predates this mainnet block (V3 launched late 2023), so
 * scanning exit events from here sees every request the vault ever recorded.
 */
export const STAKEWISE_V3_FIRST_BLOCK = BigInt(18_000_000);
