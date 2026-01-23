import React from 'react';
import { render, screen } from '@testing-library/react';
import { SandboxLayoutClient } from '../sandbox-layout-client';
import { sandboxMetadata } from '../metadata';

describe('SandboxLayoutClient', () => {
  afterEach(() => {
    // Clean up body class and style after each test
    document.body.classList.remove('sandbox-page');
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
  });

  it('should render children', () => {
    render(
      <SandboxLayoutClient>
        <div data-testid="child">Child content</div>
      </SandboxLayoutClient>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should add sandbox-page class to body', () => {
    render(
      <SandboxLayoutClient>
        <div>Content</div>
      </SandboxLayoutClient>
    );

    expect(document.body.classList.contains('sandbox-page')).toBe(true);
  });

  it('should set overflow hidden on body', () => {
    render(
      <SandboxLayoutClient>
        <div>Content</div>
      </SandboxLayoutClient>
    );

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('should set overscrollBehavior none on body for mobile', () => {
    render(
      <SandboxLayoutClient>
        <div>Content</div>
      </SandboxLayoutClient>
    );

    expect(document.body.style.overscrollBehavior).toBe('none');
  });

  it('should render container with correct viewport height class', () => {
    const { container } = render(
      <SandboxLayoutClient>
        <div>Content</div>
      </SandboxLayoutClient>
    );

    const layoutContainer = container.firstChild as HTMLElement;
    expect(layoutContainer).toHaveClass('sandbox-container');
    expect(layoutContainer).toHaveClass('h-[calc(100dvh-65px)]');
    expect(layoutContainer).toHaveClass('w-full');
    expect(layoutContainer).toHaveClass('overflow-auto');
  });

  it('should have onboarding banner height variant class using CSS variable', () => {
    const { container } = render(
      <SandboxLayoutClient>
        <div>Content</div>
      </SandboxLayoutClient>
    );

    const layoutContainer = container.firstChild as HTMLElement;
    // Uses CSS variable for dynamic banner height with 50px fallback
    expect(layoutContainer).toHaveClass('has-onboarding-banner:h-[calc(100dvh-65px-var(--onboarding-banner-height,50px))]');
  });

  it('should have flex classes for proper child rendering', () => {
    const { container } = render(
      <SandboxLayoutClient>
        <div>Content</div>
      </SandboxLayoutClient>
    );

    const layoutContainer = container.firstChild as HTMLElement;
    expect(layoutContainer).toHaveClass('flex');
    expect(layoutContainer).toHaveClass('flex-col');
  });

  it('should have mobile scroll prevention class', () => {
    const { container } = render(
      <SandboxLayoutClient>
        <div>Content</div>
      </SandboxLayoutClient>
    );

    const layoutContainer = container.firstChild as HTMLElement;
    expect(layoutContainer).toHaveClass('overscroll-none');
  });

  it('should clean up body class and styles on unmount', () => {
    const { unmount } = render(
      <SandboxLayoutClient>
        <div>Content</div>
      </SandboxLayoutClient>
    );

    expect(document.body.classList.contains('sandbox-page')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.overscrollBehavior).toBe('none');

    unmount();

    expect(document.body.classList.contains('sandbox-page')).toBe(false);
    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.overscrollBehavior).toBe('');
  });
});

describe('sandboxMetadata', () => {
  it('should have correct title', () => {
    expect(sandboxMetadata.title).toBe('Sandbox - Generate Apps with AI | Gatewayz');
  });

  it('should have correct description', () => {
    expect(sandboxMetadata.description).toBe('Generate apps with Gatewayz AI Sandbox. Build and prototype AI-powered applications in seconds.');
  });

  it('should have openGraph configuration', () => {
    expect(sandboxMetadata.openGraph).toBeDefined();
    expect(sandboxMetadata.openGraph?.title).toBe('Gatewayz Sandbox - Generate Apps with AI');
    expect(sandboxMetadata.openGraph?.url).toBe('https://beta.gatewayz.ai/sandbox');
  });

  it('should have sandbox OG image configured', () => {
    const images = sandboxMetadata.openGraph?.images as Array<{ url: string }>;
    expect(images).toBeDefined();
    expect(images[0]?.url).toBe('/sandbox-og-image.png');
  });

  it('should have twitter card configuration', () => {
    expect(sandboxMetadata.twitter).toBeDefined();
    expect(sandboxMetadata.twitter?.card).toBe('summary_large_image');
    expect(sandboxMetadata.twitter?.title).toBe('Gatewayz Sandbox - Generate Apps with AI');
  });

  it('should have twitter image pointing to sandbox OG image', () => {
    const images = sandboxMetadata.twitter?.images as string[];
    expect(images).toContain('/sandbox-og-image.png');
  });
});
