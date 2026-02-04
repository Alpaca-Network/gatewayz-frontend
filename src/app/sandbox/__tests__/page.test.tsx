import React from 'react';
import { render, screen } from '@testing-library/react';
import SandboxPage from '../page';

// Mock the @sampleapp.ai/sdk module
jest.mock('@sampleapp.ai/sdk', () => ({
  SandboxHome: ({ apiKey, orgid }: { apiKey: string; orgid: string }) => (
    <div data-testid="sandbox-home" data-api-key={apiKey} data-orgid={orgid}>
      SandboxHome Component
    </div>
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  AlertCircle: ({ className }: { className?: string }) => (
    <div data-testid="alert-circle-icon" className={className}>AlertCircle</div>
  ),
}));

describe('SandboxPage', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should render the SandboxHome component when API key is set', () => {
    process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY = 'test-api-key';

    render(<SandboxPage />);

    expect(screen.getByTestId('sandbox-home')).toBeInTheDocument();
    expect(screen.getByText('SandboxHome Component')).toBeInTheDocument();
  });

  it('should pass the correct orgid prop', () => {
    process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY = 'test-api-key';

    render(<SandboxPage />);

    const sandboxHome = screen.getByTestId('sandbox-home');
    expect(sandboxHome).toHaveAttribute('data-orgid', 'gatewayz');
  });

  it('should pass API key from environment variable', () => {
    process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY = 'test-api-key';

    render(<SandboxPage />);

    const sandboxHome = screen.getByTestId('sandbox-home');
    expect(sandboxHome).toHaveAttribute('data-api-key', 'test-api-key');
  });

  it('should show error message when API key is not set', () => {
    delete process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY;

    render(<SandboxPage />);

    expect(screen.queryByTestId('sandbox-home')).not.toBeInTheDocument();
    expect(screen.getByText('Sandbox Not Configured')).toBeInTheDocument();
    expect(screen.getByText(/NEXT_PUBLIC_SAMPLEAPP_API_KEY/)).toBeInTheDocument();
  });

  it('should show error message when API key is empty string', () => {
    process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY = '';

    render(<SandboxPage />);

    expect(screen.queryByTestId('sandbox-home')).not.toBeInTheDocument();
    expect(screen.getByText('Sandbox Not Configured')).toBeInTheDocument();
  });

  it('should wrap SandboxHome in a scrollable viewport-filling container', () => {
    process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY = 'test-api-key';

    const { container } = render(<SandboxPage />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('flex-1');
    expect(wrapper).toHaveClass('w-full');
    expect(wrapper).toHaveClass('h-full');
    expect(wrapper).toHaveClass('min-h-0');
    expect(wrapper).toHaveClass('overflow-auto');
  });
});
