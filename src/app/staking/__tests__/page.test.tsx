/**
 * The staking route must be gated on the same condition as its nav link
 * (shouldShowStaking in src/lib/wayz/addresses.ts). Hiding the link while the
 * route still answered 200 left the page public and indexable — a hidden entry
 * point is not a hidden page. On production builds STAKING_ROUTE_HIDDEN is
 * 'true' and the page stays gated even if the /staking redirect were missing.
 */
jest.mock('next/navigation', () => ({ notFound: jest.fn(() => { throw new Error('NEXT_NOT_FOUND'); }) }));
jest.mock('@/components/staking/StakingPageClient', () => ({
  StakingPageClient: () => null,
}));

const loadPage = async () => {
  jest.resetModules();
  return (await import('../page')).default;
};

const setWayz = (configured: boolean) => {
  process.env.NEXT_PUBLIC_WAYZ_TOKEN_ADDRESS = configured ? '0xToken' : '';
  process.env.NEXT_PUBLIC_WAYZ_STAKING_ADDRESS = configured ? '0xStaking' : '';
};

describe('staking route gate', () => {
  const env = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...env, STAKING_ROUTE_HIDDEN: 'false' };
    delete process.env.NEXT_PUBLIC_WAYZ_STAKING_PREVIEW;
  });
  afterAll(() => { process.env = env; });

  it('404s when WAYZ is not configured and preview is off', async () => {
    setWayz(false);
    const Page = await loadPage();
    expect(() => Page()).toThrow('NEXT_NOT_FOUND');
  });

  it('renders when WAYZ is configured', async () => {
    setWayz(true);
    const Page = await loadPage();
    expect(() => Page()).not.toThrow();
  });

  it('renders when the preview flag is set even without addresses', async () => {
    setWayz(false);
    process.env.NEXT_PUBLIC_WAYZ_STAKING_PREVIEW = 'true';
    const Page = await loadPage();
    expect(() => Page()).not.toThrow();
  });

  it('404s on a production build even when WAYZ is configured and previewed', async () => {
    setWayz(true);
    process.env.NEXT_PUBLIC_WAYZ_STAKING_PREVIEW = 'true';
    process.env.STAKING_ROUTE_HIDDEN = 'true';
    const Page = await loadPage();
    expect(() => Page()).toThrow('NEXT_NOT_FOUND');
  });

  it('fails closed when the build flag was never inlined', async () => {
    setWayz(true);
    delete process.env.STAKING_ROUTE_HIDDEN;
    const Page = await loadPage();
    expect(() => Page()).toThrow('NEXT_NOT_FOUND');
  });
});
