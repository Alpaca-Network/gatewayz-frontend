// Which Cardano network a wallet must be on. Anything but "preprod" is mainnet,
// so production never leaves mainnet unless the backend says so. Preprod exists
// only for testnet demos: tADA from the faucet, no real value.
// 'preprod' and toCardanoNetwork have no caller yet: kept for the vault's testnet phase.
export type CardanoNetwork = 'mainnet' | 'preprod';

export interface CardanoNetworkConfig {
  /** CIP-30 getNetworkId(): 1 on mainnet, 0 on every testnet. */
  walletNetworkId: number;
  /** Key-hash reward address prefix (header 0xe1 on mainnet, 0xe0 on testnets). */
  stakeAddressPrefix: string;
}

const NETWORKS: Record<CardanoNetwork, CardanoNetworkConfig> = {
  mainnet: { walletNetworkId: 1, stakeAddressPrefix: 'stake1u' },
  preprod: { walletNetworkId: 0, stakeAddressPrefix: 'stake_test1u' },
};

export function toCardanoNetwork(value: unknown): CardanoNetwork {
  return value === 'preprod' ? 'preprod' : 'mainnet';
}

export function cardanoNetworkConfig(network: CardanoNetwork = 'mainnet'): CardanoNetworkConfig {
  return NETWORKS[network];
}
