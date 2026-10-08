import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { HoldingsWalletLink } from '../HoldingsWalletLink';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { useIsTauri } from '@/lib/desktop/hooks';
import { useLinkedWallets, useLinkWallet } from '@/lib/hooks/use-linked-wallets';
import { WalletAuthError } from '@/lib/auth/wallet-auth-api';

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));
const mockInvalidateQueries = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));
jest.mock('@privy-io/react-auth', () => ({
  usePrivy: jest.fn(),
  useWallets: jest.fn(),
}));
jest.mock('@/context/gatewayz-auth-context', () => ({
  useGatewayzAuth: jest.fn(),
}));
jest.mock('@/lib/desktop/hooks', () => ({
  useIsTauri: jest.fn(),
}));
jest.mock('@/lib/hooks/use-linked-wallets', () => ({
  useLinkedWallets: jest.fn(),
  useLinkWallet: jest.fn(),
}));
const mockRequestNonce = jest.fn();
jest.mock('@/lib/auth/wallet-auth-api', () => {
  const actual = jest.requireActual('@/lib/auth/wallet-auth-api');
  return {
    ...actual,
    requestWalletLinkNonceForAnyChain: (...args: unknown[]) => mockRequestNonce(...args),
  };
});

const mockUsePrivy = usePrivy as jest.Mock;
const mockUseWallets = useWallets as jest.Mock;
const mockUseGatewayzAuth = useGatewayzAuth as jest.Mock;
const mockUseIsTauri = useIsTauri as jest.Mock;
const mockUseLinkedWallets = useLinkedWallets as jest.Mock;
const mockUseLinkWallet = useLinkWallet as jest.Mock;

const METAMASK = '0x1111111111111111111111111111111111111111';
const EMBEDDED = '0x2222222222222222222222222222222222222222';

const connected = (address: string, walletClientType: string, chainId = 'eip155:1') => ({
  address,
  walletClientType,
  chainId,
  sign: jest.fn().mockResolvedValue('0xsig'),
});

describe('HoldingsWalletLink', () => {
  const connectWallet = jest.fn();
  const mutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsTauri.mockReturnValue(false);
    mockUseGatewayzAuth.mockReturnValue({ status: 'authenticated' });
    mockUsePrivy.mockReturnValue({ ready: true, connectWallet });
    mockUseWallets.mockReturnValue({ wallets: [] });
    mockUseLinkedWallets.mockReturnValue({ isLoading: false, isError: false, data: [] });
    mockUseLinkWallet.mockReturnValue({ mutateAsync });
    mockRequestNonce.mockResolvedValue({ message: 'Sign in to Gatewayz', expires_in: 300 });
    mutateAsync.mockResolvedValue({});
  });

  it('shows an already-linked embedded wallet as linked, with nothing to sign', () => {
    mockUseWallets.mockReturnValue({ wallets: [connected(EMBEDDED, 'privy', 'eip155:8453')] });
    mockUseLinkedWallets.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [{ wallet_address: EMBEDDED, source: 'privy', wallet_client_type: 'privy', is_primary: true, verified_at: null }],
    });

    render(<HoldingsWalletLink />);

    expect(screen.getByText('0x2222...2222')).toBeInTheDocument();
    expect(screen.getByText('Gatewayz wallet')).toBeInTheDocument();
    expect(screen.getByText('Linked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /link with a signature/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect another wallet/i })).toBeInTheDocument();
  });

  it('links a connected mainnet wallet with one signature and refreshes rewards', async () => {
    const wallet = connected(METAMASK, 'metamask', 'eip155:1');
    mockUseWallets.mockReturnValue({ wallets: [wallet] });

    render(<HoldingsWalletLink />);
    fireEvent.click(screen.getByRole('button', { name: /link with a signature/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mockRequestNonce).toHaveBeenCalledWith(METAMASK, 1);
    expect(wallet.sign).toHaveBeenCalledWith('Sign in to Gatewayz');
    expect(mutateAsync).toHaveBeenCalledWith({ walletAddress: METAMASK, message: 'Sign in to Gatewayz', signature: '0xsig' });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['holdings', 'rewards'] });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Wallet linked' }));
  });

  it('links the wallet Privy adds after "Connect a wallet"', async () => {
    const { rerender } = render(<HoldingsWalletLink />);
    fireEvent.click(screen.getByRole('button', { name: /connect a wallet/i }));
    expect(connectWallet).toHaveBeenCalled();

    const wallet = connected(METAMASK, 'metamask');
    mockUseWallets.mockReturnValue({ wallets: [wallet] });
    await act(async () => {
      rerender(<HoldingsWalletLink />);
    });

    await waitFor(() => expect(wallet.sign).toHaveBeenCalled());
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ walletAddress: METAMASK }));
  });

  it('explains a backend refusal', async () => {
    mockUseWallets.mockReturnValue({ wallets: [connected(METAMASK, 'metamask')] });
    mutateAsync.mockRejectedValue(new WalletAuthError(409, 'wallet_linked_to_other_account'));

    render(<HoldingsWalletLink />);
    fireEvent.click(screen.getByRole('button', { name: /link with a signature/i }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Could not link wallet',
          description: 'This wallet is already linked to another Gatewayz account.',
        })
      )
    );
  });

  it('treats a declined signature as a cancel', async () => {
    const wallet = connected(METAMASK, 'metamask');
    wallet.sign.mockRejectedValue(Object.assign(new Error('User rejected the request.'), { code: 4001 }));
    mockUseWallets.mockReturnValue({ wallets: [wallet] });

    render(<HoldingsWalletLink />);
    fireEvent.click(screen.getByRole('button', { name: /link with a signature/i }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'The signature request was cancelled.' })
      )
    );
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('points desktop users to the browser', () => {
    mockUseIsTauri.mockReturnValue(true);
    render(<HoldingsWalletLink />);
    expect(screen.getByText(/open beta\.gatewayz\.ai\/rewards in your browser/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
