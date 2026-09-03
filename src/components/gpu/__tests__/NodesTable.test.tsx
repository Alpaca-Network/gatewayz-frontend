import { render, screen } from '@testing-library/react';
import { NodesTable } from '../NodesTable';
import type { GpuPublicNode } from '@/lib/gpu/public-api';

const NODES: GpuPublicNode[] = [
  {
    name: 'gpu-node-01',
    region: 'us-east',
    gpu_model: 'RTX 4090',
    vram_gb: 24,
    status: 'active',
    uptime_24h_pct: 99.2,
    models: ['llama-3.1-8b-instruct'],
  },
];

describe('NodesTable', () => {
  it('shows an empty state with no nodes', () => {
    render(<NodesTable nodes={[]} loading={false} />);
    expect(screen.getByText(/no community nodes online yet/i)).toBeInTheDocument();
  });

  it('renders a row per node, never a wallet/endpoint/provider field', () => {
    render(<NodesTable nodes={NODES} loading={false} />);
    expect(screen.getByText('gpu-node-01')).toBeInTheDocument();
    expect(screen.getByText('RTX 4090')).toBeInTheDocument();
    expect(screen.getByText('24 GB')).toBeInTheDocument();
    expect(screen.getByText('99.2%')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText(/0x[a-f0-9]+/i)).not.toBeInTheDocument();
  });
});
