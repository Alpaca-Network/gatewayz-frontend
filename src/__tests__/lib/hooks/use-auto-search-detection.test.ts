/**
 * Tests for use-auto-search-detection hook
 *
 * Tests the auto-search detection logic that determines when
 * web search should be automatically enabled based on query content.
 */

import { renderHook } from '@testing-library/react';
import { useAutoSearchDetection } from '@/lib/hooks/use-auto-search-detection';
import { ModelOption } from '@/components/chat/model-select';

describe('useAutoSearchDetection', () => {
  const mockModelWithTools: ModelOption = {
    value: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'openai',
    providerId: 'openai',
    supportsTools: true,
  };

  const mockModelWithoutTools: ModelOption = {
    value: 'gpt-3.5-turbo',
    label: 'GPT-3.5 Turbo',
    provider: 'openai',
    providerId: 'openai',
    supportsTools: false,
  };

  describe('shouldAutoEnableSearch', () => {
    it('should return false when autoEnableSearch preference is false', () => {
      const { result } = renderHook(() => useAutoSearchDetection());

      const shouldEnable = result.current.shouldAutoEnableSearch(
        'What is the latest news about AI?',
        mockModelWithTools,
        false
      );

      expect(shouldEnable).toBe(false);
    });

    it('should return false when model does not support tools', () => {
      const { result } = renderHook(() => useAutoSearchDetection());

      const shouldEnable = result.current.shouldAutoEnableSearch(
        'What is the latest news about AI?',
        mockModelWithoutTools,
        true
      );

      expect(shouldEnable).toBe(false);
    });

    it('should return false when model is null', () => {
      const { result } = renderHook(() => useAutoSearchDetection());

      const shouldEnable = result.current.shouldAutoEnableSearch(
        'What is the latest news about AI?',
        null,
        true
      );

      expect(shouldEnable).toBe(false);
    });

    it('should return false for very short queries', () => {
      const { result } = renderHook(() => useAutoSearchDetection());

      const shouldEnable = result.current.shouldAutoEnableSearch(
        'Hi there',
        mockModelWithTools,
        true
      );

      expect(shouldEnable).toBe(false);
    });

    describe('keyword detection', () => {
      it.each([
        ['What is the latest version of React?', 'latest'],
        ['What is the current stock price of AAPL?', 'current'],
        ['What happened in the news today?', 'today'],
        ['What is trending on Twitter right now?', 'now'],
        ['Show me recent developments in AI research', 'recent'],
        ['What is new in TypeScript 5.0?', 'new'],
        ['Tell me about breaking news events', 'breaking'],
        ['What was just announced by Apple?', 'just'],
        ['What is the Bitcoin price today?', 'price'],
        ['What is the weather forecast for tomorrow?', 'forecast'],
        ['What are the live sports scores?', 'live'],
        ['What is trending on social media?', 'trending'],
        ['Tell me about events happening this week', 'this week'],
        ['What happened this month in tech?', 'this month'],
        ['What are 2025 predictions for AI?', '2025'],
        ['What are 2026 technology trends?', '2026'],
      ])('should detect query with keyword "%s" containing "%s"', (query, keyword) => {
        const { result } = renderHook(() => useAutoSearchDetection());

        const shouldEnable = result.current.shouldAutoEnableSearch(
          query,
          mockModelWithTools,
          true
        );

        expect(shouldEnable).toBe(true);
      });
    });

    describe('question pattern detection', () => {
      it.each([
        "What's the current state of the economy?",
        "What is the latest iPhone model?",
        'Who won the Super Bowl?',
        'Who is winning the election?',
        'When did the concert start?',
        'When will the new iPhone be released?',
        'How much does a Tesla Model 3 cost?',
        'How much is Bitcoin worth?',
        'Is the new game available yet?',
        'Is the restaurant open now?',
        'What happened to the stock market?',
        'What happened with the merger?',
      ])('should detect pattern in query "%s"', (query) => {
        const { result } = renderHook(() => useAutoSearchDetection());

        const shouldEnable = result.current.shouldAutoEnableSearch(
          query,
          mockModelWithTools,
          true
        );

        expect(shouldEnable).toBe(true);
      });
    });

    describe('topic detection', () => {
      it.each([
        'Tell me about Bitcoin investment strategies',
        'What should I know about cryptocurrency?',
        'How is the stock market performing?',
        'Tell me about the election results',
        'What is happening in the championship game?',
        'When is the concert happening?',
        'What is the release date for the new movie?',
      ])('should detect topic in query "%s"', (query) => {
        const { result } = renderHook(() => useAutoSearchDetection());

        const shouldEnable = result.current.shouldAutoEnableSearch(
          query,
          mockModelWithTools,
          true
        );

        expect(shouldEnable).toBe(true);
      });
    });

    describe('non-search queries', () => {
      it.each([
        'Explain how recursion works in programming',
        'Write a function to sort an array',
        'What is the difference between var and let?',
        'Help me understand closures in JavaScript',
        'Can you explain the concept of inheritance?',
        'Write a poem about nature',
        'Tell me a joke',
      ])('should not trigger search for query "%s"', (query) => {
        const { result } = renderHook(() => useAutoSearchDetection());

        const shouldEnable = result.current.shouldAutoEnableSearch(
          query,
          mockModelWithTools,
          true
        );

        expect(shouldEnable).toBe(false);
      });
    });
  });

  describe('getAutoEnableReason', () => {
    it('should return reason for keyword match', () => {
      const { result } = renderHook(() => useAutoSearchDetection());

      const reason = result.current.getAutoEnableReason(
        'What is the latest version of Node.js?'
      );

      expect(reason).toContain('latest');
    });

    it('should return reason for pattern match', () => {
      const { result } = renderHook(() => useAutoSearchDetection());

      // Use a query that matches pattern but doesn't contain keywords
      // "When was" matches /when (did|will|is|was|does)/i but doesn't contain search keywords
      const reason = result.current.getAutoEnableReason(
        'When was the building constructed?'
      );

      expect(reason).toBe('Query appears to need current information');
    });

    it('should return reason for topic match', () => {
      const { result } = renderHook(() => useAutoSearchDetection());

      const reason = result.current.getAutoEnableReason(
        'Tell me about Bitcoin mining'
      );

      expect(reason).toContain('bitcoin');
    });

    it('should return null for non-search queries', () => {
      const { result } = renderHook(() => useAutoSearchDetection());

      const reason = result.current.getAutoEnableReason(
        'Explain how to write a function'
      );

      expect(reason).toBeNull();
    });
  });
});
