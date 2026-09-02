// WAYZToken ABI — hand-written, human-readable form (viem `parseAbi`).
// Only the functions this dashboard calls: ERC20 balance/allowance/approve.
// Full contract: `WAYZToken` (ERC20 + ERC20Permit, 18 decimals, symbol WAYZ)
// in Alpaca-Network/gatewayz-protocol.
import { parseAbi } from 'viem';

export const wayzTokenAbi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);
