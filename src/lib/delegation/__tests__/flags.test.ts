import { isCardanoPoolLive, isDelegationFlagOn, isDelegationLive, isEthVaultLive } from '../flags';
import type { DelegationStatus } from '../api';

const status = (over: Partial<DelegationStatus> = {}): DelegationStatus => ({
  enabled: true,
  eth: { vault_address: '0x1111111111111111111111111111111111111111', chain_id: 1, fee_percent: 5 },
  cardano: { pool_id: 'pool1abc' },
  allowance_rates: [],
  disclaimer: '',
  ...over,
});

describe('delegation flags', () => {
  const original = process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED;
  afterEach(() => {
    process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED = original;
  });

  it('is off unless the build flag is exactly "true"', () => {
    for (const value of [undefined, '', 'false', 'TRUE', '1']) {
      if (value === undefined) delete process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED;
      else process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED = value;
      expect(isDelegationFlagOn()).toBe(false);
      expect(isDelegationLive(status())).toBe(false);
    }
  });

  it('needs the backend enabled and at least one target', () => {
    process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED = 'true';
    expect(isDelegationLive(status())).toBe(true);
    expect(isDelegationLive(undefined)).toBe(false);
    expect(isDelegationLive(status({ enabled: false }))).toBe(false);
    expect(
      isDelegationLive(
        status({ eth: { vault_address: null, chain_id: 1, fee_percent: null }, cardano: { pool_id: null } }),
      ),
    ).toBe(false);
  });

  it('gates each asset on its own target, and ETH on mainnet', () => {
    expect(isEthVaultLive(status({ eth: { vault_address: null, chain_id: 1, fee_percent: null } }))).toBe(false);
    expect(isEthVaultLive(status({ eth: { vault_address: '0x1', chain_id: 17000, fee_percent: null } }))).toBe(false);
    expect(isCardanoPoolLive(status({ cardano: { pool_id: null } }))).toBe(false);
    expect(isCardanoPoolLive(status())).toBe(true);
  });
});
