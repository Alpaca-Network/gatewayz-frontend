/**
 * /staking must be unreachable while WAYZ is unconfigured.
 *
 * The page calls notFound(), but as a statically generated route it serves the
 * not-found body with HTTP 200 — a soft 404 crawlers read as a live page. A
 * redirect is evaluated before rendering, so it yields a real 3xx regardless.
 */
import { getRedirects } from '../redirects';

const withEnv = (token?: string, staking?: string) => {
  process.env.NEXT_PUBLIC_WAYZ_TOKEN_ADDRESS = token ?? '';
  process.env.NEXT_PUBLIC_WAYZ_STAKING_ADDRESS = staking ?? '';
  return getRedirects();
};

describe('staking redirect', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });

  it('redirects /staking away when WAYZ is unconfigured', () => {
    const staking = withEnv().find((r) => r.source === '/staking');
    expect(staking).toBeDefined();
    expect(staking?.destination).toBe('/');
    expect(staking?.permanent).toBe(false);
  });

  it('leaves /staking reachable once both addresses are set', () => {
    const rules = withEnv('0xToken', '0xStaking');
    expect(rules.find((r) => r.source === '/staking')).toBeUndefined();
  });

  it('treats a half-configured pair as unconfigured', () => {
    expect(withEnv('0xToken', '').find((r) => r.source === '/staking')).toBeDefined();
  });

  it('does not disturb the existing redirects', () => {
    expect(withEnv().some((r) => r.source === '/deck')).toBe(true);
  });
});
