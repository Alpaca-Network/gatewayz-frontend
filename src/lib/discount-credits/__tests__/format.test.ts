import { formatDiscountUsd, formatSharePercent, payShareOfList } from '../format';

describe('discount credits formatting', () => {
  it('keeps sub-cent amounts instead of rounding them to $0.00', () => {
    expect(formatDiscountUsd(12.345678)).toBe('$12.35');
    expect(formatDiscountUsd(0)).toBe('$0.00');
    expect(formatDiscountUsd(0.000123)).toBe('$0.000123');
    expect(formatDiscountUsd(Number.NaN)).toBe('$0.00');
  });

  it('formats fractions as percents without floating noise', () => {
    expect(formatSharePercent(0.95)).toBe('95%');
    expect(formatSharePercent(1 - 0.99)).toBe('1%');
    expect(formatSharePercent(0.955)).toBe('95.5%');
  });

  it('is the share of the list price still paid, or null', () => {
    expect(payShareOfList(0.99)).toBeCloseTo(0.01);
    expect(payShareOfList(0)).toBe(1);
    expect(payShareOfList(null)).toBeNull();
    expect(payShareOfList(undefined)).toBeNull();
    expect(payShareOfList(1.5)).toBeNull();
    expect(payShareOfList(Number.NaN)).toBeNull();
  });
});
