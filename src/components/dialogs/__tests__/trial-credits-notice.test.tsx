import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { TrialCreditsNotice } from '../trial-credits-notice';

// Mock safe storage utilities
const mockStorage: { [key: string]: string } = {};
jest.mock('@/lib/safe-storage', () => ({
  safeLocalStorageGet: jest.fn((key: string) => mockStorage[key] || null),
  safeLocalStorageSet: jest.fn((key: string, value: string) => { mockStorage[key] = value; }),
}));

// Mock getUserData
jest.mock('@/lib/api', () => ({
  getUserData: jest.fn(),
}));

// Mock Next.js Link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, onClick }: { children: React.ReactNode; href: string; onClick?: () => void }) => (
    <a href={href} onClick={onClick}>{children}</a>
  ),
}));

// Mock UI components
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) =>
    <p data-testid="dialog-description">{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-footer">{children}</div>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) =>
    <button onClick={onClick} className={className} data-testid="button">{children}</button>,
}));

jest.mock('lucide-react', () => ({
  AlertCircle: () => <span data-testid="icon-alert">Alert</span>,
  Sparkles: () => <span data-testid="icon-sparkles">Sparkles</span>,
}));

describe('TrialCreditsNotice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should not render if already dismissed', async () => {
    const { safeLocalStorageGet } = require('@/lib/safe-storage');
    safeLocalStorageGet.mockReturnValue('true');

    render(<TrialCreditsNotice />);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });

  it('should not render if no user data', async () => {
    const { getUserData } = require('@/lib/api');
    const { safeLocalStorageGet } = require('@/lib/safe-storage');
    safeLocalStorageGet.mockReturnValue(null);
    getUserData.mockReturnValue(null);

    render(<TrialCreditsNotice />);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });

  it('should render for users with trial credits (500 cents = $5 or less)', async () => {
    const { getUserData } = require('@/lib/api');
    const { safeLocalStorageGet } = require('@/lib/safe-storage');
    safeLocalStorageGet.mockReturnValue(null);
    getUserData.mockReturnValue({ credits: 500 }); // 500 cents = $5 trial credits

    render(<TrialCreditsNotice />);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });
  });

  it('should display correct credit amount in dollars', async () => {
    const { getUserData } = require('@/lib/api');
    const { safeLocalStorageGet } = require('@/lib/safe-storage');
    safeLocalStorageGet.mockReturnValue(null);
    getUserData.mockReturnValue({ credits: 200 }); // 200 cents = $2.00

    render(<TrialCreditsNotice />);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      // Credits are displayed as dollars (200 cents = $2.00)
      expect(screen.getByText(/\$2\.00 in free trial credits/)).toBeInTheDocument();
    });
  });

  it('should mark as dismissed when "Remind Me Later" is clicked', async () => {
    const { getUserData } = require('@/lib/api');
    const { safeLocalStorageGet, safeLocalStorageSet } = require('@/lib/safe-storage');
    safeLocalStorageGet.mockReturnValue(null);
    getUserData.mockReturnValue({ credits: 500 }); // 500 cents = $5

    render(<TrialCreditsNotice />);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    const remindButton = screen.getByText('Remind Me Later');
    fireEvent.click(remindButton);

    expect(safeLocalStorageSet).toHaveBeenCalledWith('gatewayz_trial_notice_dismissed', 'true');
  });

  it('should mark as dismissed when "Add Credits & Get Started" is clicked', async () => {
    const { getUserData } = require('@/lib/api');
    const { safeLocalStorageGet, safeLocalStorageSet } = require('@/lib/safe-storage');
    safeLocalStorageGet.mockReturnValue(null);
    getUserData.mockReturnValue({ credits: 500 }); // 500 cents = $5

    render(<TrialCreditsNotice />);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    const getStartedButton = screen.getByText('Add Credits & Get Started');
    fireEvent.click(getStartedButton);

    expect(safeLocalStorageSet).toHaveBeenCalledWith('gatewayz_trial_notice_dismissed', 'true');
  });

  it('should not render for users with more than 500 cents ($5)', async () => {
    const { getUserData } = require('@/lib/api');
    const { safeLocalStorageGet } = require('@/lib/safe-storage');
    safeLocalStorageGet.mockReturnValue(null);
    getUserData.mockReturnValue({ credits: 10000 }); // 10000 cents = $100

    render(<TrialCreditsNotice />);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });
});
