// Parses a user-typed WAYZ amount into wei, shared by StakeForm and
// UnstakeCard so both reject the same inputs the same way.
import { parseUnits } from 'viem';

// Digits, optionally a dot followed by 1-18 fractional digits — matches what
// parseUnits(_, 18) can represent exactly. No sign, no scientific notation,
// no thousands separators.
const WHOLE_WAYZ_INPUT_RE = /^\d+(\.\d{1,18})?$/;

/**
 * Parses a user-typed WAYZ amount string into wei (bigint), or `null` if the
 * input isn't a valid positive amount.
 *
 * viem's `parseUnits` does NOT throw for more than 18 fractional digits —
 * it silently rounds (verified against the installed viem@2.44.2:
 * `parseUnits('1.1234567890123456789', 18)` resolves rather than throwing).
 * Validating the shape here first means an over-precise paste is rejected
 * with the usual "enter a valid amount" copy instead of silently rounded.
 */
export function parseWayzAmount(input: string): bigint | null {
  const trimmed = input.trim();
  if (!WHOLE_WAYZ_INPUT_RE.test(trimmed)) {
    return null;
  }

  const parsed = parseUnits(trimmed, 18);
  return parsed > BigInt(0) ? parsed : null;
}
