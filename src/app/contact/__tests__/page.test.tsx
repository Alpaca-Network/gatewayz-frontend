import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContactPage from '../page';

// Mock the toast hook
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div data-testid="card" className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div data-testid="card-content" className={className}>{children}</div>,
  CardHeader: ({ children, className }: any) => <div data-testid="card-header" className={className}>{children}</div>,
  CardTitle: ({ children, className }: any) => <h2 data-testid="card-title" className={className}>{children}</h2>,
  CardDescription: ({ children, className }: any) => <p data-testid="card-description" className={className}>{children}</p>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, disabled, onClick, type, ...props }: any) => (
    <button data-testid="button" disabled={disabled} onClick={onClick} type={type} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <input data-testid="input" className={className} ref={ref} {...props} />
  )),
}));

jest.mock('@/components/ui/textarea', () => ({
  Textarea: React.forwardRef(({ className, ...props }: any, ref: any) => (
    <textarea data-testid="textarea" className={className} ref={ref} {...props} />
  )),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: any) => (
    <div data-testid="select" onClick={() => onValueChange?.('sales')}>{children}</div>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => <div data-testid="select-item" data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <span data-testid="select-value">{placeholder}</span>,
}));

jest.mock('@/components/ui/form', () => ({
  Form: ({ children }: any) => <div data-testid="form">{children}</div>,
  FormControl: ({ children }: any) => <div data-testid="form-control">{children}</div>,
  FormField: ({ render, name }: any) => {
    const field = {
      value: '',
      onChange: jest.fn(),
      onBlur: jest.fn(),
      name,
      ref: jest.fn(),
    };
    return <div data-testid={`form-field-${name}`}>{render({ field })}</div>;
  },
  FormItem: ({ children }: any) => <div data-testid="form-item">{children}</div>,
  FormLabel: ({ children }: any) => <label data-testid="form-label">{children}</label>,
  FormMessage: () => <span data-testid="form-message" />,
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Mail: () => <span data-testid="icon-mail">Mail</span>,
  Send: () => <span data-testid="icon-send">Send</span>,
  CheckCircle: () => <span data-testid="icon-check">Check</span>,
  AlertCircle: () => <span data-testid="icon-alert">Alert</span>,
  Building2: () => <span data-testid="icon-building">Building</span>,
  User: () => <span data-testid="icon-user">User</span>,
  MessageSquare: () => <span data-testid="icon-message">Message</span>,
}));

describe('ContactPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('Page Structure', () => {
    it('should render the page header', () => {
      render(<ContactPage />);

      expect(screen.getByText('Contact Us')).toBeInTheDocument();
      expect(screen.getByText(/Have questions about Gatewayz/)).toBeInTheDocument();
    });

    it('should render the contact information sidebar', () => {
      render(<ContactPage />);

      expect(screen.getByText('Get in Touch')).toBeInTheDocument();
      expect(screen.getByText('sales@gatewayz.ai')).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
      expect(screen.getByText('Response Time')).toBeInTheDocument();
    });

    it('should render the "Why Gatewayz?" section', () => {
      render(<ContactPage />);

      expect(screen.getByText('Why Gatewayz?')).toBeInTheDocument();
      expect(screen.getByText('Access to 300+ AI models')).toBeInTheDocument();
      expect(screen.getByText('Unified API for all providers')).toBeInTheDocument();
      expect(screen.getByText('Cost optimization & analytics')).toBeInTheDocument();
      expect(screen.getByText('Enterprise-grade reliability')).toBeInTheDocument();
    });

    it('should render the contact form', () => {
      render(<ContactPage />);

      expect(screen.getByText('Send us a Message')).toBeInTheDocument();
      expect(screen.getByText('Name *')).toBeInTheDocument();
      expect(screen.getByText('Email *')).toBeInTheDocument();
      expect(screen.getByText('Company')).toBeInTheDocument();
      expect(screen.getByText('Subject *')).toBeInTheDocument();
      expect(screen.getByText('Message *')).toBeInTheDocument();
    });

    it('should render the submit button', () => {
      render(<ContactPage />);

      expect(screen.getByText('Send Message')).toBeInTheDocument();
    });

    it('should render email link with correct href', () => {
      render(<ContactPage />);

      const emailLink = screen.getByText('sales@gatewayz.ai');
      expect(emailLink).toHaveAttribute('href', 'mailto:sales@gatewayz.ai');
    });
  });

  describe('Form Elements', () => {
    it('should render all form fields', () => {
      render(<ContactPage />);

      expect(screen.getByTestId('form-field-name')).toBeInTheDocument();
      expect(screen.getByTestId('form-field-email')).toBeInTheDocument();
      expect(screen.getByTestId('form-field-company')).toBeInTheDocument();
      expect(screen.getByTestId('form-field-subject')).toBeInTheDocument();
      expect(screen.getByTestId('form-field-message')).toBeInTheDocument();
    });

    it('should render input placeholders', () => {
      render(<ContactPage />);

      const inputs = screen.getAllByTestId('input');
      expect(inputs.length).toBeGreaterThan(0);
    });

    it('should render character counter for message', () => {
      render(<ContactPage />);

      expect(screen.getByText('0/5000')).toBeInTheDocument();
    });
  });

  describe('Icons', () => {
    it('should render Mail icon in header', () => {
      render(<ContactPage />);

      expect(screen.getAllByTestId('icon-mail').length).toBeGreaterThan(0);
    });

    it('should render Send icon in button', () => {
      render(<ContactPage />);

      expect(screen.getByTestId('icon-send')).toBeInTheDocument();
    });

    it('should render Building icon', () => {
      render(<ContactPage />);

      expect(screen.getAllByTestId('icon-building').length).toBeGreaterThan(0);
    });

    it('should render User icon', () => {
      render(<ContactPage />);

      expect(screen.getByTestId('icon-user')).toBeInTheDocument();
    });

    it('should render MessageSquare icon', () => {
      render(<ContactPage />);

      expect(screen.getByTestId('icon-message')).toBeInTheDocument();
    });
  });

  describe('Cards', () => {
    it('should render multiple cards', () => {
      render(<ContactPage />);

      const cards = screen.getAllByTestId('card');
      expect(cards.length).toBeGreaterThanOrEqual(3);
    });

    it('should render card headers', () => {
      render(<ContactPage />);

      const cardHeaders = screen.getAllByTestId('card-header');
      expect(cardHeaders.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Responsive Layout', () => {
    it('should have responsive grid layout', () => {
      const { container } = render(<ContactPage />);

      expect(container.querySelector('.lg\\:col-span-1')).toBeInTheDocument();
      expect(container.querySelector('.lg\\:col-span-2')).toBeInTheDocument();
    });
  });
});

describe('ContactPage Form Validation Schema', () => {
  it('should have correct subject options', () => {
    render(<ContactPage />);

    // Check that all subject options are rendered
    expect(screen.getByText('General Inquiry')).toBeInTheDocument();
    expect(screen.getByText('Sales & Pricing')).toBeInTheDocument();
    expect(screen.getByText('Technical Support')).toBeInTheDocument();
    expect(screen.getByText('Partnership Opportunities')).toBeInTheDocument();
    expect(screen.getByText('Enterprise Solutions')).toBeInTheDocument();
  });
});
