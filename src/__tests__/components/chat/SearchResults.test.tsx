/**
 * Tests for SearchResults component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { SearchResults } from '@/components/chat/SearchResults';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ExternalLink: () => <span data-testid="external-link-icon" />,
  Search: () => <span data-testid="search-icon" />,
  Loader2: () => <span data-testid="loader-icon" />,
  AlertCircle: () => <span data-testid="alert-icon" />,
}));

describe('SearchResults Component', () => {
  describe('Loading State', () => {
    it('should show loading indicator when isSearching is true', () => {
      render(<SearchResults isSearching={true} query="test query" />);

      expect(screen.getByText(/Searching the web/i)).toBeInTheDocument();
      expect(screen.getByText(/"test query"/)).toBeInTheDocument();
    });

    it('should show generic loading text when no query provided', () => {
      render(<SearchResults isSearching={true} />);

      expect(screen.getByText(/Searching the web\.\.\./i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when error is provided', () => {
      render(<SearchResults error="API rate limit exceeded" />);

      expect(screen.getByText(/Search failed/i)).toBeInTheDocument();
      expect(screen.getByText(/API rate limit exceeded/)).toBeInTheDocument();
    });
  });

  describe('No Results State', () => {
    it('should return null when no results and not searching', () => {
      const { container } = render(<SearchResults />);

      expect(container.firstChild).toBeNull();
    });

    it('should return null when results array is empty', () => {
      const { container } = render(<SearchResults results={[]} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Results Display', () => {
    const mockResults = [
      {
        title: 'Result 1',
        url: 'https://example1.com/page',
        content: 'This is the first result content',
        score: 0.95,
      },
      {
        title: 'Result 2',
        url: 'https://example2.com/page',
        content: 'This is the second result content',
        score: 0.85,
      },
      {
        title: 'Result 3',
        url: 'https://example3.com/page',
        content: 'This is the third result content',
        score: 0.75,
      },
    ];

    it('should display result count and query', () => {
      render(<SearchResults query="test query" results={mockResults} />);

      expect(screen.getByText(/Found 3 results for/i)).toBeInTheDocument();
      expect(screen.getByText(/"test query"/)).toBeInTheDocument();
    });

    it('should display result titles and urls', () => {
      render(<SearchResults query="test" results={mockResults} />);

      expect(screen.getByText('Result 1')).toBeInTheDocument();
      expect(screen.getByText('Result 2')).toBeInTheDocument();
      expect(screen.getByText('Result 3')).toBeInTheDocument();

      // Check hostnames are displayed
      expect(screen.getByText('example1.com')).toBeInTheDocument();
      expect(screen.getByText('example2.com')).toBeInTheDocument();
    });

    it('should display result content snippets', () => {
      render(<SearchResults query="test" results={mockResults} />);

      expect(screen.getByText('This is the first result content')).toBeInTheDocument();
      expect(screen.getByText('This is the second result content')).toBeInTheDocument();
    });

    it('should render external links with correct attributes', () => {
      render(<SearchResults query="test" results={mockResults} />);

      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });

    it('should handle results without titles gracefully', () => {
      const resultsWithoutTitles = [
        { title: '', url: 'https://example.com', content: 'Content here' },
      ];

      render(<SearchResults query="test" results={resultsWithoutTitles} />);

      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });
  });

  describe('AI Answer Display', () => {
    it('should display AI-generated answer when provided', () => {
      const mockResults = [
        { title: 'Result 1', url: 'https://example.com', content: 'Content' },
      ];

      render(
        <SearchResults
          query="test"
          results={mockResults}
          answer="This is the AI-generated answer summary"
        />
      );

      expect(screen.getByText('This is the AI-generated answer summary')).toBeInTheDocument();
    });
  });

  describe('More Results Indicator', () => {
    it('should show more results indicator when more than 3 results', () => {
      const manyResults = [
        { title: 'Result 1', url: 'https://example1.com', content: 'Content 1' },
        { title: 'Result 2', url: 'https://example2.com', content: 'Content 2' },
        { title: 'Result 3', url: 'https://example3.com', content: 'Content 3' },
        { title: 'Result 4', url: 'https://example4.com', content: 'Content 4' },
        { title: 'Result 5', url: 'https://example5.com', content: 'Content 5' },
      ];

      render(<SearchResults query="test" results={manyResults} />);

      expect(screen.getByText(/\+ 2 more results/)).toBeInTheDocument();
    });

    it('should not show more results indicator for exactly 3 results', () => {
      const threeResults = [
        { title: 'Result 1', url: 'https://example1.com', content: 'Content 1' },
        { title: 'Result 2', url: 'https://example2.com', content: 'Content 2' },
        { title: 'Result 3', url: 'https://example3.com', content: 'Content 3' },
      ];

      render(<SearchResults query="test" results={threeResults} />);

      expect(screen.queryByText(/more result/)).not.toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('should apply custom className when provided', () => {
      const mockResults = [
        { title: 'Result', url: 'https://example.com', content: 'Content' },
      ];

      const { container } = render(
        <SearchResults query="test" results={mockResults} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
