import React from 'react';
import { render, screen } from '@testing-library/react';
import TermsPage from '../page';

describe('TermsPage', () => {
  describe('Page structure', () => {
    it('should render the page header', () => {
      render(<TermsPage />);

      expect(screen.getByText('Terms of Service')).toBeInTheDocument();
      expect(screen.getByText('Last updated: January 2026')).toBeInTheDocument();
    });

    it('should render all main sections', () => {
      render(<TermsPage />);

      expect(screen.getByText('1. Acceptance of Terms')).toBeInTheDocument();
      expect(screen.getByText('2. Description of Service')).toBeInTheDocument();
      expect(screen.getByText('3. Account Registration')).toBeInTheDocument();
      expect(screen.getByText('4. Acceptable Use')).toBeInTheDocument();
      expect(screen.getByText('5. API Usage and Rate Limits')).toBeInTheDocument();
      expect(screen.getByText('6. Payment and Billing')).toBeInTheDocument();
      expect(screen.getByText('7. Intellectual Property')).toBeInTheDocument();
      expect(screen.getByText('8. Third-Party Services')).toBeInTheDocument();
      expect(screen.getByText('9. Disclaimer of Warranties')).toBeInTheDocument();
      expect(screen.getByText('10. Limitation of Liability')).toBeInTheDocument();
      expect(screen.getByText('11. Termination')).toBeInTheDocument();
      expect(screen.getByText('12. Changes to Terms')).toBeInTheDocument();
      expect(screen.getByText('13. Contact Us')).toBeInTheDocument();
    });
  });

  describe('Content display', () => {
    it('should render acceptance of terms content', () => {
      render(<TermsPage />);

      expect(
        screen.getByText(/By accessing or using Gatewayz/)
      ).toBeInTheDocument();
    });

    it('should render service description', () => {
      render(<TermsPage />);

      expect(
        screen.getByText(/Gatewayz provides a unified API gateway/)
      ).toBeInTheDocument();
    });

    it('should render account registration requirements', () => {
      render(<TermsPage />);

      expect(
        screen.getByText(/Providing accurate and complete registration information/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Maintaining the security of your account credentials/)
      ).toBeInTheDocument();
    });

    it('should render acceptable use prohibitions', () => {
      render(<TermsPage />);

      expect(screen.getByText(/Violate any applicable laws or regulations/)).toBeInTheDocument();
      expect(screen.getByText(/Generate harmful, abusive, or illegal content/)).toBeInTheDocument();
    });

    it('should render disclaimer in uppercase', () => {
      render(<TermsPage />);

      expect(screen.getByText(/THE SERVICE IS PROVIDED "AS IS"/)).toBeInTheDocument();
    });
  });

  describe('Contact information', () => {
    it('should render contact email link', () => {
      render(<TermsPage />);

      const emailLink = screen.getByText('legal@gatewayz.ai');
      expect(emailLink).toBeInTheDocument();
      expect(emailLink).toHaveAttribute('href', 'mailto:legal@gatewayz.ai');
    });
  });

  describe('Styling', () => {
    it('should have proper page background', () => {
      const { container } = render(<TermsPage />);

      expect(container.querySelector('.bg-background')).toBeInTheDocument();
    });

    it('should have max-width container', () => {
      const { container } = render(<TermsPage />);

      expect(container.querySelector('.max-w-4xl')).toBeInTheDocument();
    });

    it('should have responsive padding', () => {
      const { container } = render(<TermsPage />);

      expect(container.querySelector('.px-4')).toBeInTheDocument();
    });
  });
});
