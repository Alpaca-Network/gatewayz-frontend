/**
 * Holdings rewards copy policy, mirroring gatewayz-backend
 * tests/routes/test_holdings.py: this feature is "holdings rewards" and its
 * source must not use the backend's forbidden words, so the product never
 * describes it as something it is not.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..', '..');
const FILES = [
  'src/components/holdings/HoldingsRewardsCard.tsx',
  'src/lib/holdings/rewards-api.ts',
  'src/lib/holdings/status.ts',
  'src/lib/holdings/format.ts',
  'src/lib/hooks/use-holdings-rewards.ts',
];
const FORBIDDEN = ['staking', 'stake', 'yield', 'apy', 'wayz'];

describe('holdings rewards language guard', () => {
  it.each(FILES)('%s avoids every forbidden word', (file) => {
    const source = readFileSync(join(ROOT, file), 'utf8');
    const offenders = FORBIDDEN.filter((word) => new RegExp(`\\b${word}\\w*`, 'i').test(source));
    expect(offenders).toEqual([]);
  });
});
