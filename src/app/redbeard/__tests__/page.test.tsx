import React from 'react';
import { render } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import RedbeardPage from '../page';
import { redbeardMetadata } from '../metadata';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockReplace = jest.fn();

describe('RedbeardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      replace: mockReplace,
    });
  });

  it('should redirect to home page on mount', () => {
    render(<RedbeardPage />);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('should render null (no visible content)', () => {
    const { container } = render(<RedbeardPage />);
    expect(container.firstChild).toBeNull();
  });
});

describe('redbeardMetadata', () => {
  it('should have correct title', () => {
    expect(redbeardMetadata.title).toBe('Red Beard Ventures Partnership | Gatewayz');
  });

  it('should have correct description', () => {
    expect(redbeardMetadata.description).toBe('Gatewayz x Red Beard Ventures - Strategic Partnership Announcement');
  });

  it('should have openGraph configuration', () => {
    expect(redbeardMetadata.openGraph).toBeDefined();
    expect(redbeardMetadata.openGraph?.title).toBe('Gatewayz x Red Beard Ventures - Strategic Partnership');
    expect(redbeardMetadata.openGraph?.url).toBe('https://www.gatewayz.ai/redbeard');
  });

  it('should have redbeard OG image configured', () => {
    const images = redbeardMetadata.openGraph?.images as Array<{ url: string }>;
    expect(images).toBeDefined();
    expect(images[0]?.url).toBe('/redbeard-og-image.png');
  });

  it('should have correct OG image dimensions', () => {
    const images = redbeardMetadata.openGraph?.images as Array<{ width: number; height: number }>;
    expect(images[0]?.width).toBe(1200);
    expect(images[0]?.height).toBe(630);
  });

  it('should have twitter card configuration', () => {
    expect(redbeardMetadata.twitter).toBeDefined();
    expect(redbeardMetadata.twitter?.card).toBe('summary_large_image');
    expect(redbeardMetadata.twitter?.title).toBe('Gatewayz x Red Beard Ventures - Strategic Partnership');
  });

  it('should have twitter image pointing to redbeard OG image', () => {
    const images = redbeardMetadata.twitter?.images as string[];
    expect(images).toContain('/redbeard-og-image.png');
  });

  it('should have twitter creator set', () => {
    expect(redbeardMetadata.twitter?.creator).toBe('@gatewayz_ai');
  });
});
