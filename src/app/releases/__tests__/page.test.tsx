import React from 'react';
import { render, screen } from '@testing-library/react';
import ReleasesPage, { metadata } from '../page';

// Mock the Card components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div data-testid="card" className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div data-testid="card-content" className={className}>{children}</div>,
  CardHeader: ({ children, className }: any) => <div data-testid="card-header" className={className}>{children}</div>,
  CardTitle: ({ children, className }: any) => <h2 data-testid="card-title" className={className}>{children}</h2>,
}));

describe('ReleasesPage', () => {
  describe('Page structure', () => {
    it('should render the changelog header', () => {
      render(<ReleasesPage />);

      expect(screen.getByRole('heading', { level: 1, name: 'Changelog' })).toBeInTheDocument();
    });

    it('should render one card per dated release, newest first', () => {
      render(<ReleasesPage />);

      const dates = screen.getAllByTestId('card-title').map((el) => el.textContent ?? '');
      expect(dates.length).toBeGreaterThanOrEqual(5);
      expect(dates[0]).toBe('September 15, 2026');

      const asTime = dates.map((d) => new Date(d).getTime());
      expect(asTime.every((t) => Number.isFinite(t))).toBe(true);
      const sortedDesc = [...asTime].sort((a, b) => b - a);
      expect(asTime).toEqual(sortedDesc);
    });

    it('should tag every entry', () => {
      render(<ReleasesPage />);

      // Each entry heading is an h3 preceded by a tag badge.
      const entryHeadings = screen.getAllByRole('heading', { level: 3 });
      expect(entryHeadings.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Content', () => {
    it('should document the machine-readable error contract', () => {
      render(<ReleasesPage />);

      expect(screen.getByText(/400 model_not_found/)).toBeInTheDocument();
      expect(screen.getByText(/402 request_cap_exhausted/)).toBeInTheDocument();
    });

    it('should record the streaming error event', () => {
      render(<ReleasesPage />);

      expect(
        screen.getByText(/A stream that fails upstream ends with an error event/)
      ).toBeInTheDocument();
    });

    it('should record resolution without substitution', () => {
      render(<ReleasesPage />);

      expect(screen.getByText(/never quietly swapped for a nearby model/)).toBeInTheDocument();
    });

    it('should link to the Learn hub', () => {
      render(<ReleasesPage />);

      const learnLink = screen.getByRole('link', { name: /Open the Learn hub/ });
      expect(learnLink).toHaveAttribute('href', 'https://www.gatewayz.ai/learn');
    });
  });

  describe('Public-safe copy', () => {
    // The changelog is public. These are the classes of detail that must never
    // reach it, whoever adds the next entry.
    const FORBIDDEN = [
      /\bPR\s*#?\d+/i,
      /#\d{2,}/,
      /\bSOC\s*2\b/i,
      /\bSLA\b/i,
      /\b\d+(\.\d+)?\s*%/,
      /\buptime\b/i,
      /\bvulnerabilit/i,
      /\bexploit/i,
      /\bCVE-/i,
      /\bsrc\//,
      /\.tsx?\b/,
      /\bcheaper\b/i,
      /\bbank-grade\b/i,
      /\bevery major (model|provider)\b/i,
    ];

    it('should not contain internal or unsourced detail', () => {
      const { container } = render(<ReleasesPage />);
      const text = container.textContent ?? '';

      for (const pattern of FORBIDDEN) {
        expect(text).not.toMatch(pattern);
      }
    });
  });

  describe('Metadata', () => {
    it('should describe the changelog', () => {
      expect(metadata.title).toBe('Changelog | Gatewayz');
      expect(metadata.description).toEqual(expect.stringContaining('newest first'));
      expect(metadata.alternates?.canonical).toBe('https://beta.gatewayz.ai/releases');
    });
  });
});
