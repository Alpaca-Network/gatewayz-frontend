// Tokens counted for holdings rewards, by chain, for display on /rewards.
//
// The backend's ops-controlled `holdings_tokens` registry is the source of
// truth for what is valued (gatewayz-backend docs/holdings/REWARDS.md), but it
// is only readable through the admin API, so the public page shows this static
// mirror of it. Keep it in step with the registry when ops adds or disables a
// token; a token listed here that the registry does not value is simply not
// counted.

export interface HoldingsChain {
  /** EVM chain id. */
  chainId: number;
  name: string;
  /** Native asset first, then ERC-20s. */
  tokens: string[];
}

export const HOLDINGS_SUPPORTED_CHAINS: HoldingsChain[] = [
  {
    chainId: 1,
    name: 'Ethereum',
    tokens: ['ETH', 'USDT', 'USDC', 'WBTC', 'LINK', 'UNI', 'DAI', 'SHIB', 'stETH', 'wstETH', 'rETH', 'cbETH'],
  },
  {
    chainId: 8453,
    name: 'Base',
    tokens: ['ETH', 'USDC', 'WBTC', 'LINK', 'wstETH', 'rETH', 'cbETH'],
  },
  {
    chainId: 42161,
    name: 'Arbitrum',
    tokens: ['ETH', 'USDC', 'LINK', 'UNI', 'wstETH', 'rETH', 'cbETH'],
  },
  {
    chainId: 43114,
    name: 'Avalanche C-Chain',
    tokens: ['AVAX', 'USDT', 'USDC', 'WBTC', 'LINK', 'UNI'],
  },
  {
    chainId: 56,
    name: 'BNB Chain',
    tokens: ['BNB', 'WBTC', 'LINK', 'UNI'],
  },
  {
    chainId: 137,
    name: 'Polygon',
    tokens: ['POL', 'USDC', 'LINK', 'UNI'],
  },
];
