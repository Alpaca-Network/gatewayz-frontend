import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import {
  ShortcutInfoDialog,
  SHORTCUT_INFO_EVENT,
  hasShownShortcutInfo,
  markShortcutInfoShown,
  showShortcutInfoDialog,
} from '../shortcut-info-dialog';

// Mock the desktop tauri utilities
jest.mock('@/lib/desktop/tauri', () => ({
  isMacOS: jest.fn(() => false),
  isWindows: jest.fn(() => false),
}));

// Mock localStorage
const mockLocalStorage: { [key: string]: string } = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => mockLocalStorage[key] || null,
    setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
    removeItem: (key: string) => { delete mockLocalStorage[key]; },
    clear: () => { Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]); },
  },
  writable: true,
});

// Mock UI components
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: { children: React.ReactNode; open: boolean; onOpenChange?: (open: boolean) => void }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) =>
    <p data-testid="dialog-description">{children}</p>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) =>
    <button onClick={onClick} className={className} data-testid="button">{children}</button>,
}));

jest.mock('lucide-react', () => ({
  Keyboard: () => <span data-testid="icon-keyboard">Keyboard</span>,
}));

describe('ShortcutInfoDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  describe('Dialog Visibility', () => {
    it('should not render by default', () => {
      render(<ShortcutInfoDialog />);
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('should render when event is triggered', async () => {
      render(<ShortcutInfoDialog />);

      // Trigger the event wrapped in act
      await act(async () => {
        window.dispatchEvent(new CustomEvent(SHORTCUT_INFO_EVENT));
      });

      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
      });
    });

    it('should render the dialog title', async () => {
      render(<ShortcutInfoDialog />);

      await act(async () => {
        window.dispatchEvent(new CustomEvent(SHORTCUT_INFO_EVENT));
      });

      await waitFor(() => {
        expect(screen.getByText('Quick Launch Shortcut')).toBeInTheDocument();
      });
    });
  });

  describe('Platform-Specific Shortcuts', () => {
    it('should display Linux shortcut by default', async () => {
      const { isMacOS, isWindows } = require('@/lib/desktop/tauri');
      isMacOS.mockReturnValue(false);
      isWindows.mockReturnValue(false);

      render(<ShortcutInfoDialog />);

      await act(async () => {
        window.dispatchEvent(new CustomEvent(SHORTCUT_INFO_EVENT));
      });

      await waitFor(() => {
        expect(screen.getByText('Super + G')).toBeInTheDocument();
      });
    });

    it('should display macOS shortcut when on Mac', async () => {
      const { isMacOS, isWindows } = require('@/lib/desktop/tauri');
      isMacOS.mockReturnValue(true);
      isWindows.mockReturnValue(false);

      render(<ShortcutInfoDialog />);

      await act(async () => {
        window.dispatchEvent(new CustomEvent(SHORTCUT_INFO_EVENT));
      });

      await waitFor(() => {
        expect(screen.getByText('⌘ + G')).toBeInTheDocument();
      });
    });

    it('should display Windows shortcut when on Windows', async () => {
      const { isMacOS, isWindows } = require('@/lib/desktop/tauri');
      isMacOS.mockReturnValue(false);
      isWindows.mockReturnValue(true);

      render(<ShortcutInfoDialog />);

      await act(async () => {
        window.dispatchEvent(new CustomEvent(SHORTCUT_INFO_EVENT));
      });

      await waitFor(() => {
        expect(screen.getByText('⊞ Win + Shift + G')).toBeInTheDocument();
      });
    });
  });

  describe('Dismiss Button', () => {
    it('should close dialog when "Got it!" is clicked', async () => {
      render(<ShortcutInfoDialog />);

      await act(async () => {
        window.dispatchEvent(new CustomEvent(SHORTCUT_INFO_EVENT));
      });

      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
      });

      const button = screen.getByText('Got it!');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
      });
    });

    it('should mark shortcut info as shown when dismissed', async () => {
      render(<ShortcutInfoDialog />);

      await act(async () => {
        window.dispatchEvent(new CustomEvent(SHORTCUT_INFO_EVENT));
      });

      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
      });

      const button = screen.getByText('Got it!');
      fireEvent.click(button);

      expect(window.localStorage.getItem('gatewayz_shortcut_info_shown')).toBe('true');
    });
  });

  describe('Helper Functions', () => {
    describe('hasShownShortcutInfo', () => {
      it('should return false when not shown before', () => {
        expect(hasShownShortcutInfo()).toBe(false);
      });

      it('should return true when previously shown', () => {
        window.localStorage.setItem('gatewayz_shortcut_info_shown', 'true');
        expect(hasShownShortcutInfo()).toBe(true);
      });
    });

    describe('markShortcutInfoShown', () => {
      it('should set the localStorage flag', () => {
        markShortcutInfoShown();
        expect(window.localStorage.getItem('gatewayz_shortcut_info_shown')).toBe('true');
      });
    });

    describe('showShortcutInfoDialog', () => {
      it('should dispatch the custom event', () => {
        const mockDispatchEvent = jest.spyOn(window, 'dispatchEvent');

        showShortcutInfoDialog();

        expect(mockDispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({ type: SHORTCUT_INFO_EVENT })
        );

        mockDispatchEvent.mockRestore();
      });
    });
  });

  describe('Dialog Content', () => {
    it('should display keyboard icon', async () => {
      render(<ShortcutInfoDialog />);

      await act(async () => {
        window.dispatchEvent(new CustomEvent(SHORTCUT_INFO_EVENT));
      });

      await waitFor(() => {
        expect(screen.getByTestId('icon-keyboard')).toBeInTheDocument();
      });
    });

    it('should display usage instructions', async () => {
      render(<ShortcutInfoDialog />);

      await act(async () => {
        window.dispatchEvent(new CustomEvent(SHORTCUT_INFO_EVENT));
      });

      await waitFor(() => {
        expect(screen.getByText(/Use this shortcut from anywhere/)).toBeInTheDocument();
      });
    });

    it('should mention background operation', async () => {
      render(<ShortcutInfoDialog />);

      await act(async () => {
        window.dispatchEvent(new CustomEvent(SHORTCUT_INFO_EVENT));
      });

      await waitFor(() => {
        expect(screen.getByText(/The app runs in the background/)).toBeInTheDocument();
      });
    });
  });
});
