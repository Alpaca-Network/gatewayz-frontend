import { render, screen } from '@testing-library/react';
import { SummaryCards } from '../SummaryCards';
import type { GpuPublicSummary } from '@/lib/gpu/public-api';

const SUMMARY: GpuPublicSummary = {
  active_nodes: 12,
  approved_providers: 5,
  regions: [{ region: 'us-east', nodes: 7 }],
  models: [{ id: 'llama-3.1-8b-instruct', nodes: 3 }],
  last_hour: { requests: 421, tokens: 918234, avg_latency_ms: 812, error_rate: 0.0123 },
  updated_at: '2026-09-03T12:00:00Z',
};

describe('SummaryCards', () => {
  it('shows skeletons while loading', () => {
    const { container } = render(<SummaryCards data={undefined} loading />);
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it('renders the summary values', () => {
    render(<SummaryCards data={SUMMARY} loading={false} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('421')).toBeInTheDocument();
    expect(screen.getByText('918,234')).toBeInTheDocument();
    expect(screen.getByText('812 ms')).toBeInTheDocument();
    expect(screen.getByText('1.23%')).toBeInTheDocument();
  });

  it('shows an em dash for missing data when not loading', () => {
    render(<SummaryCards data={undefined} loading={false} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
