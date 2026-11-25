/**
 * Discount credits copy policy. The product name is "discount credits": its
 * source never calls it anything else, and never uses words that would
 * describe it as a rate of return. The API disclaimer is shown verbatim and
 * is not checked here.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..', '..');
const FILES = [
  'src/components/discount-credits/discount-copy.ts',
  'src/components/discount-credits/DiscountCreditsCard.tsx',
  'src/lib/discount-credits/format.ts',
];
const FORBIDDEN = [
  /\bapy\b/i,
  /\bapr\b/i,
  /\binterest/i,
  /\byield/i,
  /return on your stake/i,
  /guarantee/i,
  /inference credits/i,
  /free inference/i,
  /\brewards?\b/i,
];

describe('discount credits language guard', () => {
  it.each(FILES)('%s avoids every forbidden word', (file) => {
    const source = readFileSync(join(ROOT, file), 'utf8');
    const offenders = FORBIDDEN.filter((pattern) => pattern.test(source)).map(String);
    expect(offenders).toEqual([]);
  });
});
