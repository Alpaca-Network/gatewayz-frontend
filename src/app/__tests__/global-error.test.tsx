import { render, screen, fireEvent } from '@testing-library/react';
import * as Sentry from '@sentry/nextjs';
import GlobalError from '../global-error';

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
}));

// Mock Button component
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

describe('GlobalError', () => {
  const mockError = new Error('Test error message');
  const mockReset = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock window.location.href
    delete (window as any).location;
    (window as any).location = { href: '' };
  });

  it('should render error message and actions', () => {
    render(<GlobalError error={mockError} reset={mockReset} />);

    // Check error title
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Check description
    expect(
      screen.getByText(/We apologize for the inconvenience/i)
    ).toBeInTheDocument();

    // Check action buttons
    expect(screen.getByText('Try again')).toBeInTheDocument();
    expect(screen.getByText('Go to homepage')).toBeInTheDocument();
  });

  it('should capture error in Sentry', () => {
    render(<GlobalError error={mockError} reset={mockReset} />);

    expect(Sentry.captureException).toHaveBeenCalledWith(mockError, {
      tags: {
        error_type: 'global_error',
        error_boundary: 'root',
      },
      contexts: {
        react: {
          componentStack: 'Global Error Boundary (Root Layout)',
        },
      },
      level: 'error',
    });
  });

  it('should call reset when "Try again" button is clicked', () => {
    render(<GlobalError error={mockError} reset={mockReset} />);

    const tryAgainButton = screen.getByText('Try again');
    fireEvent.click(tryAgainButton);

    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('should navigate to homepage when "Go to homepage" button is clicked', () => {
    render(<GlobalError error={mockError} reset={mockReset} />);

    const homepageButton = screen.getByText('Go to homepage');
    fireEvent.click(homepageButton);

    // Check that href was set to '/' (jsdom adds localhost prefix)
    expect(window.location.href).toContain('/');
    expect(window.location.pathname).toBe('/');
  });

  it('should display error message in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(<GlobalError error={mockError} reset={mockReset} />);

    expect(screen.getByText('Test error message')).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('should display error digest when present', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const errorWithDigest = Object.assign(mockError, { digest: 'abc123' });
    render(<GlobalError error={errorWithDigest} reset={mockReset} />);

    expect(screen.getByText(/Error ID: abc123/i)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('should not display error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    render(<GlobalError error={mockError} reset={mockReset} />);

    // Error message should not be visible in production
    expect(screen.queryByText('Test error message')).not.toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('should render support contact link', () => {
    render(<GlobalError error={mockError} reset={mockReset} />);

    const supportLink = screen.getByText('support@gatewayz.ai');
    expect(supportLink).toBeInTheDocument();
    expect(supportLink).toHaveAttribute('href', 'mailto:support@gatewayz.ai');
  });

  it('should have proper HTML structure with lang attribute', () => {
    const { container } = render(
      <GlobalError error={mockError} reset={mockReset} />
    );

    const htmlElement = container.querySelector('html');
    expect(htmlElement).toHaveAttribute('lang', 'en');
  });

  it('should have proper meta tags', () => {
    const { container } = render(
      <GlobalError error={mockError} reset={mockReset} />
    );

    const charsetMeta = container.querySelector('meta[charSet="utf-8"]');
    expect(charsetMeta).toBeInTheDocument();

    const viewportMeta = container.querySelector(
      'meta[name="viewport"]'
    );
    expect(viewportMeta).toBeInTheDocument();
  });

  it('should render error icon SVG', () => {
    const { container } = render(
      <GlobalError error={mockError} reset={mockReset} />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
  });
});
