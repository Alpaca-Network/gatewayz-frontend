/**
 * /staking must be unreachable while WAYZ is out of the product.
 *
 * Three earlier attempts failed. notFound() on a statically generated route
 * serves the not-found body with HTTP 200 (a soft 404 crawlers read as live),
 * force-dynamic did not change that, and a redirect gated on the contract
 * addresses emitted no rule at all — next.config.ts evaluates these at BUILD
 * time while the page gate evaluates at REQUEST time, and the two disagreed.
 * Unconditional is the version that works, matching the /deck rule beside it.
 */
import { getRedirects } from '../redirects';

describe('staking redirect', () => {
  it('redirects /staking regardless of environment', () => {
    const staking = getRedirects().find((r) => r.source === '/staking');
    expect(staking).toBeDefined();
    expect(staking?.destination).toBe('/');
    expect(staking?.permanent).toBe(false);
  });

  it('is not conditional on the WAYZ addresses', () => {
    process.env.NEXT_PUBLIC_WAYZ_TOKEN_ADDRESS = '0xToken';
    process.env.NEXT_PUBLIC_WAYZ_STAKING_ADDRESS = '0xStaking';
    expect(getRedirects().find((r) => r.source === '/staking')).toBeDefined();
  });

  it('leaves the existing redirects alone', () => {
    expect(getRedirects().some((r) => r.source === '/deck')).toBe(true);
  });
});
