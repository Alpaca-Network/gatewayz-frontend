/**
 * Auto-search detection hook
 *
 * Detects when a user's query likely needs real-time/current information
 * from the web, and determines if search should be auto-enabled.
 */

import { useCallback } from 'react';
import { ModelOption } from '@/components/chat/model-select';

// Keywords that strongly indicate need for current/real-time information
const SEARCH_KEYWORDS = [
  // Time-sensitive
  'latest', 'current', 'today', 'now', 'recent', 'new', 'just',
  'this week', 'this month', 'this year', 'yesterday', 'tomorrow',
  'right now', 'currently', 'at the moment', 'these days',
  // News and events
  'news', 'update', 'breaking', 'happening', 'announced', 'released',
  'headline', 'report', 'coverage',
  // Live data
  'price', 'stock', 'weather', 'forecast', 'score', 'results',
  'live', 'trending', 'popular', 'viral', 'rate', 'exchange',
  // Questions about current state
  'who won', 'what happened', 'who is', 'where is', 'how much',
  'is it', 'are there', 'did it', 'has it', 'what is happening',
  // Explicit search requests
  'search for', 'look up', 'find out', 'google', 'search the web',
  'search online', 'web search', 'find information',
  // Years (recent)
  '2024', '2025', '2026', '2027',
];

// Patterns for questions that typically need current information
const QUESTION_PATTERNS = [
  // "What is the current/latest..."
  /what('s| is| are) (the )?(current|latest|new)/i,
  // "Who won/is winning..."
  /who (won|is winning|will win|leads)/i,
  // "When did/will..." (event timing)
  /when (did|will|is|was|does)/i,
  // "How much does X cost/is X worth"
  /how much (does|is|will|did)/i,
  // "Is X available/open/happening"
  /is .+ (available|open|happening|live|released)/i,
  // "What happened to/with..."
  /what happened (to|with|in|at)/i,
  // Date references
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i,
];

// Topics that typically require current information
const CURRENT_INFO_TOPICS = [
  'cryptocurrency', 'bitcoin', 'ethereum', 'crypto',
  'stock market', 'nasdaq', 'dow jones', 's&p',
  'election', 'vote', 'ballot', 'campaign',
  'sports', 'game', 'match', 'tournament', 'championship',
  'concert', 'event', 'conference', 'festival',
  'release date', 'launch date', 'availability',
];

/**
 * Hook to detect if a query should auto-enable web search
 */
export function useAutoSearchDetection() {
  /**
   * Determines if web search should be auto-enabled based on the input
   *
   * @param input - The user's message/query
   * @param model - The selected model (no longer required for tool support check)
   * @param autoEnableSearch - User's preference for auto-detection
   * @returns boolean indicating if search should be auto-enabled
   */
  const shouldAutoEnableSearch = useCallback((
    input: string,
    model: ModelOption | null,
    autoEnableSearch: boolean
  ): boolean => {
    // Respect user preference
    if (!autoEnableSearch) {
      return false;
    }

    // No longer check for tool support - we support search augmentation for all models
    // Models with tool support use native tool calling, others use search augmentation

    // Skip very short queries (likely incomplete)
    if (input.length < 10) {
      return false;
    }

    const inputLower = input.toLowerCase();

    // Check for explicit search keywords
    for (const keyword of SEARCH_KEYWORDS) {
      if (inputLower.includes(keyword)) {
        return true;
      }
    }

    // Check for question patterns that typically need current info
    for (const pattern of QUESTION_PATTERNS) {
      if (pattern.test(input)) {
        return true;
      }
    }

    // Check for topics that typically need current information
    for (const topic of CURRENT_INFO_TOPICS) {
      if (inputLower.includes(topic)) {
        return true;
      }
    }

    return false;
  }, []);

  /**
   * Get a reason string for why search was auto-enabled
   * (useful for UI feedback)
   */
  const getAutoEnableReason = useCallback((input: string): string | null => {
    const inputLower = input.toLowerCase();

    // Check keywords
    for (const keyword of SEARCH_KEYWORDS) {
      if (inputLower.includes(keyword)) {
        return `Query contains "${keyword}"`;
      }
    }

    // Check patterns
    for (const pattern of QUESTION_PATTERNS) {
      if (pattern.test(input)) {
        return 'Query appears to need current information';
      }
    }

    // Check topics
    for (const topic of CURRENT_INFO_TOPICS) {
      if (inputLower.includes(topic)) {
        return `Query mentions "${topic}"`;
      }
    }

    return null;
  }, []);

  return {
    shouldAutoEnableSearch,
    getAutoEnableReason,
  };
}

export default useAutoSearchDetection;
