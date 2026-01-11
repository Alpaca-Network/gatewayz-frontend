import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { SandboxClient } from '../sandbox-client';

// Mock the @sampleapp.ai/sdk module
jest.mock('@sampleapp.ai/sdk', () => ({
  Sandbox: ({
    apiKey,
    sandboxId,
    env,
  }: {
    apiKey: string;
    sandboxId: string;
    env: { GATEWAYZ_API_KEY: string; GATEWAYZ_API_BASE_URL: string };
  }) => (
    <div
      data-testid="sandbox"
      data-api-key={apiKey}
      data-sandbox-id={sandboxId}
      data-gatewayz-key={env.GATEWAYZ_API_KEY}
      data-gatewayz-url={env.GATEWAYZ_API_BASE_URL}
    >
      Sandbox Component
    </div>
  ),
}));

// Mock the getApiKey function
jest.mock('@/lib/api', () => ({
  getApiKey: jest.fn(),
}));

import { getApiKey } from '@/lib/api';

const mockGetApiKey = getApiKey as jest.MockedFunction<typeof getApiKey>;

describe('SandboxClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should render the Sandbox component', async () => {
    mockGetApiKey.mockReturnValue('user-api-key');
    process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY = 'sampleapp-api-key';

    render(<SandboxClient sandboxId="test-sandbox" />);

    await waitFor(() => {
      expect(screen.getByTestId('sandbox')).toBeInTheDocument();
      expect(screen.getByText('Sandbox Component')).toBeInTheDocument();
    });
  });

  it('should pass sandboxId prop correctly', async () => {
    mockGetApiKey.mockReturnValue('user-api-key');
    process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY = 'sampleapp-api-key';

    render(<SandboxClient sandboxId="my-sandbox-123" />);

    await waitFor(() => {
      const sandbox = screen.getByTestId('sandbox');
      expect(sandbox).toHaveAttribute('data-sandbox-id', 'my-sandbox-123');
    });
  });

  it('should pass sampleapp API key from environment variable', async () => {
    mockGetApiKey.mockReturnValue('user-api-key');
    process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY = 'test-sampleapp-key';

    render(<SandboxClient sandboxId="test-sandbox" />);

    await waitFor(() => {
      const sandbox = screen.getByTestId('sandbox');
      expect(sandbox).toHaveAttribute('data-api-key', 'test-sampleapp-key');
    });
  });

  it('should pass empty string when sampleapp API key is not set', async () => {
    mockGetApiKey.mockReturnValue('user-api-key');
    delete process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY;

    render(<SandboxClient sandboxId="test-sandbox" />);

    await waitFor(() => {
      const sandbox = screen.getByTestId('sandbox');
      expect(sandbox).toHaveAttribute('data-api-key', '');
    });
  });

  it('should pass user API key from getApiKey to env prop', async () => {
    mockGetApiKey.mockReturnValue('my-user-api-key');
    process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY = 'sampleapp-key';

    render(<SandboxClient sandboxId="test-sandbox" />);

    await waitFor(() => {
      const sandbox = screen.getByTestId('sandbox');
      expect(sandbox).toHaveAttribute('data-gatewayz-key', 'my-user-api-key');
    });
  });

  it('should pass empty string when user API key is null', async () => {
    mockGetApiKey.mockReturnValue(null);
    process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY = 'sampleapp-key';

    render(<SandboxClient sandboxId="test-sandbox" />);

    // Initially renders with empty string (before useEffect runs)
    const sandbox = screen.getByTestId('sandbox');
    expect(sandbox).toHaveAttribute('data-gatewayz-key', '');

    // After useEffect runs, should still be empty string
    await waitFor(() => {
      expect(sandbox).toHaveAttribute('data-gatewayz-key', '');
    });
  });

  it('should pass correct GATEWAYZ_API_BASE_URL', async () => {
    mockGetApiKey.mockReturnValue('user-api-key');
    process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY = 'sampleapp-key';

    render(<SandboxClient sandboxId="test-sandbox" />);

    await waitFor(() => {
      const sandbox = screen.getByTestId('sandbox');
      expect(sandbox).toHaveAttribute('data-gatewayz-url', 'https://api.gatewayz.ai');
    });
  });

  it('should call getApiKey after mount', async () => {
    mockGetApiKey.mockReturnValue('api-key');
    process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY = 'sampleapp-key';

    render(<SandboxClient sandboxId="test-sandbox" />);

    await waitFor(() => {
      expect(mockGetApiKey).toHaveBeenCalled();
    });
  });

  it('should wrap Sandbox in a viewport-filling container', () => {
    mockGetApiKey.mockReturnValue('api-key');
    process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY = 'sampleapp-key';

    const { container } = render(<SandboxClient sandboxId="test-sandbox" />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('flex-1');
    expect(wrapper).toHaveClass('w-full');
    expect(wrapper).toHaveClass('h-full');
    expect(wrapper).toHaveClass('min-h-0');
    expect(wrapper).toHaveClass('overflow-hidden');
  });
});
