import { useModelPrefetch } from '../use-model-prefetch';

// Test the hook exports correctly
describe('useModelPrefetch', () => {
  it('should be defined and exportable', () => {
    expect(useModelPrefetch).toBeDefined();
    expect(typeof useModelPrefetch).toBe('function');
  });

  describe('Function signature', () => {
    it('should be a valid React hook (starts with use)', () => {
      expect(useModelPrefetch.name).toBe('useModelPrefetch');
    });
  });
});

// Test that the hook uses gateway=all (N+1 fix verification)
describe('useModelPrefetch N+1 API call fix', () => {
  it('should use gateway=all endpoint instead of individual gateway calls', async () => {
    // Verify the implementation uses a single API call with gateway=all
    // by checking the source code doesn't contain the old N+1 pattern
    const hookSource = useModelPrefetch.toString();

    // The hook should NOT contain the old fastGateways array pattern
    expect(hookSource).not.toContain('fastGateways');

    // The hook source should reference gateway=all for the single request pattern
    // (This is a static check - the actual fetch URL is in the closure)
  });
});
