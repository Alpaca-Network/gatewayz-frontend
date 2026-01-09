import React from 'react';
import { render, screen } from '@testing-library/react';
import { AppFooter } from '../app-footer';

// Mock next/navigation
const mockPathname = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { src: string; alt: string; width: number; height: number; className?: string }) => (
    <img {...props} />
  ),
}));

// Mock lucide-react
jest.mock('lucide-react', () => ({
  Twitter: ({ className }: { className?: string }) => (
    <svg data-testid="twitter-icon" className={className} />
  ),
}));

describe('AppFooter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset scroll position
    Object.defineProperty(window, 'scrollY', {
      value: 0,
      writable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 768,
      writable: true,
    });
  });

  it('should not render on chat pages', () => {
    mockPathname.mockReturnValue('/chat');
    const { container } = render(<AppFooter />);
    expect(container.firstChild).toBeNull();
  });

  it('should not render on chat subpages', () => {
    mockPathname.mockReturnValue('/chat/some-session');
    const { container } = render(<AppFooter />);
    expect(container.firstChild).toBeNull();
  });

  it('should not render on models pages', () => {
    mockPathname.mockReturnValue('/models');
    const { container } = render(<AppFooter />);
    expect(container.firstChild).toBeNull();
  });

  it('should not render on models detail pages', () => {
    mockPathname.mockReturnValue('/models/gpt-4');
    const { container } = render(<AppFooter />);
    expect(container.firstChild).toBeNull();
  });

  it('should not render on sandbox pages', () => {
    mockPathname.mockReturnValue('/sandbox');
    const { container } = render(<AppFooter />);
    expect(container.firstChild).toBeNull();
  });

  it('should not render on sandbox detail pages', () => {
    mockPathname.mockReturnValue('/sandbox/campaign-copy-generator');
    const { container } = render(<AppFooter />);
    expect(container.firstChild).toBeNull();
  });

  it('should render on settings pages after initial render', () => {
    mockPathname.mockReturnValue('/settings');
    render(<AppFooter />);

    // Footer shows on non-homepage routes immediately
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('should render on developers page', () => {
    mockPathname.mockReturnValue('/developers');
    render(<AppFooter />);

    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('should handle null pathname gracefully and render footer', () => {
    mockPathname.mockReturnValue(null);
    render(<AppFooter />);
    // With null pathname, isHomepage is false (null !== '/'), so showFooter is true
    // and isSandboxPage is false (due to ?? false fallback), so footer renders
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('should handle undefined pathname gracefully and render footer', () => {
    mockPathname.mockReturnValue(undefined);
    render(<AppFooter />);
    // With undefined pathname, isHomepage is false (undefined !== '/'), so showFooter is true
    // and isSandboxPage is false (due to ?? false fallback), so footer renders
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
