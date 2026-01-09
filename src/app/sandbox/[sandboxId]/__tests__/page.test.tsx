import React from 'react';
import { render, screen } from '@testing-library/react';
import SandboxPage from '../page';

// Mock the SandboxClient component
jest.mock('../sandbox-client', () => ({
  SandboxClient: ({ sandboxId }: { sandboxId: string }) => (
    <div data-testid="sandbox-client" data-sandbox-id={sandboxId}>
      SandboxClient Component
    </div>
  ),
}));

describe('SandboxPage (Server Component)', () => {
  it('should render SandboxClient with the correct sandboxId', async () => {
    const params = Promise.resolve({ sandboxId: 'test-sandbox-123' });

    const result = await SandboxPage({ params });
    render(result);

    const sandboxClient = screen.getByTestId('sandbox-client');
    expect(sandboxClient).toBeInTheDocument();
    expect(sandboxClient).toHaveAttribute('data-sandbox-id', 'test-sandbox-123');
  });

  it('should handle different sandboxId values', async () => {
    const params = Promise.resolve({ sandboxId: 'another-sandbox-456' });

    const result = await SandboxPage({ params });
    render(result);

    const sandboxClient = screen.getByTestId('sandbox-client');
    expect(sandboxClient).toHaveAttribute('data-sandbox-id', 'another-sandbox-456');
  });

  it('should await params before rendering', async () => {
    let resolveParams: (value: { sandboxId: string }) => void;
    const params = new Promise<{ sandboxId: string }>((resolve) => {
      resolveParams = resolve;
    });

    const renderPromise = SandboxPage({ params });

    // Resolve params
    resolveParams!({ sandboxId: 'delayed-sandbox' });

    const result = await renderPromise;
    render(result);

    expect(screen.getByTestId('sandbox-client')).toHaveAttribute(
      'data-sandbox-id',
      'delayed-sandbox'
    );
  });
});
