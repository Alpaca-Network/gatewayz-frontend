import React from 'react';
import { render } from '@testing-library/react';

// Mock the client component
jest.mock('../not-found-client', () => ({
  __esModule: true,
  default: () => <div data-testid="not-found-client">NotFoundClient</div>,
}));

import NotFound, { metadata } from '../not-found';

describe('NotFound (Server Component)', () => {
  it('renders the NotFoundClient component', () => {
    const { getByTestId } = render(<NotFound />);
    expect(getByTestId('not-found-client')).toBeInTheDocument();
  });

  it('exports correct metadata title', () => {
    expect(metadata.title).toBe('404 - Page Not Found | Gatewayz');
  });

  it('exports correct metadata description', () => {
    expect(metadata.description).toContain('evolved beyond this URL');
    expect(metadata.description).toContain("Conway's Game of Life");
  });
});
