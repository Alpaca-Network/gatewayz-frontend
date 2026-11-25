// Build flag for the discount credits display (DiscountCreditsCard). Off unless
// the build sets NEXT_PUBLIC_VAULT_DISCOUNT_CREDITS_ENABLED to exactly "true".
// With it on, the card on Settings > Credits still renders only when the
// backend reports the account as enabled (the backend's switch is on and
// applies to this account).
export function isVaultDiscountCreditsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_VAULT_DISCOUNT_CREDITS_ENABLED === 'true';
}
