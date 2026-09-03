import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { LinkedWallet } from '@/lib/auth/wallet-auth-api';

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Overrides jest.setup.js's global lucide-react mock (Coins/Crown/Menu/Copy only) with the
// icons this page actually renders.
jest.mock('lucide-react', () => ({
  Copy: () => <span data-testid="icon-copy">Copy</span>,
  Wallet: () => <span data-testid="icon-wallet">Wallet</span>,
}));

// useActiveWallet — controls the connect()/signMessage() side of the link flow.
const mockConnect = jest.fn();
const mockSignMessage = jest.fn();
let mockActiveWallet: {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
} = { address: null, chainId: null, isConnected: false };

jest.mock('@/lib/hooks/use-active-wallet', () => ({
  useActiveWallet: () => ({
    ...mockActiveWallet,
    isReady: true,
    walletClientType: null,
    connect: mockConnect,
    switchToFuji: jest.fn(),
    signMessage: mockSignMessage,
  }),
}));

// useLinkedWallets / useLinkWallet / useUnlinkWallet — the react-query hooks.
let mockWalletsData: LinkedWallet[] | undefined;
let mockIsLoading = false;
let mockIsError = false;
const mockLinkMutateAsync = jest.fn();
const mockUnlinkMutateAsync = jest.fn();

jest.mock('@/lib/hooks/use-linked-wallets', () => ({
  useLinkedWallets: () => ({ data: mockWalletsData, isLoading: mockIsLoading, isError: mockIsError }),
  useLinkWallet: () => ({ mutateAsync: mockLinkMutateAsync }),
  useUnlinkWallet: () => ({ mutateAsync: mockUnlinkMutateAsync }),
}));

// requestWalletLinkNonce — called directly by the page (not via a hook).
const mockRequestWalletLinkNonce = jest.fn();
jest.mock('@/lib/auth/wallet-auth-api', () => {
  const actual = jest.requireActual('@/lib/auth/wallet-auth-api');
  return {
    ...actual,
    requestWalletLinkNonce: (...args: unknown[]) => mockRequestWalletLinkNonce(...args),
  };
});

// Import after mocks
import WalletsPage from '../page';
import { WalletAuthError } from '@/lib/auth/wallet-auth-api';

const makeWallet = (overrides: Partial<LinkedWallet> = {}): LinkedWallet => ({
  wallet_address: '0xabc0000000000000000000000000000000abcd',
  source: 'privy',
  wallet_client_type: 'privy',
  is_primary: false,
  verified_at: '2026-09-01T00:00:00Z',
  ...overrides,
});

describe('WalletsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWalletsData = undefined;
    mockIsLoading = false;
    mockIsError = false;
    mockActiveWallet = { address: null, chainId: null, isConnected: false };
  });

  it('renders an empty state when the user has no linked wallets', () => {
    mockWalletsData = [];

    render(<WalletsPage />);

    expect(screen.getByText('No wallets linked yet')).toBeInTheDocument();
  });

  it('shows a loading skeleton while the list is loading', () => {
    mockIsLoading = true;

    render(<WalletsPage />);

    expect(screen.queryByText('No wallets linked yet')).not.toBeInTheDocument();
  });

  it('shows an error state when the list fails to load', () => {
    mockIsError = true;

    render(<WalletsPage />);

    expect(screen.getByText(/failed to load your wallets/i)).toBeInTheDocument();
  });

  it('renders the wallet list with a Primary badge and source/client-type badges', () => {
    mockWalletsData = [
      makeWallet({ wallet_address: '0x1111111111111111111111111111111111abcd', is_primary: true, source: 'privy' }),
      makeWallet({
        wallet_address: '0x2222222222222222222222222222222222abcd',
        is_primary: false,
        source: 'siwe',
        wallet_client_type: 'metamask',
      }),
    ];

    render(<WalletsPage />);

    // 6+4 truncation
    expect(screen.getByText('0x1111...abcd')).toBeInTheDocument();
    expect(screen.getByText('0x2222...abcd')).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('Privy')).toBeInTheDocument();
    expect(screen.getByText('Signed')).toBeInTheDocument();
    expect(screen.getByText('metamask')).toBeInTheDocument();
  });

  describe('Link a wallet — happy path', () => {
    it('connects first when no wallet is active, then nonces/signs/links once connected', async () => {
      const user = userEvent.setup();
      mockWalletsData = [];

      mockConnect.mockImplementation(async () => {
        // Simulate useActiveWallet picking up the newly connected wallet.
        mockActiveWallet = { address: '0xabc0000000000000000000000000000000abcd', chainId: 43113, isConnected: true };
      });
      mockRequestWalletLinkNonce.mockResolvedValue({ message: 'sign this', expires_in: 300 });
      mockSignMessage.mockResolvedValue('0xsignature');
      mockLinkMutateAsync.mockResolvedValue(makeWallet());

      const { rerender } = render(<WalletsPage />);
      await user.click(screen.getByRole('button', { name: /link a wallet/i }));

      expect(mockConnect).toHaveBeenCalledTimes(1);

      // Re-render to pick up the mutated mockActiveWallet (the real hook would trigger
      // this itself via a state update inside Privy's SDK).
      rerender(<WalletsPage />);

      await waitFor(() => {
        expect(mockRequestWalletLinkNonce).toHaveBeenCalledWith('0xabc0000000000000000000000000000000abcd', 43113);
      });
      expect(mockSignMessage).toHaveBeenCalledWith('sign this');
      expect(mockLinkMutateAsync).toHaveBeenCalledWith({
        walletAddress: '0xabc0000000000000000000000000000000abcd',
        message: 'sign this',
        signature: '0xsignature',
      });
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Wallet linked' }));
      });
    });

    it('skips connect() and links directly when a wallet is already active', async () => {
      const user = userEvent.setup();
      mockWalletsData = [];
      mockActiveWallet = { address: '0xdef0000000000000000000000000000000dead', chainId: 43113, isConnected: true };
      mockRequestWalletLinkNonce.mockResolvedValue({ message: 'sign this', expires_in: 300 });
      mockSignMessage.mockResolvedValue('0xsignature');
      mockLinkMutateAsync.mockResolvedValue(makeWallet());

      render(<WalletsPage />);
      await user.click(screen.getByRole('button', { name: /link a wallet/i }));

      expect(mockConnect).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(mockLinkMutateAsync).toHaveBeenCalledWith({
          walletAddress: '0xdef0000000000000000000000000000000dead',
          message: 'sign this',
          signature: '0xsignature',
        });
      });
    });
  });

  describe('Link a wallet — error mapping', () => {
    it('shows the 409 wallet_linked_to_other_account message', async () => {
      const user = userEvent.setup();
      mockWalletsData = [];
      mockActiveWallet = { address: '0xabc', chainId: 43113, isConnected: true };
      mockRequestWalletLinkNonce.mockResolvedValue({ message: 'sign this', expires_in: 300 });
      mockSignMessage.mockResolvedValue('0xsignature');
      mockLinkMutateAsync.mockRejectedValue(new WalletAuthError(409, 'wallet_linked_to_other_account'));

      render(<WalletsPage />);
      await user.click(screen.getByRole('button', { name: /link a wallet/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Could not link wallet',
            description: 'This wallet is already linked to another Gatewayz account.',
            variant: 'destructive',
          })
        );
      });
    });
  });

  describe('Unlink a wallet', () => {
    it('confirms via dialog, then unlinks and shows a success toast', async () => {
      const user = userEvent.setup();
      mockWalletsData = [makeWallet({ is_primary: false })];
      mockUnlinkMutateAsync.mockResolvedValue(undefined);

      render(<WalletsPage />);
      await user.click(screen.getByRole('button', { name: /unlink/i }));

      expect(screen.getByText('Unlink this wallet?')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /^unlink$/i }));

      await waitFor(() => {
        expect(mockUnlinkMutateAsync).toHaveBeenCalledWith('0xabc0000000000000000000000000000000abcd');
      });
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Wallet unlinked' }));
      });
    });

    it('shows the last_auth_method explanatory toast on 400', async () => {
      const user = userEvent.setup();
      mockWalletsData = [makeWallet({ is_primary: true })];
      mockUnlinkMutateAsync.mockRejectedValue(new WalletAuthError(400, 'last_auth_method'));

      render(<WalletsPage />);
      await user.click(screen.getByRole('button', { name: /unlink/i }));
      await user.click(screen.getByRole('button', { name: /^unlink$/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Could not unlink wallet',
            description: expect.stringMatching(/only sign-in method/i),
            variant: 'destructive',
          })
        );
      });
    });
  });
});
