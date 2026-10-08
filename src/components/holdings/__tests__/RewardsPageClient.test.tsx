import { fireEvent, render, screen } from '@testing-library/react';
import { RewardsPageClient } from '../RewardsPageClient';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { HOLDINGS_SUPPORTED_CHAINS } from '@/lib/holdings/supported-tokens';

jest.mock('@/context/gatewayz-auth-context', () => ({
  useGatewayzAuth: jest.fn(),
}));
jest.mock('../HoldingsWalletLink', () => ({
  HoldingsWalletLink: () => <div data-testid="wallet-link" />,
}));
jest.mock('../HoldingsRewardsCard', () => ({
  HoldingsRewardsCard: () => <div data-testid="rewards-card" />,
}));

const mockUseGatewayzAuth = useGatewayzAuth as jest.Mock;

describe('RewardsPageClient', () => {
  beforeEach(() => jest.clearAllMocks());

  it('explains the program and lists every supported token to a signed-out visitor', () => {
    const login = jest.fn();
    mockUseGatewayzAuth.mockReturnValue({ status: 'unauthenticated', login });
    render(<RewardsPageClient />);

    expect(screen.getByRole('heading', { level: 1, name: 'Earn free inference on what you hold' })).toBeInTheDocument();
    expect(screen.getByText(/we check balances 4 times a day/i)).toBeInTheDocument();
    expect(screen.getByText(/credits arrive daily, from day 4/i)).toBeInTheDocument();
    for (const chain of HOLDINGS_SUPPORTED_CHAINS) {
      const list = screen.getByRole('list', { name: `Tokens counted on ${chain.name}` });
      expect(list.querySelectorAll('li')).toHaveLength(chain.tokens.length);
    }
    expect(screen.queryByTestId('wallet-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rewards-card')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /sign in to start/i }));
    expect(login).toHaveBeenCalled();
  });

  it('shows the link flow and the rewards card when signed in', () => {
    mockUseGatewayzAuth.mockReturnValue({ status: 'authenticated', login: jest.fn() });
    render(<RewardsPageClient />);

    expect(screen.getByTestId('wallet-link')).toBeInTheDocument();
    expect(screen.getByTestId('rewards-card')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in to start/i })).not.toBeInTheDocument();
  });
});
