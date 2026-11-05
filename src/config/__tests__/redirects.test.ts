/**
 * The retired WAYZ testnet staking dashboard (/staking) redirects to /stake.
 */
import { getRedirects } from '../redirects';

describe('redirects', () => {
  it('sends /staking to /stake', () => {
    const rule = getRedirects().find((r) => r.source === '/staking');
    expect(rule).toMatchObject({ destination: '/stake', permanent: false });
  });

  it('leaves the existing redirects alone', () => {
    expect(getRedirects().some((r) => r.source === '/deck')).toBe(true);
  });
});
