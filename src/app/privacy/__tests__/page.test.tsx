import React from 'react';
import { render, screen } from '@testing-library/react';
import PrivacyPolicyPage from '../page';

describe('PrivacyPolicyPage', () => {
  describe('Page structure', () => {
    it('should render the page header', () => {
      render(<PrivacyPolicyPage />);

      expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
      expect(screen.getByText('Last updated: January 2026')).toBeInTheDocument();
    });

    it('should render all main sections', () => {
      render(<PrivacyPolicyPage />);

      expect(screen.getByText('1. Introduction')).toBeInTheDocument();
      expect(screen.getByText('2. Information We Collect')).toBeInTheDocument();
      expect(screen.getByText('3. How We Use Your Information')).toBeInTheDocument();
      expect(screen.getByText('4. Information Sharing')).toBeInTheDocument();
      expect(screen.getByText('5. Data Retention')).toBeInTheDocument();
      expect(screen.getByText('6. Data Security')).toBeInTheDocument();
      expect(screen.getByText('7. Your Rights')).toBeInTheDocument();
      expect(screen.getByText('8. Cookies and Tracking')).toBeInTheDocument();
      expect(screen.getByText('9. International Transfers')).toBeInTheDocument();
      expect(screen.getByText("10. Children's Privacy")).toBeInTheDocument();
      expect(screen.getByText('11. Changes to This Policy')).toBeInTheDocument();
      expect(screen.getByText('12. Contact Us')).toBeInTheDocument();
    });

    it('should render subsections for information collection', () => {
      render(<PrivacyPolicyPage />);

      expect(screen.getByText('2.1 Account Information')).toBeInTheDocument();
      expect(screen.getByText('2.2 Usage Data')).toBeInTheDocument();
      expect(screen.getByText('2.3 Content Data')).toBeInTheDocument();
    });
  });

  describe('Content display', () => {
    it('should render introduction content', () => {
      render(<PrivacyPolicyPage />);

      expect(
        screen.getByText(/Gatewayz .* is committed to protecting your privacy/)
      ).toBeInTheDocument();
    });

    it('should render account information items', () => {
      render(<PrivacyPolicyPage />);

      expect(screen.getByText('Email address')).toBeInTheDocument();
      expect(screen.getByText('Name (optional)')).toBeInTheDocument();
      expect(screen.getByText('Authentication credentials')).toBeInTheDocument();
    });

    it('should render usage data items', () => {
      render(<PrivacyPolicyPage />);

      expect(screen.getByText(/API request logs/)).toBeInTheDocument();
      expect(screen.getByText(/Token usage and model selection/)).toBeInTheDocument();
      expect(screen.getByText(/Device and browser information/)).toBeInTheDocument();
    });

    it('should render data security measures', () => {
      render(<PrivacyPolicyPage />);

      expect(screen.getByText('Encryption in transit and at rest')).toBeInTheDocument();
      expect(screen.getByText('Access controls and authentication')).toBeInTheDocument();
      expect(screen.getByText('Regular security assessments')).toBeInTheDocument();
    });

    it('should render user rights', () => {
      render(<PrivacyPolicyPage />);

      expect(screen.getByText('Access your personal information')).toBeInTheDocument();
      expect(screen.getByText('Correct inaccurate data')).toBeInTheDocument();
      expect(screen.getByText('Request deletion of your data')).toBeInTheDocument();
      expect(screen.getByText('Data portability')).toBeInTheDocument();
    });

    it('should state that personal information is not sold', () => {
      render(<PrivacyPolicyPage />);

      expect(
        screen.getByText(/We do not sell your personal information to third parties/)
      ).toBeInTheDocument();
    });

    it('should state minimum age requirement', () => {
      render(<PrivacyPolicyPage />);

      expect(
        screen.getByText(/The Service is not intended for users under 18 years of age/)
      ).toBeInTheDocument();
    });
  });

  describe('Contact information', () => {
    it('should render privacy contact email link', () => {
      render(<PrivacyPolicyPage />);

      const emailLinks = screen.getAllByText('privacy@gatewayz.ai');
      expect(emailLinks.length).toBeGreaterThanOrEqual(1);
      expect(emailLinks[0]).toHaveAttribute('href', 'mailto:privacy@gatewayz.ai');
    });

    it('should render support contact email link', () => {
      render(<PrivacyPolicyPage />);

      const emailLink = screen.getByText('support@gatewayz.ai');
      expect(emailLink).toBeInTheDocument();
      expect(emailLink).toHaveAttribute('href', 'mailto:support@gatewayz.ai');
    });
  });

  describe('Styling', () => {
    it('should have proper page background', () => {
      const { container } = render(<PrivacyPolicyPage />);

      expect(container.querySelector('.bg-background')).toBeInTheDocument();
    });

    it('should have max-width container', () => {
      const { container } = render(<PrivacyPolicyPage />);

      expect(container.querySelector('.max-w-4xl')).toBeInTheDocument();
    });

    it('should have responsive padding', () => {
      const { container } = render(<PrivacyPolicyPage />);

      expect(container.querySelector('.px-4')).toBeInTheDocument();
    });
  });
});
