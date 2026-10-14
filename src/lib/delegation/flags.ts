// Two locks keep this feature dark: the build flag, and the backend saying it is
// on with somewhere to stake. Each asset tab also needs its own target (a vault
// address for ETH, a pool id for ADA) before it renders.
import type { DelegationStatus } from './api';

/** Build-time flag. Anything other than the exact string "true" is off. */
export function isDelegationFlagOn(): boolean {
  return process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED === 'true';
}

export function isEthVaultLive(status: DelegationStatus | undefined): boolean {
  return !!status?.enabled && !!status.eth.vault_address && status.eth.chain_id === 1;
}

export function isCardanoPoolLive(status: DelegationStatus | undefined): boolean {
  return !!status?.enabled && !!status.cardano.pool_id;
}

/** Show the section only when the flag is on and at least one asset has a target. */
export function isDelegationLive(status: DelegationStatus | undefined): boolean {
  return isDelegationFlagOn() && (isEthVaultLive(status) || isCardanoPoolLive(status));
}

/** v3: rewards come back as an inference discount, not as allowance credits. */
export function isRewardShareModel(status: DelegationStatus | undefined): boolean {
  return status?.payout_model === 'reward_share';
}

/**
 * The inference discount needs the build flag, the backend on, and its own
 * discount switch. The account's `discount.enabled` from /delegation/rewards
 * is checked again where the balance renders.
 */
export function isDiscountLive(status: DelegationStatus | undefined, flagOn = isDelegationFlagOn()): boolean {
  return flagOn && !!status?.enabled && status.discount_enabled === true;
}
