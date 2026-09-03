import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RegisterProviderForm } from '../RegisterProviderForm';
import { useLinkedWallets } from '@/lib/hooks/use-linked-wallets';
import { useRegisterGpuProvider } from '@/lib/hooks/use-gpu-provider';

jest.mock('@/lib/hooks/use-linked-wallets', () => ({
  useLinkedWallets: jest.fn(),
}));
jest.mock('@/lib/hooks/use-gpu-provider', () => ({
  useRegisterGpuProvider: jest.fn(),
}));
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

// Radix's Select needs real layout (scrollIntoView/hasPointerCapture) that jsdom doesn't
// provide — the codebase's own precedent (src/app/settings/__tests__/page.test.tsx) mocks
// this module in every test that touches it. This version renders a real, functional
// <select> so onValueChange still fires on selection.
jest.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: React.PropsWithChildren<{ onValueChange?: (v: string) => void; value?: string }>) => (
    <select data-testid="wallet-select" value={value} onChange={(e) => onValueChange?.(e.target.value)}>
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: React.PropsWithChildren<unknown>) => <>{children}</>,
  SelectItem: ({ children, value }: React.PropsWithChildren<{ value: string }>) => (
    <option value={value}>{children}</option>
  ),
}));

const mockUseLinkedWallets = useLinkedWallets as jest.Mock;
const mockUseRegisterGpuProvider = useRegisterGpuProvider as jest.Mock;

describe('RegisterProviderForm', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a link-a-wallet CTA when the caller has no linked wallets', () => {
    mockUseLinkedWallets.mockReturnValue({ data: [], isLoading: false });
    mockUseRegisterGpuProvider.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });

    render(<RegisterProviderForm />);

    expect(screen.getByRole('link', { name: /link a wallet/i })).toHaveAttribute('href', '/settings/wallets');
    expect(screen.queryByRole('button', { name: /^register$/i })).not.toBeInTheDocument();
  });

  it('disables submit until a display name and wallet are chosen', () => {
    mockUseLinkedWallets.mockReturnValue({
      data: [
        {
          wallet_address: '0x1000000000000000000000000000000000000a',
          source: 'siwe',
          wallet_client_type: null,
          is_primary: true,
          verified_at: null,
        },
      ],
      isLoading: false,
    });
    mockUseRegisterGpuProvider.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });

    render(<RegisterProviderForm />);

    expect(screen.getByRole('button', { name: /^register$/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Acme GPUs' } });
    expect(screen.getByRole('button', { name: /^register$/i })).toBeDisabled();
  });

  it('submits the registration payload with the required fields', async () => {
    const mutateAsync = jest.fn().mockResolvedValue({ id: 1, status: 'pending' });
    mockUseLinkedWallets.mockReturnValue({
      data: [
        {
          wallet_address: '0x1000000000000000000000000000000000000a',
          source: 'siwe',
          wallet_client_type: null,
          is_primary: true,
          verified_at: null,
        },
      ],
      isLoading: false,
    });
    mockUseRegisterGpuProvider.mockReturnValue({ mutateAsync, isPending: false });

    render(<RegisterProviderForm />);
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Acme GPUs' } });
    fireEvent.change(screen.getByTestId('wallet-select'), {
      target: { value: '0x1000000000000000000000000000000000000a' },
    });

    await waitFor(() => expect(screen.getByRole('button', { name: /^register$/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /^register$/i }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        display_name: 'Acme GPUs',
        payout_wallet_address: '0x1000000000000000000000000000000000000a',
      })
    );
  });

  it('includes optional contact_email/region_default only when filled in', async () => {
    const mutateAsync = jest.fn().mockResolvedValue({ id: 1, status: 'pending' });
    mockUseLinkedWallets.mockReturnValue({
      data: [
        {
          wallet_address: '0x1000000000000000000000000000000000000a',
          source: 'siwe',
          wallet_client_type: null,
          is_primary: true,
          verified_at: null,
        },
      ],
      isLoading: false,
    });
    mockUseRegisterGpuProvider.mockReturnValue({ mutateAsync, isPending: false });

    render(<RegisterProviderForm />);
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Acme GPUs' } });
    fireEvent.change(screen.getByTestId('wallet-select'), {
      target: { value: '0x1000000000000000000000000000000000000a' },
    });
    fireEvent.change(screen.getByLabelText(/contact email/i), { target: { value: 'ops@acme.gpu' } });
    fireEvent.change(screen.getByLabelText(/default region/i), { target: { value: 'us-east' } });

    fireEvent.click(screen.getByRole('button', { name: /^register$/i }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        display_name: 'Acme GPUs',
        payout_wallet_address: '0x1000000000000000000000000000000000000a',
        contact_email: 'ops@acme.gpu',
        region_default: 'us-east',
      })
    );
  });
});
