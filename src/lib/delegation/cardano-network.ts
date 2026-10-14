// Which Cardano network the ADA tab talks to. The backend decides
// (GET /delegation/status -> cardano.network); anything but "preprod" is
// mainnet, so production never leaves mainnet unless the backend says so.
// Preprod exists only for testnet demos: tADA from the faucet, no real value.
export type CardanoNetwork = 'mainnet' | 'preprod';

export interface CardanoNetworkConfig {
  /** CIP-30 getNetworkId(): 1 on mainnet, 0 on every testnet. */
  walletNetworkId: number;
  /** Key-hash reward address prefix (header 0xe1 on mainnet, 0xe0 on testnets). */
  stakeAddressPrefix: string;
  koiosBaseUrl: string;
  explorerUrl: string;
}

const NETWORKS: Record<CardanoNetwork, CardanoNetworkConfig> = {
  mainnet: {
    walletNetworkId: 1,
    stakeAddressPrefix: 'stake1u',
    koiosBaseUrl: 'https://api.koios.rest/api/v1',
    explorerUrl: 'https://cardanoscan.io',
  },
  preprod: {
    walletNetworkId: 0,
    stakeAddressPrefix: 'stake_test1u',
    koiosBaseUrl: 'https://preprod.koios.rest/api/v1',
    explorerUrl: 'https://preprod.cardanoscan.io',
  },
};

export function toCardanoNetwork(value: unknown): CardanoNetwork {
  return value === 'preprod' ? 'preprod' : 'mainnet';
}

export function cardanoNetworkConfig(network: CardanoNetwork = 'mainnet'): CardanoNetworkConfig {
  return NETWORKS[network];
}
