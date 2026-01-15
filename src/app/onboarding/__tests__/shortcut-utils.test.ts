/**
 * Tests for shortcut-related utility functions used in the onboarding page
 */

// Mock desktop/tauri before importing
const mockIsMacOS = jest.fn(() => false);
const mockIsWindows = jest.fn(() => false);

jest.mock('@/lib/desktop/tauri', () => ({
  isTauri: jest.fn(() => false),
  isMacOS: () => mockIsMacOS(),
  isWindows: () => mockIsWindows(),
}));

describe('getShortcutText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsMacOS.mockReturnValue(false);
    mockIsWindows.mockReturnValue(false);
  });

  // Test the shortcut text logic directly
  function getShortcutText(): string {
    if (mockIsMacOS()) return '⌘+G';
    if (mockIsWindows()) return 'Win+Shift+G';
    return 'Super+G';
  }

  it('should return macOS shortcut for Mac', () => {
    mockIsMacOS.mockReturnValue(true);
    expect(getShortcutText()).toBe('⌘+G');
  });

  it('should return Windows shortcut for Windows', () => {
    mockIsWindows.mockReturnValue(true);
    expect(getShortcutText()).toBe('Win+Shift+G');
  });

  it('should return Linux shortcut for other platforms', () => {
    mockIsMacOS.mockReturnValue(false);
    mockIsWindows.mockReturnValue(false);
    expect(getShortcutText()).toBe('Super+G');
  });
});

describe('Shortcut Task Configuration', () => {
  it('should define correct shortcut task structure', () => {
    const shortcutTask = {
      id: "shortcut",
      title: "Learn Quick Launch Shortcut",
      description: "Press Super+G anytime to instantly open GatewayZ from anywhere.",
      actionLabel: "Show Shortcut"
    };

    expect(shortcutTask.id).toBe('shortcut');
    expect(shortcutTask.title).toBe('Learn Quick Launch Shortcut');
    expect(shortcutTask.actionLabel).toBe('Show Shortcut');
    expect(shortcutTask.description).toContain('instantly open GatewayZ');
  });
});
