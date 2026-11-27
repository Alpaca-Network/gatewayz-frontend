import { render, screen } from '@testing-library/react';
import DiscountCreditsWalletPage from '../page';

const mockNotFound = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
jest.mock('next/navigation', () => ({ notFound: () => mockNotFound() }));
jest.mock('@/components/discount-credits/CardanoWalletPanel', () => ({
  CardanoWalletPanel: () => <div>wallet panel</div>,
}));

const FLAG = 'NEXT_PUBLIC_VAULT_DISCOUNT_CREDITS_ENABLED';
const original = process.env[FLAG];

describe('Settings > Credits > Cardano wallet page', () => {
  afterEach(() => {
    jest.clearAllMocks();
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
  });

  it.each([undefined, 'false', '1', 'TRUE'])('is a 404 when the build flag is %p', (value) => {
    if (value === undefined) delete process.env[FLAG];
    else process.env[FLAG] = value;
    expect(() => render(<DiscountCreditsWalletPage />)).toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalled();
    expect(screen.queryByText('wallet panel')).not.toBeInTheDocument();
  });

  it('renders the wallet panel when the build flag is "true"', () => {
    process.env[FLAG] = 'true';
    render(<DiscountCreditsWalletPage />);
    expect(screen.getByText('wallet panel')).toBeInTheDocument();
    expect(mockNotFound).not.toHaveBeenCalled();
  });
});
