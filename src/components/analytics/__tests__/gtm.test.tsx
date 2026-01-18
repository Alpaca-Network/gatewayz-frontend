import { render } from '@testing-library/react';
import { GTM } from '../gtm';
import { isTauriDesktop } from '@/lib/browser-detection';

// Mock browser-detection module
jest.mock('@/lib/browser-detection', () => ({
  isTauriDesktop: jest.fn(() => false),
}));

describe('GTM', () => {
  beforeEach(() => {
    // Reset mock to default (not Tauri)
    (isTauriDesktop as jest.Mock).mockReturnValue(false);
  });

  it('should render the GTM noscript element in web environment', () => {
    const { container } = render(<GTM />);
    const noscript = container.querySelector('noscript');
    // In JSDOM, noscript content is not rendered, but the element should exist
    expect(noscript).toBeInTheDocument();
  });

  it('should return null when running in Tauri desktop', () => {
    (isTauriDesktop as jest.Mock).mockReturnValue(true);
    const { container } = render(<GTM />);
    expect(container.firstChild).toBeNull();
  });

  it('should not render in desktop environment', () => {
    (isTauriDesktop as jest.Mock).mockReturnValue(true);
    const { container } = render(<GTM />);
    const noscript = container.querySelector('noscript');
    expect(noscript).not.toBeInTheDocument();
  });
});
