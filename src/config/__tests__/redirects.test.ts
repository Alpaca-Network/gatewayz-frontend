/**
 * /staking must be unreachable on production while WAYZ is out of the product,
 * and reachable on Vercel preview deployments so the flow can be tested there.
 *
 * Earlier attempts: notFound() on a statically generated route served the
 * not-found body with HTTP 200 (#1023/#1024), and a redirect gated on the WAYZ
 * contract addresses emitted no rule (#1025) because those addresses are set in
 * the Production environment. VERCEL_ENV is a Vercel system variable available
 * at build time, which is when next.config.ts evaluates redirects(), so gating
 * on it is sound. Off Vercel it fails closed: any production build hides it.
 */
import { getRedirects, isStakingHiddenForBuild } from '../redirects';

describe('staking redirect', () => {
  const env = process.env;
  beforeEach(() => {
    process.env = { ...env };
    delete process.env.VERCEL_ENV;
  });
  afterAll(() => {
    process.env = env;
  });

  const setNodeEnv = (value: string) => {
    (process.env as Record<string, string>).NODE_ENV = value;
  };
  const stakingRule = () => getRedirects().find((r) => r.source === '/staking');

  it('redirects /staking on a Vercel production deployment', () => {
    process.env.VERCEL_ENV = 'production';
    const staking = stakingRule();
    expect(staking).toBeDefined();
    expect(staking?.destination).toBe('/');
    expect(staking?.permanent).toBe(false);
  });

  it('still redirects on production even when the WAYZ addresses are set', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.NEXT_PUBLIC_WAYZ_TOKEN_ADDRESS = '0xToken';
    process.env.NEXT_PUBLIC_WAYZ_STAKING_ADDRESS = '0xStaking';
    process.env.NEXT_PUBLIC_WAYZ_STAKING_PREVIEW = 'true';
    expect(stakingRule()).toBeDefined();
  });

  it('does not redirect on a Vercel preview deployment', () => {
    process.env.VERCEL_ENV = 'preview';
    setNodeEnv('production');
    expect(stakingRule()).toBeUndefined();
  });

  it('does not redirect on a Vercel development deployment', () => {
    process.env.VERCEL_ENV = 'development';
    expect(stakingRule()).toBeUndefined();
  });

  it('fails closed off Vercel: a production build hides staking', () => {
    setNodeEnv('production');
    expect(isStakingHiddenForBuild()).toBe(true);
    expect(stakingRule()).toBeDefined();
  });

  it('leaves staking reachable under next dev off Vercel', () => {
    setNodeEnv('development');
    expect(isStakingHiddenForBuild()).toBe(false);
    expect(stakingRule()).toBeUndefined();
  });

  it('leaves the existing redirects alone', () => {
    process.env.VERCEL_ENV = 'preview';
    expect(getRedirects().some((r) => r.source === '/deck')).toBe(true);
  });
});
