/**
 * @jest-environment jsdom
 */
import { render, waitFor, screen } from '@testing-library/react';
import { PrivyProviderWrapper, useStorageStatus } from '../privy-provider';
import React from 'react';

// Mock dependencies
jest.mock('@/lib/browser-detection', () => ({
  isTauriDesktop: jest.fn(() => false),
}));

jest.mock('@/lib/safe-storage', () => ({
  canUseLocalStorage: jest.fn(() => true),
  waitForLocalStorageAccess: jest.fn(() => Promise.resolve(true)),
}));

// Mock dynamic imports
jest.mock('../privy-web-provider', () => ({
  PrivyWebProvider: ({ children, storageStatus }: any) => (
    <div data-testid="web-provider" data-storage-status={storageStatus}>
      {children}
    </div>
  ),
}));

jest.mock('../desktop-auth-provider', () => ({
  DesktopAuthProvider: ({ children }: any) => (
    <div data-testid="desktop-provider">{children}</div>
  ),
}));

// Mock next/dynamic
jest.mock('next/dynamic', () => () => {
  const DynamicComponent = (props: any) => {
    const WebProvider = require('../privy-web-provider').PrivyWebProvider;
    return <WebProvider {...props} />;
  };
  return DynamicComponent;
});

// Test component that uses the hook
function TestComponent() {
  const status = useStorageStatus();
  return <div data-testid="storage-status">{status}</div>;
}

describe('PrivyProviderWrapper - StorageStatusContext Fix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should provide storage status context to children', async () => {
    const { canUseLocalStorage } = require('@/lib/safe-storage');
    canUseLocalStorage.mockReturnValue(true);

    render(
      <PrivyProviderWrapper>
        <TestComponent />
      </PrivyProviderWrapper>
    );

    // After useEffect, should transition to "ready"
    await waitFor(() => {
      expect(screen.getByTestId('storage-status')).toHaveTextContent('ready');
    }, { timeout: 3000 });
  });

  it('should handle blocked storage status', async () => {
    const { canUseLocalStorage, waitForLocalStorageAccess } = require('@/lib/safe-storage');
    canUseLocalStorage.mockReturnValue(false);
    waitForLocalStorageAccess.mockResolvedValue(false);

    render(
      <PrivyProviderWrapper>
        <TestComponent />
      </PrivyProviderWrapper>
    );

    // When storage is blocked, the StorageDisabledNotice is shown instead of children
    // Verify the web provider has the correct storage status attribute
    await waitFor(() => {
      const webProvider = screen.getByTestId('web-provider');
      expect(webProvider).toHaveAttribute('data-storage-status', 'blocked');
      // Also verify the disabled notice is shown
      expect(screen.getByText('Browser storage is disabled')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
