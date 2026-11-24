// The one switch for the discount credits display (the balance line in
// Settings -> Credits and InferenceDiscountCard). Off unless the build sets
// NEXT_PUBLIC_VAULT_DISCOUNT_CREDITS_ENABLED to the exact string "true". With
// it on, the account's own `enabled` from the backend still decides whether a
// balance renders.
export function isVaultDiscountCreditsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_VAULT_DISCOUNT_CREDITS_ENABLED === 'true';
}
