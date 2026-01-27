import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ReferralConfirmationDialog } from '../referral-confirmation-dialog';

// Mock safe storage utilities
const mockStorage: { [key: string]: string } = {};
jest.mock('@/lib/safe-storage', () => ({
  safeLocalStorageGet: jest.fn((key: string) => mockStorage[key] || null),
  safeLocalStorageSet: jest.fn((key: string, value: string) => { mockStorage[key] = value; }),
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
  CheckCircle: () => <span data-testid="icon-check">Check</span>,
  Mail: () => <span data-testid="icon-mail">Mail</span>,
  Share2: () => <span data-testid="icon-share">Share</span>,
}));

describe('ReferralConfirmationDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should not render if already shown', async () => {
    const { safeLocalStorageGet } = require('@/lib/safe-storage');
    safeLocalStorageGet.mockReturnValue('true');

    render(<ReferralConfirmationDialog newRefereeName="John Doe" />);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });

  it('should not render if no referee name provided', async () => {
    const { safeLocalStorageGet } = require('@/lib/safe-storage');
    safeLocalStorageGet.mockReturnValue(null);

    render(<ReferralConfirmationDialog />);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });

  it('should render when referee name is provided and not previously shown', async () => {
    const { safeLocalStorageGet } = require('@/lib/safe-storage');
    safeLocalStorageGet.mockReturnValue(null);

    render(<ReferralConfirmationDialog newRefereeName="John Doe" />);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });
  });

  it('should display referee name in confirmation', async () => {
    const { safeLocalStorageGet } = require('@/lib/safe-storage');
    safeLocalStorageGet.mockReturnValue(null);

    render(<ReferralConfirmationDialog newRefereeName="Jane Smith" />);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getByText(/Jane Smith has signed up!/)).toBeInTheDocument();
    });
  });

  it('should mark as shown when "Got It" is clicked', async () => {
    const { safeLocalStorageGet, safeLocalStorageSet } = require('@/lib/safe-storage');
    safeLocalStorageGet.mockReturnValue(null);

    render(<ReferralConfirmationDialog newRefereeName="John Doe" />);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    const gotItButton = screen.getByText('Got It');
    fireEvent.click(gotItButton);

    expect(safeLocalStorageSet).toHaveBeenCalledWith('gatewayz_referral_confirmation_shown', 'true');
  });

  it('should mark as shown when "View All Referrals" is clicked', async () => {
    const { safeLocalStorageGet, safeLocalStorageSet } = require('@/lib/safe-storage');
    safeLocalStorageGet.mockReturnValue(null);

    render(<ReferralConfirmationDialog newRefereeName="John Doe" />);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    const viewReferralsButton = screen.getByText('View All Referrals');
    fireEvent.click(viewReferralsButton);

    expect(safeLocalStorageSet).toHaveBeenCalledWith('gatewayz_referral_confirmation_shown', 'true');
  });

  it('should display email confirmation info', async () => {
    const { safeLocalStorageGet } = require('@/lib/safe-storage');
    safeLocalStorageGet.mockReturnValue(null);

    render(<ReferralConfirmationDialog newRefereeName="John Doe" />);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getByText('Email Confirmation Sent')).toBeInTheDocument();
    });
  });
});
