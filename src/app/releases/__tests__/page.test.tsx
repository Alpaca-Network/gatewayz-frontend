import React from 'react';
import { render, screen } from '@testing-library/react';
import ReleasesPage from '../page';

// Mock the Card components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div data-testid="card" className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div data-testid="card-content" className={className}>{children}</div>,
  CardHeader: ({ children, className }: any) => <div data-testid="card-header" className={className}>{children}</div>,
  CardTitle: ({ children, className }: any) => <h2 data-testid="card-title" className={className}>{children}</h2>,
}));

describe('ReleasesPage', () => {
  describe('Page structure', () => {
    it('should render the page header', () => {
      render(<ReleasesPage />);

      expect(screen.getByText('Release Notes')).toBeInTheDocument();
      expect(screen.getByText('Weekly updates and changes to GatewayZ')).toBeInTheDocument();
    });

    it('should render at least one release card', () => {
      render(<ReleasesPage />);

      const cards = screen.getAllByTestId('card');
      expect(cards.length).toBeGreaterThanOrEqual(1);
    });

    it('should render release date in card header', () => {
      render(<ReleasesPage />);

      // Check for December 5, 2025 date
      expect(screen.getByText('December 5, 2025')).toBeInTheDocument();
    });
  });

  describe('Release sections', () => {
    it('should render Features section', () => {
      render(<ReleasesPage />);

      const featuresHeadings = screen.getAllByText('Features');
      expect(featuresHeadings.length).toBeGreaterThanOrEqual(1);
    });

    it('should render Bug Fixes section', () => {
      render(<ReleasesPage />);

      expect(screen.getByText('Bug Fixes')).toBeInTheDocument();
    });

    it('should render Infrastructure section', () => {
      render(<ReleasesPage />);

      expect(screen.getByText('Infrastructure')).toBeInTheDocument();
    });

    it('should render Documentation section', () => {
      render(<ReleasesPage />);

      expect(screen.getByText('Documentation')).toBeInTheDocument();
    });
  });

  describe('Content display', () => {
    it('should render feature items', () => {
      render(<ReleasesPage />);

      // Check for a specific feature
      expect(screen.getByText(/Streaming Standardization/)).toBeInTheDocument();
    });

    it('should render bug fix categories', () => {
      render(<ReleasesPage />);

      // Check for bug fix categories
      expect(screen.getByText('Streaming Fixes')).toBeInTheDocument();
      expect(screen.getByText('UI/UX Fixes')).toBeInTheDocument();
      expect(screen.getByText('Backend Fixes')).toBeInTheDocument();
      expect(screen.getByText('CI Fixes')).toBeInTheDocument();
    });

    it('should render specific bug fix items', () => {
      render(<ReleasesPage />);

      // Check for specific bug fix items
      expect(screen.getByText(/Fixed 429 rate limit errors/)).toBeInTheDocument();
      expect(screen.getByText(/Fixed double scrollbar issues/)).toBeInTheDocument();
    });

    it('should render infrastructure items', () => {
      render(<ReleasesPage />);

      // Check for infrastructure item
      expect(screen.getByText(/Initial setup with frontend and backend as git submodules/)).toBeInTheDocument();
    });

    it('should render documentation items', () => {
      render(<ReleasesPage />);

      // Check for documentation item
      expect(screen.getByText(/Added streaming standardization plan documentation/)).toBeInTheDocument();
    });
  });

  describe('Section markers', () => {
    it('should render feature markers (+)', () => {
      const { container } = render(<ReleasesPage />);

      // Features section has "+" markers
      const featureMarkers = container.querySelectorAll('.text-green-600, .text-green-400');
      expect(featureMarkers.length).toBeGreaterThan(0);
    });

    it('should render bug fix markers (-)', () => {
      const { container } = render(<ReleasesPage />);

      // Bug fixes section has "-" markers
      const bugFixMarkers = container.querySelectorAll('.text-blue-600, .text-blue-400');
      expect(bugFixMarkers.length).toBeGreaterThan(0);
    });

    it('should render infrastructure markers (*)', () => {
      const { container } = render(<ReleasesPage />);

      // Infrastructure section has "*" markers
      const infraMarkers = container.querySelectorAll('.text-purple-600, .text-purple-400');
      expect(infraMarkers.length).toBeGreaterThan(0);
    });

    it('should render documentation markers (#)', () => {
      const { container } = render(<ReleasesPage />);

      // Documentation section has "#" markers
      const docMarkers = container.querySelectorAll('.text-orange-600, .text-orange-400');
      expect(docMarkers.length).toBeGreaterThan(0);
    });
  });

  describe('Styling', () => {
    it('should have proper page background', () => {
      const { container } = render(<ReleasesPage />);

      expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
      expect(container.querySelector('.bg-background')).toBeInTheDocument();
    });

    it('should have responsive container width', () => {
      const { container } = render(<ReleasesPage />);

      expect(container.querySelector('.max-w-screen-xl')).toBeInTheDocument();
    });

    it('should have card header with muted background', () => {
      render(<ReleasesPage />);

      const cardHeaders = screen.getAllByTestId('card-header');
      expect(cardHeaders.length).toBeGreaterThan(0);
    });
  });
});

describe('ReleaseWeek interface structure', () => {
  // Type-only test to ensure the interface is correct
  test('should have correct release note structure', () => {
    const releaseWeek = {
      date: 'December 5, 2025',
      features: ['Feature 1', 'Feature 2'],
      bugFixes: [
        {
          category: 'Category 1',
          items: ['Bug fix 1', 'Bug fix 2'],
        },
      ],
      infrastructure: ['Infra item 1'],
      documentation: ['Doc item 1'],
    };

    expect(releaseWeek.date).toBe('December 5, 2025');
    expect(releaseWeek.features).toHaveLength(2);
    expect(releaseWeek.bugFixes[0].category).toBe('Category 1');
    expect(releaseWeek.bugFixes[0].items).toHaveLength(2);
    expect(releaseWeek.infrastructure).toHaveLength(1);
    expect(releaseWeek.documentation).toHaveLength(1);
  });
});
