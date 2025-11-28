import { useEagerModelPreload } from '../useEagerModelPreload';

// Test the hook exports correctly
describe('useEagerModelPreload', () => {
  it('should be defined and exportable', () => {
    expect(useEagerModelPreload).toBeDefined();
    expect(typeof useEagerModelPreload).toBe('function');
  });

  describe('Function signature', () => {
    it('should be a valid React hook (starts with use)', () => {
      expect(useEagerModelPreload.name).toBe('useEagerModelPreload');
    });
  });
});
