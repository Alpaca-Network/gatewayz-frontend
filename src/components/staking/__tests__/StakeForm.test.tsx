import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StakeForm } from '../StakeForm';
import { useOnchainStakingState, useApproveAndStake } from '@/lib/hooks/use-wayz-staking';
import { isWayzConfigured } from '@/lib/wayz/addresses';

jest.mock('@/lib/hooks/use-wayz-staking', () => ({
  useOnchainStakingState: jest.fn(),
  useApproveAndStake: jest.fn(),
}));

jest.mock('@/lib/wayz/addresses', () => ({
  isWayzConfigured: jest.fn(),
}));

const mockUseOnchainStakingState = useOnchainStakingState as jest.Mock;
const mockUseApproveAndStake = useApproveAndStake as jest.Mock;
const mockIsWayzConfigured = isWayzConfigured as jest.Mock;

const ADDRESS = '0x1000000000000000000000000000000000000a';

describe('StakeForm', () => {
  let mutateAsync: jest.Mock;

  beforeEach(() => {
    mutateAsync = jest.fn().mockResolvedValue(undefined);
    mockUseApproveAndStake.mockReturnValue({ mutateAsync, isPending: false });
    mockUseOnchainStakingState.mockReturnValue({
      data: { tokenBalance: 1000n * 10n ** 18n, allowance: 0n, paused: false },
    });
    mockIsWayzConfigured.mockReturnValue(true);
  });

  it('rejects an amount with more than 18 fractional digits instead of silently rounding', async () => {
    render(<StakeForm address={ADDRESS as never} />);

    fireEvent.change(screen.getByLabelText(/amount to stake/i), {
      target: { value: '1.1234567890123456789' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^stake$/i }));

    await waitFor(() => expect(mutateAsync).not.toHaveBeenCalled());
  });

  it('accepts a valid decimal amount and stakes it', async () => {
    render(<StakeForm address={ADDRESS as never} />);

    fireEvent.change(screen.getByLabelText(/amount to stake/i), { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: /^stake$/i }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ amount: 15n * 10n ** 17n, currentAllowance: 0n })
    );
  });
});
