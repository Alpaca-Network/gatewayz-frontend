import { parseWayzAmount } from '../amount';

describe('parseWayzAmount', () => {
  it('accepts a normal decimal amount', () => {
    expect(parseWayzAmount('1.5')).toBe(15n * 10n ** 17n);
  });

  it('accepts a whole number amount', () => {
    expect(parseWayzAmount('100')).toBe(100n * 10n ** 18n);
  });

  it('accepts exactly 18 fractional digits', () => {
    expect(parseWayzAmount('1.123456789012345678')).toBe(1123456789012345678n);
  });

  it('rejects more than 18 fractional digits instead of silently rounding', () => {
    // viem's parseUnits itself does NOT throw for this input — it rounds to
    // 1123456789012345679n. parseWayzAmount must reject it before that happens.
    expect(parseWayzAmount('1.0000000000000000001')).toBeNull();
    expect(parseWayzAmount('1.1234567890123456789')).toBeNull();
  });

  it('rejects zero', () => {
    expect(parseWayzAmount('0')).toBeNull();
    expect(parseWayzAmount('0.0')).toBeNull();
  });

  it('rejects empty, whitespace-only, and non-numeric input', () => {
    expect(parseWayzAmount('')).toBeNull();
    expect(parseWayzAmount('   ')).toBeNull();
    expect(parseWayzAmount('abc')).toBeNull();
    expect(parseWayzAmount('1.')).toBeNull();
    expect(parseWayzAmount('.5')).toBeNull();
  });

  it('rejects negative amounts', () => {
    expect(parseWayzAmount('-1')).toBeNull();
  });
});
