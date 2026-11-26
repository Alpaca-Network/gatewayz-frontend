import { render, screen } from '@testing-library/react';
import { EmissionStrip } from '../EmissionStrip';
import { getGpuPublicSummary, type GpuPublicEmission } from '@/lib/gpu/public-api';
import { createSuccessResponse, setupFetchMock } from '@/__tests__/utils/mock-fetch';

const EMISSION: GpuPublicEmission = {
  daily_emission_wayz: 100000,
  providers_bps: 8200,
  treasury_bps: 1800,
  last_epoch: '2026-09-12',
};

const SUMMARY_BASE = {
  active_nodes: 3,
  approved_providers: 2,
  regions: [],
  models: [],
  last_hour: { requests: 0, tokens: 0, avg_latency_ms: 0, error_rate: 0 },
  updated_at: '2026-09-13T00:00:00+00:00',
};

// The two wire shapes of `emission` on GET /gpu/public/summary: the older one carries a
// third share, the newer one does not.
const WIRE_SHAPES = {
  old: { mode: 'emission', daily_emission_wayz: '100000', providers_bps: 4100, stakers_bps: 4100, treasury_bps: 1800, last_epoch: '2026-09-12' },
  new: { mode: 'emission', daily_emission_wayz: '100000', providers_bps: 8200, treasury_bps: 1800, last_epoch: '2026-09-12' },
};

async function parseWireEmission(emission: Record<string, unknown>) {
  const mockFetch = setupFetchMock();
  mockFetch.mockResolvedValueOnce(createSuccessResponse({ ...SUMMARY_BASE, emission }));
  return (await getGpuPublicSummary()).emission;
}

describe('EmissionStrip', () => {
  it('shows skeletons while loading', () => {
    const { container } = render(<EmissionStrip emission={undefined} loading />);
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it('renders nothing when emission is absent and not loading (per_unit mode)', () => {
    const { container } = render(<EmissionStrip emission={undefined} loading={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the daily emission, the providers and treasury shares, and the last epoch date', () => {
    render(<EmissionStrip emission={EMISSION} loading={false} />);
    expect(screen.getByText('100000.0000 WAYZ')).toBeInTheDocument();
    expect(screen.getByText('82.00%')).toBeInTheDocument();
    expect(screen.getByText('18.00%')).toBeInTheDocument();
    expect(screen.getByText('Providers')).toBeInTheDocument();
    expect(screen.getByText('Treasury')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
    expect(screen.getByText(/last epoch: /i)).toBeInTheDocument();
  });

  it.each(['old', 'new'] as const)('renders no text matching /staker/i for a %s-shape response', async (shape) => {
    const emission = await parseWireEmission(WIRE_SHAPES[shape]);
    const { container } = render(<EmissionStrip emission={emission} loading={false} />);
    expect(container).not.toBeEmptyDOMElement();
    expect(screen.queryByText(/staker/i)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/staker/i);
    expect(container.innerHTML).not.toMatch(/staker/i);
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
  });

  it('shows the providers and treasury shares as sent for an old-shape response, with no total', async () => {
    const emission = await parseWireEmission(WIRE_SHAPES.old);
    const { container } = render(<EmissionStrip emission={emission} loading={false} />);
    expect(screen.getByText('100000.0000 WAYZ')).toBeInTheDocument();
    expect(screen.getAllByText(/%$/).map((el) => el.textContent)).toEqual(['41.00%', '18.00%']);
    expect(container.textContent).not.toMatch(/total|100(\.00)?%|59(\.00)?%/i);
    expect(container.textContent).not.toMatch(/unavailable|NaN|undefined/i);
  });

  it('omits the last-epoch line when null', () => {
    render(<EmissionStrip emission={{ ...EMISSION, last_epoch: null }} loading={false} />);
    expect(screen.queryByText(/last epoch/i)).not.toBeInTheDocument();
  });
});
