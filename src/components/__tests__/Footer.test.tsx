import React from 'react';
import { render, screen } from '@testing-library/react';
import { Footer } from '../Footer';

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  );
});

// Mock lucide-react
jest.mock('lucide-react', () => ({
  Twitter: ({ className }: { className?: string }) => (
    <svg data-testid="twitter-icon" className={className} />
  ),
  Linkedin: ({ className }: { className?: string }) => (
    <svg data-testid="linkedin-icon" className={className} />
  ),
}));

describe('Footer', () => {
  it('should render the footer', () => {
    render(<Footer />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('should render the Gatewayz logo and name', () => {
    render(<Footer />);
    expect(screen.getByAltText('Gatewayz')).toBeInTheDocument();
    expect(screen.getByText('Gatewayz')).toBeInTheDocument();
  });

  it('should render copyright notice', () => {
    render(<Footer />);
    const currentYear = new Date().getFullYear();
    expect(screen.getByText(`© ${currentYear} Augmented Intelligence Humans Inc. All rights reserved.`)).toBeInTheDocument();
  });

  it('should render Product section links', () => {
    render(<Footer />);
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Pricing')).toBeInTheDocument();
    expect(screen.getByText('Documentation')).toBeInTheDocument();
  });

  it('should render Resources section with Blog link', () => {
    render(<Footer />);
    expect(screen.getByText('Resources')).toBeInTheDocument();
    const blogLink = screen.getByRole('link', { name: 'Blog' });
    expect(blogLink).toHaveAttribute('href', 'https://blog.gatewayz.ai');
  });

  it('should render Company section links', () => {
    render(<Footer />);
    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
  });

  it('should render Connect section with social links', () => {
    render(<Footer />);
    expect(screen.getByText('Connect')).toBeInTheDocument();
  });

  it('should render X (Twitter) link with correct URL', () => {
    render(<Footer />);
    const xLink = screen.getByRole('link', { name: /X/i });
    expect(xLink).toHaveAttribute('href', 'https://x.com/GatewayzAI');
    expect(screen.getByTestId('twitter-icon')).toBeInTheDocument();
  });

  it('should render LinkedIn link with correct URL', () => {
    render(<Footer />);
    const linkedinLink = screen.getByRole('link', { name: /LinkedIn/i });
    expect(linkedinLink).toHaveAttribute('href', 'https://www.linkedin.com/company/gatewayz-ai/');
    expect(screen.getByTestId('linkedin-icon')).toBeInTheDocument();
  });
});
