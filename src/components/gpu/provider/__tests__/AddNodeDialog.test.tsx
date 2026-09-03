import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddNodeDialog } from '../AddNodeDialog';
import { useCreateGpuNode } from '@/lib/hooks/use-gpu-provider';

jest.mock('@/lib/hooks/use-gpu-provider', () => ({
  useCreateGpuNode: jest.fn(),
}));
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

// Overrides jest.setup.js's global lucide-react mock (Coins/Crown/Menu/Copy only) — the shadcn
// Dialog's built-in close button renders an `X` icon, which that global mock doesn't cover.
jest.mock('lucide-react', () => ({
  X: () => 'X',
}));

const mockUseCreateGpuNode = useCreateGpuNode as jest.Mock;

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'gpu-node-01' } });
  fireEvent.change(screen.getByLabelText(/^region$/i), { target: { value: 'us-east' } });
  fireEvent.change(screen.getByLabelText(/gpu model/i), { target: { value: 'RTX 4090' } });
  fireEvent.change(screen.getByLabelText(/vram/i), { target: { value: '24' } });
  fireEvent.change(screen.getByLabelText(/bandwidth/i), { target: { value: '1000' } });
  fireEvent.change(screen.getByLabelText(/endpoint url/i), { target: { value: 'https://node.example.com' } });
  fireEvent.change(screen.getByLabelText(/endpoint api key/i), { target: { value: 'sk-node' } });
  fireEvent.change(screen.getByLabelText(/^models$/i), { target: { value: 'llama-3.1-8b-instruct:8192' } });
}

describe('AddNodeDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
  });

  it('keeps submit disabled until every required field is valid', () => {
    mockUseCreateGpuNode.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    render(<AddNodeDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Add node' }));

    expect(screen.getByRole('button', { name: /^register node$/i, hidden: false })).toBeDisabled();
    fillValidForm();
    expect(screen.getByRole('button', { name: /^register node$/i })).not.toBeDisabled();
  });

  it('flags a non-https endpoint URL', () => {
    mockUseCreateGpuNode.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    render(<AddNodeDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Add node' }));

    fireEvent.change(screen.getByLabelText(/endpoint url/i), { target: { value: 'http://node.example.com' } });
    expect(screen.getByText(/must be an https url/i)).toBeInTheDocument();
  });

  it('shows the token exactly once after a successful submit, with a copy button', async () => {
    const mutateAsync = jest.fn().mockResolvedValue({
      node: { id: 5, status: 'registered' },
      node_token: 'gw_node_abc123',
    });
    mockUseCreateGpuNode.mockReturnValue({ mutateAsync, isPending: false });

    render(<AddNodeDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Add node' }));
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /^register node$/i }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        name: 'gpu-node-01',
        region: 'us-east',
        gpu_model: 'RTX 4090',
        vram_gb: 24,
        bandwidth_mbps: 1000,
        endpoint_url: 'https://node.example.com',
        endpoint_api_key: 'sk-node',
        models: [{ id: 'llama-3.1-8b-instruct', max_context: 8192 }],
      })
    );

    expect(await screen.findByText('gw_node_abc123')).toBeInTheDocument();
    expect(screen.getByText(/won't see it again/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('gw_node_abc123'));
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('resets the form and forgets the token after closing via Done', async () => {
    const mutateAsync = jest.fn().mockResolvedValue({ node: { id: 5 }, node_token: 'gw_node_abc123' });
    mockUseCreateGpuNode.mockReturnValue({ mutateAsync, isPending: false });

    render(<AddNodeDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Add node' }));
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /^register node$/i }));
    await screen.findByText('gw_node_abc123');

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText('gw_node_abc123')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add node' }));
    expect(screen.queryByText('gw_node_abc123')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i)).toHaveValue('');
  });
});
