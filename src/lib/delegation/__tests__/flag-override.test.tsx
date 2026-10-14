import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DelegationFlagOverrideProvider, useDelegationFlagOn } from '../flag-override';
import { isDiscountLive } from '../flags';

describe('delegation flag override', () => {
  const original = process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED;
  afterEach(() => {
    process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED = original;
  });

  it('is off outside the provider while the build flag is off', () => {
    delete process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED;
    const { result } = renderHook(() => useDelegationFlagOn());
    expect(result.current).toBe(false);
  });

  it('is on inside the provider even with the build flag off', () => {
    delete process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DelegationFlagOverrideProvider>{children}</DelegationFlagOverrideProvider>
    );
    const { result } = renderHook(() => useDelegationFlagOn(), { wrapper });
    expect(result.current).toBe(true);
  });

  it('follows the build flag outside the provider', () => {
    process.env.NEXT_PUBLIC_DELEGATED_STAKING_ENABLED = 'true';
    const { result } = renderHook(() => useDelegationFlagOn());
    expect(result.current).toBe(true);
  });

  it('isDiscountLive still requires the backend switches when the flag is forced on', () => {
    expect(isDiscountLive(undefined, true)).toBe(false);
    expect(isDiscountLive({ enabled: true, discount_enabled: false } as never, true)).toBe(false);
    expect(isDiscountLive({ enabled: true, discount_enabled: true } as never, true)).toBe(true);
    expect(isDiscountLive({ enabled: true, discount_enabled: true } as never, false)).toBe(false);
  });
});
