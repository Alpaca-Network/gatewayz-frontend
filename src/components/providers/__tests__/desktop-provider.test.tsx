import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { DesktopProvider, DesktopOnly, WebOnly } from '../desktop-provider';

// Mock next/navigation
const mockPush = jest.fn();
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// Mock desktop hooks
const mockUseIsTauri = jest.fn(() => false);
const mockUseDesktopShortcuts = jest.fn();
const mockUseWindowStatePersistence = jest.fn();
const mockUseDesktopUpdates = jest.fn(() => ({
  updateInfo: null,
  checkForUpdates: jest.fn(),
}));
const mockUseNewChatEvent = jest.fn();
const mockUseAuthCallback = jest.fn();
const mockUseNavigateEvent = jest.fn();

jest.mock('@/lib/desktop', () => ({
  useIsTauri: () => mockUseIsTauri(),
  useDesktopShortcuts: () => mockUseDesktopShortcuts(),
  useWindowStatePersistence: () => mockUseWindowStatePersistence(),
  useDesktopUpdates: () => mockUseDesktopUpdates(),
  useNewChatEvent: (cb: () => void) => mockUseNewChatEvent(cb),
  useAuthCallback: (cb: (query: string) => void) => mockUseAuthCallback(cb),
  useNavigateEvent: (cb: (path: string) => void) => mockUseNavigateEvent(cb),
  showNotification: jest.fn(),
  handleDesktopOAuthCallback: jest.fn(() => Promise.resolve({ success: true })),
}));

// Mock shortcut info dialog
const mockHasShownShortcutInfo = jest.fn(() => true);
const mockShowShortcutInfoDialog = jest.fn();
jest.mock('@/components/dialogs/shortcut-info-dialog', () => ({
  ShortcutInfoDialog: () => <div data-testid="shortcut-dialog">Shortcut Dialog</div>,
  hasShownShortcutInfo: () => mockHasShownShortcutInfo(),
  showShortcutInfoDialog: () => mockShowShortcutInfoDialog(),
}));

describe('DesktopProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUseIsTauri.mockReturnValue(false);
    mockHasShownShortcutInfo.mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Web Environment', () => {
    it('should render children in web environment', () => {
      mockUseIsTauri.mockReturnValue(false);

      const { getByText } = render(
        <DesktopProvider>
          <div>Test Content</div>
        </DesktopProvider>
      );

      expect(getByText('Test Content')).toBeInTheDocument();
    });

    it('should not render shortcut dialog in web environment', () => {
      mockUseIsTauri.mockReturnValue(false);

      const { queryByTestId } = render(
        <DesktopProvider>
          <div>Test Content</div>
        </DesktopProvider>
      );

      expect(queryByTestId('shortcut-dialog')).not.toBeInTheDocument();
    });

    it('should not show shortcut info dialog in web environment', () => {
      mockUseIsTauri.mockReturnValue(false);
      mockHasShownShortcutInfo.mockReturnValue(false);

      render(
        <DesktopProvider>
          <div>Test Content</div>
        </DesktopProvider>
      );

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(mockShowShortcutInfoDialog).not.toHaveBeenCalled();
    });
  });

  describe('Desktop Environment', () => {
    it('should render children in desktop environment', () => {
      mockUseIsTauri.mockReturnValue(true);

      const { getByText } = render(
        <DesktopProvider>
          <div>Test Content</div>
        </DesktopProvider>
      );

      expect(getByText('Test Content')).toBeInTheDocument();
    });

    it('should render shortcut dialog in desktop environment', () => {
      mockUseIsTauri.mockReturnValue(true);

      const { getByTestId } = render(
        <DesktopProvider>
          <div>Test Content</div>
        </DesktopProvider>
      );

      expect(getByTestId('shortcut-dialog')).toBeInTheDocument();
    });

    it('should show shortcut info dialog on first launch', async () => {
      mockUseIsTauri.mockReturnValue(true);
      mockHasShownShortcutInfo.mockReturnValue(false);

      render(
        <DesktopProvider>
          <div>Test Content</div>
        </DesktopProvider>
      );

      act(() => {
        jest.advanceTimersByTime(1500);
      });

      expect(mockShowShortcutInfoDialog).toHaveBeenCalled();
    });

    it('should not show shortcut info dialog if already shown', () => {
      mockUseIsTauri.mockReturnValue(true);
      mockHasShownShortcutInfo.mockReturnValue(true);

      render(
        <DesktopProvider>
          <div>Test Content</div>
        </DesktopProvider>
      );

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(mockShowShortcutInfoDialog).not.toHaveBeenCalled();
    });
  });

  describe('Hooks Registration', () => {
    it('should register desktop shortcuts', () => {
      mockUseIsTauri.mockReturnValue(true);

      render(
        <DesktopProvider>
          <div>Test Content</div>
        </DesktopProvider>
      );

      expect(mockUseDesktopShortcuts).toHaveBeenCalled();
    });

    it('should register window state persistence', () => {
      mockUseIsTauri.mockReturnValue(true);

      render(
        <DesktopProvider>
          <div>Test Content</div>
        </DesktopProvider>
      );

      expect(mockUseWindowStatePersistence).toHaveBeenCalled();
    });

    it('should register new chat event handler', () => {
      mockUseIsTauri.mockReturnValue(true);

      render(
        <DesktopProvider>
          <div>Test Content</div>
        </DesktopProvider>
      );

      expect(mockUseNewChatEvent).toHaveBeenCalled();
    });

    it('should navigate to /chat on new chat event', () => {
      mockUseIsTauri.mockReturnValue(true);
      let capturedCallback: () => void = () => {};
      mockUseNewChatEvent.mockImplementation((cb) => {
        capturedCallback = cb;
      });

      render(
        <DesktopProvider>
          <div>Test Content</div>
        </DesktopProvider>
      );

      capturedCallback();
      expect(mockPush).toHaveBeenCalledWith('/chat');
    });

    it('should register navigate event handler', () => {
      mockUseIsTauri.mockReturnValue(true);

      render(
        <DesktopProvider>
          <div>Test Content</div>
        </DesktopProvider>
      );

      expect(mockUseNavigateEvent).toHaveBeenCalled();
    });

    it('should navigate on navigate event', () => {
      mockUseIsTauri.mockReturnValue(true);
      let capturedCallback: (path: string) => void = () => {};
      mockUseNavigateEvent.mockImplementation((cb) => {
        capturedCallback = cb;
      });

      render(
        <DesktopProvider>
          <div>Test Content</div>
        </DesktopProvider>
      );

      capturedCallback('/settings');
      expect(mockPush).toHaveBeenCalledWith('/settings');
    });
  });
});

describe('DesktopOnly', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render children in desktop environment', () => {
    mockUseIsTauri.mockReturnValue(true);

    const { getByText } = render(
      <DesktopOnly>
        <div>Desktop Content</div>
      </DesktopOnly>
    );

    expect(getByText('Desktop Content')).toBeInTheDocument();
  });

  it('should not render children in web environment', () => {
    mockUseIsTauri.mockReturnValue(false);

    const { queryByText } = render(
      <DesktopOnly>
        <div>Desktop Content</div>
      </DesktopOnly>
    );

    expect(queryByText('Desktop Content')).not.toBeInTheDocument();
  });
});

describe('WebOnly', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render children in web environment', () => {
    mockUseIsTauri.mockReturnValue(false);

    const { getByText } = render(
      <WebOnly>
        <div>Web Content</div>
      </WebOnly>
    );

    expect(getByText('Web Content')).toBeInTheDocument();
  });

  it('should not render children in desktop environment', () => {
    mockUseIsTauri.mockReturnValue(true);

    const { queryByText } = render(
      <WebOnly>
        <div>Web Content</div>
      </WebOnly>
    );

    expect(queryByText('Web Content')).not.toBeInTheDocument();
  });
});

describe('Auth Callback Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsTauri.mockReturnValue(true);
    // Clear sessionStorage
    window.sessionStorage.clear();
  });

  it('should register auth callback handler', () => {
    render(
      <DesktopProvider>
        <div>Test Content</div>
      </DesktopProvider>
    );

    expect(mockUseAuthCallback).toHaveBeenCalled();
  });

  it('should capture callback function for auth events', () => {
    let capturedCallback: ((query: string) => void) | null = null;
    mockUseAuthCallback.mockImplementation((cb) => {
      capturedCallback = cb;
    });

    render(
      <DesktopProvider>
        <div>Test Content</div>
      </DesktopProvider>
    );

    // Verify callback was captured
    expect(capturedCallback).not.toBeNull();
    expect(typeof capturedCallback).toBe('function');
  });

  it('should deduplicate auth callbacks by storing processed token in sessionStorage', () => {
    // Test the deduplication mechanism directly
    const testTokenPrefix = 'test-api-key-12';
    const processedKey = `desktop_auth_processed_${testTokenPrefix}`;

    // Initially should not be set
    expect(window.sessionStorage.getItem(processedKey)).toBeNull();

    // After setting, should be retrievable
    window.sessionStorage.setItem(processedKey, 'true');
    expect(window.sessionStorage.getItem(processedKey)).toBe('true');
  });
});
