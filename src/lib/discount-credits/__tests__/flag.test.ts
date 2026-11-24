import { isVaultDiscountCreditsEnabled } from '../flag';

describe('isVaultDiscountCreditsEnabled', () => {
  const original = process.env.NEXT_PUBLIC_VAULT_DISCOUNT_CREDITS_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_VAULT_DISCOUNT_CREDITS_ENABLED;
    else process.env.NEXT_PUBLIC_VAULT_DISCOUNT_CREDITS_ENABLED = original;
  });

  it('is off when unset', () => {
    delete process.env.NEXT_PUBLIC_VAULT_DISCOUNT_CREDITS_ENABLED;
    expect(isVaultDiscountCreditsEnabled()).toBe(false);
  });

  it.each(['false', '1', 'TRUE', 'yes', ''])('is off for %p', (value) => {
    process.env.NEXT_PUBLIC_VAULT_DISCOUNT_CREDITS_ENABLED = value;
    expect(isVaultDiscountCreditsEnabled()).toBe(false);
  });

  it('is on only for the exact string "true"', () => {
    process.env.NEXT_PUBLIC_VAULT_DISCOUNT_CREDITS_ENABLED = 'true';
    expect(isVaultDiscountCreditsEnabled()).toBe(true);
  });
});
