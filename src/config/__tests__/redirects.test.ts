/**
 * /staking is unlisted on production (reachable, no nav link, noindex) and
 * listed on Vercel preview/development deployments. No redirect hides it.
 * Off Vercel the nav flag fails closed: any production build hides the link.
 */
import { getRedirects, isStakingNavHiddenForBuild } from '../redirects';

describe('staking nav listing', () => {
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

  it('never redirects /staking, even on production', () => {
    process.env.VERCEL_ENV = 'production';
    expect(getRedirects().find((r) => r.source === '/staking')).toBeUndefined();
  });

  it('hides the nav link on a Vercel production deployment', () => {
    expect(isStakingNavHiddenForBuild({ VERCEL_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('lists it on Vercel preview and development deployments', () => {
    setNodeEnv('production');
    process.env.VERCEL_ENV = 'preview';
    expect(isStakingNavHiddenForBuild()).toBe(false);
    process.env.VERCEL_ENV = 'development';
    expect(isStakingNavHiddenForBuild()).toBe(false);
  });

  it('fails closed off Vercel: a production build hides the link', () => {
    setNodeEnv('production');
    expect(isStakingNavHiddenForBuild()).toBe(true);
  });

  it('lists it under next dev off Vercel', () => {
    setNodeEnv('development');
    expect(isStakingNavHiddenForBuild()).toBe(false);
  });

  it('leaves the existing redirects alone', () => {
    expect(getRedirects().some((r) => r.source === '/deck')).toBe(true);
  });
});
