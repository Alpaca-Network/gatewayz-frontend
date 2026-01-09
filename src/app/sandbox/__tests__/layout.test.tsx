import React from 'react';
import { render, screen } from '@testing-library/react';
import SandboxLayout from '../layout';

describe('SandboxLayout', () => {
  afterEach(() => {
    // Clean up body class and style after each test
    document.body.classList.remove('sandbox-page');
    document.body.style.overflow = '';
  });

  it('should render children', () => {
    render(
      <SandboxLayout>
        <div data-testid="child">Child content</div>
      </SandboxLayout>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should add sandbox-page class to body', () => {
    render(
      <SandboxLayout>
        <div>Content</div>
      </SandboxLayout>
    );

    expect(document.body.classList.contains('sandbox-page')).toBe(true);
  });

  it('should set overflow hidden on body', () => {
    render(
      <SandboxLayout>
        <div>Content</div>
      </SandboxLayout>
    );

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('should render container with correct viewport height class', () => {
    const { container } = render(
      <SandboxLayout>
        <div>Content</div>
      </SandboxLayout>
    );

    const layoutContainer = container.firstChild as HTMLElement;
    expect(layoutContainer).toHaveClass('sandbox-container');
    expect(layoutContainer).toHaveClass('h-[calc(100dvh-65px)]');
    expect(layoutContainer).toHaveClass('w-full');
    expect(layoutContainer).toHaveClass('overflow-hidden');
  });

  it('should have onboarding banner variant class for 115px header height', () => {
    const { container } = render(
      <SandboxLayout>
        <div>Content</div>
      </SandboxLayout>
    );

    const layoutContainer = container.firstChild as HTMLElement;
    expect(layoutContainer).toHaveClass('has-onboarding-banner:h-[calc(100dvh-115px)]');
  });

  it('should use Tailwind flex classes for proper child rendering', () => {
    const { container } = render(
      <SandboxLayout>
        <div>Content</div>
      </SandboxLayout>
    );

    const layoutContainer = container.firstChild as HTMLElement;
    expect(layoutContainer).toHaveClass('flex');
    expect(layoutContainer).toHaveClass('flex-col');
  });

  it('should clean up body class on unmount', () => {
    const { unmount } = render(
      <SandboxLayout>
        <div>Content</div>
      </SandboxLayout>
    );

    expect(document.body.classList.contains('sandbox-page')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.classList.contains('sandbox-page')).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });
});
