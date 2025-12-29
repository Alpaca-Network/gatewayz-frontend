'use client';

import { ExternalLink, Search, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResultItem {
  title: string;
  url: string;
  content: string;
  score?: number;
}

interface SearchResultsProps {
  /** The search query being executed */
  query?: string;
  /** Search results from Tavily */
  results?: SearchResultItem[];
  /** Whether a search is currently in progress */
  isSearching?: boolean;
  /** AI-generated answer summarizing results */
  answer?: string;
  /** Error message if search failed */
  error?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SearchResults component displays web search results inline in chat messages.
 * Shows a loading state while searching, and results with source links when complete.
 */
export function SearchResults({
  query,
  results,
  isSearching,
  answer,
  error,
  className,
}: SearchResultsProps) {
  // Searching state - show loading indicator
  if (isSearching) {
    return (
      <div
        className={cn(
          'mb-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-3',
          className
        )}
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Searching the web{query ? `: "${query}"` : '...'}</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={cn(
          'mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3',
          className
        )}
      >
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>Search failed: {error}</span>
        </div>
      </div>
    );
  }

  // No results state
  if (!results || results.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'mb-3 rounded-lg border border-muted-foreground/20 bg-muted/20 p-3',
        className
      )}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Search className="h-3 w-3" />
        <span>
          Found {results.length} result{results.length !== 1 ? 's' : ''} for &quot;{query}&quot;
        </span>
      </div>

      {/* AI-generated answer summary */}
      {answer && (
        <p className="mb-3 text-sm text-foreground/90">{answer}</p>
      )}

      {/* Source results - show top 3 */}
      <div className="space-y-2">
        {results.slice(0, 3).map((result, idx) => (
          <a
            key={idx}
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-md p-2 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-1.5 text-sm font-medium text-primary group-hover:underline">
              <span className="line-clamp-1">{result.title || 'Untitled'}</span>
              <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-50 group-hover:opacity-100" />
            </div>
            {result.content && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {result.content}
              </p>
            )}
            <span className="mt-1 block truncate text-xs text-muted-foreground/70">
              {new URL(result.url).hostname}
            </span>
          </a>
        ))}
      </div>

      {/* Show more link if there are additional results */}
      {results.length > 3 && (
        <div className="mt-2 text-xs text-muted-foreground">
          + {results.length - 3} more result{results.length - 3 !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

export default SearchResults;
