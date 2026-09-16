/**
 * The staking route must be gated on the same condition as its nav link.
 * Hiding the link while the route still answered 200 left the page public
 * and indexable — a hidden entry point is not a hidden page.
 */
jest.mock('next/navigation', () => ({ notFound: jest.fn(() => { throw new Error('NEXT_NOT_FOUND'); }) }));
jest.mock('@/components/staking/StakingPageClient', () => ({
  StakingPageClient: () => null,
}));

const loadPage = async () => {
  jest.resetModules();
  return (await import('../page')).default;
};

describe('staking route gate', () => {
  const env = process.env;
  beforeEach(() => { jest.resetModules(); process.env = { ...env }; });
  afterAll(() => { process.env = env; });

  it('404s when WAYZ is not configured and preview is off', async () => {
    jest.doMock('@/lib/wayz/addresses', () => ({ isWayzConfigured: () => false }));
    delete process.env.NEXT_PUBLIC_WAYZ_STAKING_PREVIEW;
    const Page = await loadPage();
    expect(() => Page()).toThrow('NEXT_NOT_FOUND');
  });

  it('renders when WAYZ is configured', async () => {
    jest.doMock('@/lib/wayz/addresses', () => ({ isWayzConfigured: () => true }));
    delete process.env.NEXT_PUBLIC_WAYZ_STAKING_PREVIEW;
    const Page = await loadPage();
    expect(() => Page()).not.toThrow();
  });

  it('renders when the preview flag is set even without addresses', async () => {
    jest.doMock('@/lib/wayz/addresses', () => ({ isWayzConfigured: () => false }));
    process.env.NEXT_PUBLIC_WAYZ_STAKING_PREVIEW = 'true';
    const Page = await loadPage();
    expect(() => Page()).not.toThrow();
  });
});
