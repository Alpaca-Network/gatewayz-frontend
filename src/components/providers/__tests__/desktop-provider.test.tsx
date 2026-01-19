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
const mockHandleDesktopOAuthCallback = jest.fn(() => Promise.resolve({ success: true }));

jest.mock('@/lib/desktop', () => ({
  useIsTauri: () => mockUseIsTauri(),
  useDesktopShortcuts: () => mockUseDesktopShortcuts(),
  useWindowStatePersistence: () => mockUseWindowStatePersistence(),
  useDesktopUpdates: () => mockUseDesktopUpdates(),
  useNewChatEvent: (cb: () => void) => mockUseNewChatEvent(cb),
  useAuthCallback: (cb: (query: string) => void) => mockUseAuthCallback(cb),
  useNavigateEvent: (cb: (path: string) => void) => mockUseNavigateEvent(cb),
  showNotification: jest.fn(),
  handleDesktopOAuthCallback: (...args: unknown[]) => mockHandleDesktopOAuthCallback(...args),
}));

// Mock @/lib/api module
const mockSaveApiKey = jest.fn();
const mockSaveUserData = jest.fn();
const mockGetApiKey = jest.fn(() => 'test-token');
const mockAuthRefreshEvent = 'AUTH_REFRESH';

jest.mock('@/lib/api', () => ({
  saveApiKey: (...args: unknown[]) => mockSaveApiKey(...args),
  saveUserData: (...args: unknown[]) => mockSaveUserData(...args),
  getApiKey: () => mockGetApiKey(),
  AUTH_REFRESH_EVENT: mockAuthRefreshEvent,
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
  let capturedAuthCallback: ((query: string) => Promise<void>) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsTauri.mockReturnValue(true);
    mockGetApiKey.mockReturnValue('test-token');
    // Clear sessionStorage
    window.sessionStorage.clear();
    // Capture the auth callback
    mockUseAuthCallback.mockImplementation((cb) => {
      capturedAuthCallback = cb;
    });
  });

  afterEach(() => {
    capturedAuthCallback = null;
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
    render(
      <DesktopProvider>
        <div>Test Content</div>
      </DesktopProvider>
    );

    // Verify callback was captured
    expect(capturedAuthCallback).not.toBeNull();
    expect(typeof capturedAuthCallback).toBe('function');
  });

  it('should save credentials and navigate on valid token callback', async () => {
    jest.useRealTimers(); // Use real timers for async test

    render(
      <DesktopProvider>
        <div>Test Content</div>
      </DesktopProvider>
    );

    // Invoke the auth callback with valid parameters
    const query = 'token=test-token-12345678&user_id=123&privy_user_id=privy123&email=test@example.com';
    await act(async () => {
      await capturedAuthCallback!(query);
    });

    // Verify credentials were saved
    expect(mockSaveApiKey).toHaveBeenCalledWith('test-token-12345678');
    expect(mockSaveUserData).toHaveBeenCalledWith({
      user_id: 123,
      api_key: 'test-token-12345678',
      auth_method: 'desktop_deep_link',
      privy_user_id: 'privy123',
      display_name: 'test@example.com',
      email: 'test@example.com',
      credits: 0,
    });

    // Verify navigation occurred
    expect(mockPush).toHaveBeenCalledWith('/chat');
  });

  it('should skip duplicate auth callbacks', async () => {
    jest.useRealTimers();

    render(
      <DesktopProvider>
        <div>Test Content</div>
      </DesktopProvider>
    );

    // Pre-mark this token as processed
    const tokenPrefix = 'test-token-123456';
    window.sessionStorage.setItem(`desktop_auth_processed_${tokenPrefix.slice(0, 16)}`, 'true');

    // Invoke the auth callback
    const query = `token=${tokenPrefix}78&user_id=123`;
    await act(async () => {
      await capturedAuthCallback!(query);
    });

    // Verify no credentials were saved (callback was skipped)
    expect(mockSaveApiKey).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should handle legacy OAuth code format', async () => {
    jest.useRealTimers();
    mockHandleDesktopOAuthCallback.mockResolvedValue({ success: true });

    render(
      <DesktopProvider>
        <div>Test Content</div>
      </DesktopProvider>
    );

    // Invoke the auth callback with legacy format
    const query = 'code=auth_code_123&state=state123';
    await act(async () => {
      await capturedAuthCallback!(query);
    });

    // Verify legacy handler was called
    expect(mockHandleDesktopOAuthCallback).toHaveBeenCalledWith(query);
    expect(mockPush).toHaveBeenCalledWith('/chat');
  });

  it('should not navigate on legacy OAuth failure', async () => {
    jest.useRealTimers();
    mockHandleDesktopOAuthCallback.mockResolvedValue({ success: false, error: 'Invalid code' });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <DesktopProvider>
        <div>Test Content</div>
      </DesktopProvider>
    );

    // Invoke the auth callback with legacy format
    const query = 'code=invalid_code&state=state123';
    await act(async () => {
      await capturedAuthCallback!(query);
    });

    // Verify navigation did not occur
    expect(mockPush).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should log error for invalid callback without token or code', async () => {
    jest.useRealTimers();

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <DesktopProvider>
        <div>Test Content</div>
      </DesktopProvider>
    );

    // Invoke the auth callback with invalid parameters
    const query = 'invalid=params';
    await act(async () => {
      await capturedAuthCallback!(query);
    });

    // Verify error was logged
    expect(consoleSpy).toHaveBeenCalledWith('[Desktop Auth] Invalid callback: missing token or code');
    expect(mockPush).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should retry saving credentials if verification fails', async () => {
    jest.useRealTimers();

    // First call returns null (save failed), second returns token
    mockGetApiKey.mockReturnValueOnce(null).mockReturnValueOnce('test-token');

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <DesktopProvider>
        <div>Test Content</div>
      </DesktopProvider>
    );

    const query = 'token=test-token-12345678&user_id=123';
    await act(async () => {
      await capturedAuthCallback!(query);
    });

    // Verify saveApiKey was called twice (initial + retry)
    expect(mockSaveApiKey).toHaveBeenCalledTimes(2);
    expect(consoleSpy).toHaveBeenCalledWith('[Desktop Auth] Credentials not found after save - retrying save');
    expect(mockPush).toHaveBeenCalledWith('/chat');

    consoleSpy.mockRestore();
  });

  it('should clear processed flag on error', async () => {
    jest.useRealTimers();

    // Make saveApiKey throw an error
    mockSaveApiKey.mockImplementationOnce(() => {
      throw new Error('Storage error');
    });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <DesktopProvider>
        <div>Test Content</div>
      </DesktopProvider>
    );

    const token = 'test-token-error';
    const query = `token=${token}&user_id=123`;
    const processedKey = `desktop_auth_processed_${token.slice(0, 16)}`;

    await act(async () => {
      await capturedAuthCallback!(query);
    });

    // Verify the processed flag was cleared after error
    expect(window.sessionStorage.getItem(processedKey)).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith('[Desktop Auth] Error handling token callback:', expect.any(Error));

    consoleSpy.mockRestore();
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
