import { render, screen } from '@testing-library/react';
import { UnstakeCard } from '../UnstakeCard';
import { useOnchainStakingState, useRequestUnstake, useCancelUnstake, useWithdraw } from '@/lib/hooks/use-wayz-staking';

jest.mock('@/lib/hooks/use-wayz-staking', () => ({
  useOnchainStakingState: jest.fn(),
  useRequestUnstake: jest.fn(),
  useCancelUnstake: jest.fn(),
  useWithdraw: jest.fn(),
}));

const mockUseOnchainStakingState = useOnchainStakingState as jest.Mock;

const ADDRESS = '0x1000000000000000000000000000000000000a';
const TEN_WAYZ = 10n * 10n ** 18n;

function mockMutation() {
  return { mutateAsync: jest.fn().mockResolvedValue(undefined), mutate: jest.fn(), isPending: false };
}

describe('UnstakeCard', () => {
  beforeEach(() => {
    (useRequestUnstake as jest.Mock).mockReturnValue(mockMutation());
    (useCancelUnstake as jest.Mock).mockReturnValue(mockMutation());
    (useWithdraw as jest.Mock).mockReturnValue(mockMutation());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows a countdown and disables Withdraw before the cooldown ends', () => {
    const futureUnlock = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now
    mockUseOnchainStakingState.mockReturnValue({
      data: { pending: { amount: TEN_WAYZ, unlockAt: futureUnlock } },
    });

    render(<UnstakeCard address={ADDRESS as never} />);

    expect(screen.getByTestId('unstake-countdown')).toHaveTextContent(/remaining/i);
    expect(screen.getByRole('button', { name: /withdraw/i })).toBeDisabled();
  });

  it('enables Withdraw once the cooldown has elapsed', () => {
    const pastUnlock = BigInt(Math.floor(Date.now() / 1000) - 60); // 1 minute ago
    mockUseOnchainStakingState.mockReturnValue({
      data: { pending: { amount: TEN_WAYZ, unlockAt: pastUnlock } },
    });

    render(<UnstakeCard address={ADDRESS as never} />);

    expect(screen.getByTestId('unstake-countdown')).toHaveTextContent(/ready to withdraw/i);
    expect(screen.getByRole('button', { name: /withdraw/i })).toBeEnabled();
  });

  it('renders the request form when there is no pending unstake', () => {
    mockUseOnchainStakingState.mockReturnValue({
      data: { pending: { amount: 0n, unlockAt: 0n } },
    });

    render(<UnstakeCard address={ADDRESS as never} />);

    expect(screen.getByRole('button', { name: /request unstake/i })).toBeInTheDocument();
    expect(screen.queryByTestId('unstake-countdown')).not.toBeInTheDocument();
  });
});
