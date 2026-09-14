import { render, screen } from '@testing-library/react';
import { EmissionStrip } from '../EmissionStrip';
import type { GpuPublicEmission } from '@/lib/gpu/public-api';

const EMISSION: GpuPublicEmission = {
  daily_emission_wayz: 100000,
  providers_bps: 4100,
  stakers_bps: 4100,
  treasury_bps: 1800,
  last_epoch: '2026-09-12',
};

describe('EmissionStrip', () => {
  it('shows skeletons while loading', () => {
    const { container } = render(<EmissionStrip emission={undefined} loading />);
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it('renders nothing when emission is absent and not loading (per_unit mode)', () => {
    const { container } = render(<EmissionStrip emission={undefined} loading={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the daily emission, the 41/41/18 split, and the last epoch date', () => {
    render(<EmissionStrip emission={EMISSION} loading={false} />);
    expect(screen.getByText('100000.0000 WAYZ')).toBeInTheDocument();
    expect(screen.getAllByText('41.00%')).toHaveLength(2);
    expect(screen.getByText('18.00%')).toBeInTheDocument();
    expect(screen.getByText('Providers')).toBeInTheDocument();
    expect(screen.getByText('Stakers')).toBeInTheDocument();
    expect(screen.getByText('Treasury')).toBeInTheDocument();
    expect(screen.getByText(/last epoch: /i)).toBeInTheDocument();
  });

  it('omits the last-epoch line when null', () => {
    render(<EmissionStrip emission={{ ...EMISSION, last_epoch: null }} loading={false} />);
    expect(screen.queryByText(/last epoch/i)).not.toBeInTheDocument();
  });
});
