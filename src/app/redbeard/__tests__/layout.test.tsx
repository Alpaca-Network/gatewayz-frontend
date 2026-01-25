import React from 'react';
import { render, screen } from '@testing-library/react';
import RedbeardLayout from '../layout';

describe('RedbeardLayout', () => {
  it('should render children', () => {
    render(
      <RedbeardLayout>
        <div data-testid="child">Child content</div>
      </RedbeardLayout>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should render as a fragment (no wrapper element)', () => {
    const { container } = render(
      <RedbeardLayout>
        <div data-testid="child">Content</div>
      </RedbeardLayout>
    );

    // The layout uses a fragment, so the child should be directly in the container
    expect(container.firstChild).toHaveAttribute('data-testid', 'child');
  });
});
