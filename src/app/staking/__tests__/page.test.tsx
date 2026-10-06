/**
 * The /staking page is gated on WAYZ being configured or previewed, on every
 * build. On production it is unlisted (no header link, noindex) but reachable,
 * so the build-level STAKING_NAV_HIDDEN flag must NOT 404 the page.
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
    process.env = { ...env };
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

  it('renders on a production build (unlisted, not hidden)', async () => {
    setWayz(true);
    process.env.STAKING_NAV_HIDDEN = 'true';
    const Page = await loadPage();
    expect(() => Page()).not.toThrow();
  });
});
