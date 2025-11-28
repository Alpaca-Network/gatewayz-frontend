import { ModelSelect } from '../model-select';

// Test the component exports correctly
describe('ModelSelect', () => {
  it('should be defined and exportable', () => {
    expect(ModelSelect).toBeDefined();
    expect(typeof ModelSelect).toBe('function');
  });

  describe('Component interface', () => {
    it('should be a valid React component', () => {
      // React components are functions
      expect(typeof ModelSelect).toBe('function');
    });
  });
});
