/**
 * Inference discount copy policy (v3): the discount is a share of staking
 * rewards Gatewayz received, given back as inference. It is not a rate of
 * return, so its source never uses these words. The API disclaimer is shown
 * verbatim and is not checked here.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..', '..');
const FILES = [
  'src/components/delegation/discount-copy.ts',
  'src/components/delegation/InferenceDiscountCard.tsx',
  'src/components/delegation/InferenceDiscountBalanceLine.tsx',
  'src/lib/delegation/discount-format.ts',
];
const FORBIDDEN = [/\bapy\b/i, /\bapr\b/i, /\binterest/i, /\byield/i, /return on your stake/i, /guarantee/i];

describe('inference discount language guard', () => {
  it.each(FILES)('%s avoids every forbidden word', (file) => {
    const source = readFileSync(join(ROOT, file), 'utf8');
    const offenders = FORBIDDEN.filter((pattern) => pattern.test(source)).map(String);
    expect(offenders).toEqual([]);
  });
});
