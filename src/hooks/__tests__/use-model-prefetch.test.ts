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
