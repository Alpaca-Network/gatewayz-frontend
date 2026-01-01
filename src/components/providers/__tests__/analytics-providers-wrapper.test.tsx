import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock all provider dependencies
jest.mock('../statsig-provider', () => ({
  StatsigProviderWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="statsig-provider">{children}</div>
  ),
}));

jest.mock('../react-scan-provider', () => ({
  ReactScanProvider: () => <div data-testid="react-scan-provider" />,
}));

jest.mock('../../model-sync-initializer', () => ({
  ModelSyncInitializer: () => <div data-testid="model-sync-initializer" />,
}));

jest.mock('../posthog-provider', () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="posthog-provider">{children}</div>
  ),
  PostHogPageView: () => <div data-testid="posthog-pageview" />,
}));

// Mock next/dynamic to render components directly
jest.mock('next/dynamic', () => {
  return function dynamicMock(loader: () => Promise<{ default: React.ComponentType<any> }>) {
    // Create a wrapper component that returns null until loaded
    const DynamicComponent = (props: any) => {
      const [Component, setComponent] = React.useState<React.ComponentType<any> | null>(null);

      React.useEffect(() => {
        loader().then((mod) => {
          setComponent(() => mod.default);
        });
      }, []);

      if (!Component) return null;
      return <Component {...props} />;
    };

    return DynamicComponent;
  };
});

// Import after mocks are set up
import { AnalyticsProvidersWrapper } from '../analytics-providers-wrapper';

describe('AnalyticsProvidersWrapper', () => {
  it('should render children', async () => {
    render(
      <AnalyticsProvidersWrapper>
        <div data-testid="child">Test Child</div>
      </AnalyticsProvidersWrapper>
    );

    // Wait for dynamic imports to resolve
    const child = await screen.findByTestId('child');
    expect(child).toBeInTheDocument();
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('should include StatsigProviderWrapper', async () => {
    render(
      <AnalyticsProvidersWrapper>
        <div>Test</div>
      </AnalyticsProvidersWrapper>
    );

    const statsigProvider = await screen.findByTestId('statsig-provider');
    expect(statsigProvider).toBeInTheDocument();
  });

  it('should include PostHogProvider', async () => {
    render(
      <AnalyticsProvidersWrapper>
        <div>Test</div>
      </AnalyticsProvidersWrapper>
    );

    const posthogProvider = await screen.findByTestId('posthog-provider');
    expect(posthogProvider).toBeInTheDocument();
  });

  it('should include PostHogPageView', async () => {
    render(
      <AnalyticsProvidersWrapper>
        <div>Test</div>
      </AnalyticsProvidersWrapper>
    );

    const posthogPageView = await screen.findByTestId('posthog-pageview');
    expect(posthogPageView).toBeInTheDocument();
  });

  it('should include ReactScanProvider', async () => {
    render(
      <AnalyticsProvidersWrapper>
        <div>Test</div>
      </AnalyticsProvidersWrapper>
    );

    const reactScanProvider = await screen.findByTestId('react-scan-provider');
    expect(reactScanProvider).toBeInTheDocument();
  });

  it('should include ModelSyncInitializer', async () => {
    render(
      <AnalyticsProvidersWrapper>
        <div>Test</div>
      </AnalyticsProvidersWrapper>
    );

    const modelSyncInitializer = await screen.findByTestId('model-sync-initializer');
    expect(modelSyncInitializer).toBeInTheDocument();
  });

  it('should nest providers in correct order (Statsig -> PostHog -> children)', async () => {
    render(
      <AnalyticsProvidersWrapper>
        <div data-testid="child">Test</div>
      </AnalyticsProvidersWrapper>
    );

    // Wait for all providers to render
    const statsigProvider = await screen.findByTestId('statsig-provider');
    const posthogProvider = await screen.findByTestId('posthog-provider');
    const child = await screen.findByTestId('child');

    // Verify nesting: Statsig contains PostHog contains child
    expect(statsigProvider).toContainElement(posthogProvider);
    expect(posthogProvider).toContainElement(child);
  });

  describe('PostHog Integration (Regression Tests)', () => {
    // These tests ensure PostHog is never accidentally removed from the provider hierarchy
    // See: https://github.com/Alpaca-Network/gatewayz-frontend/pull/681

    it('REGRESSION: PostHogProvider must wrap application children', async () => {
      render(
        <AnalyticsProvidersWrapper>
          <div data-testid="app-content">App Content</div>
        </AnalyticsProvidersWrapper>
      );

      const posthogProvider = await screen.findByTestId('posthog-provider');
      const appContent = await screen.findByTestId('app-content');

      // PostHogProvider MUST contain the app content for analytics to work
      expect(posthogProvider).toContainElement(appContent);
    });

    it('REGRESSION: PostHogPageView must be present for page tracking', async () => {
      render(
        <AnalyticsProvidersWrapper>
          <div>Test</div>
        </AnalyticsProvidersWrapper>
      );

      // PostHogPageView MUST be rendered for automatic page view tracking
      const pageView = await screen.findByTestId('posthog-pageview');
      expect(pageView).toBeInTheDocument();
    });

    it('REGRESSION: PostHogPageView must be inside PostHogProvider', async () => {
      render(
        <AnalyticsProvidersWrapper>
          <div>Test</div>
        </AnalyticsProvidersWrapper>
      );

      const posthogProvider = await screen.findByTestId('posthog-provider');
      const pageView = await screen.findByTestId('posthog-pageview');

      // PostHogPageView must be inside PostHogProvider to access posthog instance
      expect(posthogProvider).toContainElement(pageView);
    });
  });
});
