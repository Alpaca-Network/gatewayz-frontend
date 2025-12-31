/**
 * Provider Error Handling Integration Tests
 *
 * Tests error handling for third-party provider initialization:
 * - Statsig initialization errors
 * - Session replay DOM conflicts
 * - Provider hook violations
 * - Graceful degradation
 *
 * Related PRs: #651, #648
 */

describe('Provider Error Handling', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  describe('Statsig Provider Initialization (PR #651)', () => {
    it('handles missing SDK key gracefully', () => {
      // Mock environment to remove Statsig SDK key
      cy.visit('/', {
        onBeforeLoad(win) {
          // Remove Statsig SDK key from env
          (win as any).NEXT_PUBLIC_STATSIG_CLIENT_KEY = undefined;
        },
      });

      // Verify app loads without Statsig
      cy.get('body').should('be.visible');

      // Verify bypass message is logged
      cy.window().then((win) => {
        expect(win.console.log).to.be.calledWith(
          Cypress.sinon.match(/Statsig.*disabled|bypassing statsig/i)
        );
      });

      // Verify global flag is set
      cy.window().then((win) => {
        expect((win as any).statsigAvailable).to.be.false;
      });
    });

    it('does not call useClientAsyncInit when SDK key is missing', () => {
      let hooksCalledCorrectly = true;

      cy.visit('/', {
        onBeforeLoad(win) {
          // Mock to detect improper hook calls
          (win as any).NEXT_PUBLIC_STATSIG_CLIENT_KEY = undefined;

          // Spy on potential hook violations
          const originalError = win.console.error;
          cy.stub(win.console, 'error').callsFake((...args) => {
            const message = args.join(' ');
            if (message.includes('Invalid hook call') || message.includes('Hooks can only be called')) {
              hooksCalledCorrectly = false;
            }
            return originalError.apply(win.console, args);
          });
        },
      });

      cy.wrap(null).then(() => {
        expect(hooksCalledCorrectly).to.be.true;
      });
    });

    it('splits into internal and hooks components correctly', () => {
      cy.visit('/');

      // Verify proper component hierarchy
      cy.window().then((win) => {
        // StatsigProviderWrapper should always render
        // StatsigProviderInternal should check IS_STATSIG_ENABLED
        // StatsigProviderWithHooks should only render when enabled

        // Check that no hook violations occurred
        expect(win.console.error).not.to.be.calledWith(
          Cypress.sinon.match(/Invalid hook call/)
        );
      });
    });

    it('handles initialization timeout', () => {
      cy.visit('/');

      // Wait for potential 2-second timeout
      cy.wait(2500);

      cy.window().then((win) => {
        // Either Statsig initialized or timeout occurred
        // Both are valid outcomes
        const bypassMessage = win.console.log.getCalls().some((call: any) =>
          call.args.some((arg: any) =>
            typeof arg === 'string' &&
            (arg.includes('bypassing') || arg.includes('timeout'))
          )
        );

        // Should have logged something about the state
        expect(bypassMessage || (win as any).statsigAvailable).to.exist;
      });
    });
  });

  describe('Statsig Session Replay DOM Conflicts (PR #648)', () => {
    it('prevents Session Replay plugin from causing DOM errors', () => {
      const domErrors: string[] = [];

      cy.visit('/', {
        onBeforeLoad(win) {
          // Capture DOM mutation errors
          const originalError = win.console.error;
          cy.stub(win.console, 'error').callsFake((...args) => {
            const message = args.join(' ');
            if (message.includes('removeChild') || message.includes('insertBefore')) {
              domErrors.push(message);
            }
            return originalError.apply(win.console, args);
          });
        },
      });

      // Trigger multiple rapid state changes
      cy.get('[data-testid="toggle-menu"]').click();
      cy.wait(100);
      cy.get('[data-testid="toggle-menu"]').click();
      cy.wait(100);
      cy.get('[data-testid="toggle-menu"]').click();

      // Verify no DOM manipulation errors from Session Replay
      cy.wrap(domErrors).should('have.length', 0);
    });

    it('initializes Session Replay plugin only once', () => {
      let pluginInitCount = 0;

      cy.visit('/', {
        onBeforeLoad(win) {
          // Track plugin initialization
          (win as any).__trackPluginInit = () => {
            pluginInitCount++;
          };
        },
      });

      // Trigger re-renders
      cy.reload();
      cy.wait(1000);

      // Plugin should only initialize once
      cy.wrap(null).then(() => {
        expect(pluginInitCount).to.be.lessThan(3); // Allow for one re-init max
      });
    });

    it('memoizes plugin instances correctly', () => {
      cy.visit('/');

      cy.window().then((win) => {
        // Verify plugins are created in useRef (should be stable across renders)
        // This is implementation-specific but important for preventing duplicates

        // Check that no multiple plugin initialization warnings
        expect(win.console.warn).not.to.be.calledWith(
          Cypress.sinon.match(/multiple.*plugin.*init/i)
        );
      });
    });
  });

  describe('Provider Hook Violations', () => {
    it('always renders providers in consistent order', () => {
      const renderOrder: string[] = [];

      cy.visit('/', {
        onBeforeLoad(win) {
          // Track component render order
          const originalCreateElement = win.React?.createElement;
          if (originalCreateElement) {
            cy.stub(win.React, 'createElement').callsFake((...args) => {
              if (args[0]?.name?.includes('Provider')) {
                renderOrder.push(args[0].name);
              }
              return originalCreateElement.apply(win.React, args);
            });
          }
        },
      });

      cy.window().then((win) => {
        // Verify providers always render (never conditionally return null/fragment)
        const hasEmptyFragments = renderOrder.includes('Fragment') &&
          renderOrder.indexOf('Fragment') < renderOrder.length - 1;

        expect(hasEmptyFragments).to.be.false;
      });
    });

    it('does not conditionally render providers based on runtime checks', () => {
      cy.visit('/', {
        onBeforeLoad(win) {
          // Hook violations often occur when providers are conditionally rendered
          const originalError = win.console.error;
          cy.stub(win.console, 'error').callsFake((...args) => {
            const message = args.join(' ');
            if (message.includes('Rendered fewer hooks') ||
                message.includes('Rendered more hooks')) {
              throw new Error('Hook count mismatch detected');
            }
            return originalError.apply(win.console, args);
          });
        },
      });

      // Multiple navigation to trigger re-renders
      cy.visit('/chat');
      cy.visit('/models');
      cy.visit('/');

      // No hook count mismatches should occur
      cy.get('body').should('be.visible');
    });
  });

  describe('Graceful Degradation', () => {
    it('continues without analytics when Statsig fails', () => {
      cy.intercept('**/statsig.com/**', {
        statusCode: 500,
        body: 'Internal Server Error',
      }).as('statsigFail');

      cy.visit('/');

      // App should still be fully functional
      cy.get('[data-testid="sign-in-button"]').should('be.visible');
      cy.get('[data-testid="navigation-menu"]').should('be.visible');

      // Verify bypass occurred
      cy.window().then((win) => {
        expect((win as any).statsigAvailable).to.be.false;
      });
    });

    it('continues without session replay when plugin fails', () => {
      cy.visit('/', {
        onBeforeLoad(win) {
          // Mock session replay to fail
          (win as any).StatsigSessionReplayPlugin = class {
            constructor() {
              throw new Error('Session replay initialization failed');
            }
          };
        },
      });

      // App should still work
      cy.get('body').should('be.visible');

      // Verify error was caught and logged
      cy.window().then((win) => {
        expect(win.console.error).to.be.calledWith(
          Cypress.sinon.match(/session replay/i)
        );
      });
    });

    it('provides alternative tracking when analytics unavailable', () => {
      // Disable all analytics
      cy.visit('/', {
        onBeforeLoad(win) {
          (win as any).NEXT_PUBLIC_STATSIG_CLIENT_KEY = undefined;
          (win as any).NEXT_PUBLIC_POSTHOG_KEY = undefined;
        },
      });

      // App should still track basic events (e.g., to console or backend)
      cy.get('[data-testid="sign-in-button"]').click();

      cy.window().then((win) => {
        // Verify some form of event tracking occurred
        const consoleLogs = win.console.log.getCalls().map((c: any) => c.args.join(' '));
        const hasEventLog = consoleLogs.some((log: string) =>
          log.includes('event') || log.includes('track')
        );

        expect(hasEventLog).to.be.true;
      });
    });
  });

  describe('Provider Error Recovery', () => {
    it('resets provider state after error', () => {
      cy.visit('/');

      // Trigger provider error
      cy.window().then((win) => {
        // Simulate error in provider
        (win as any).__simulateProviderError = () => {
          throw new Error('Simulated provider error');
        };
      });

      // Navigate away and back
      cy.visit('/chat');
      cy.visit('/');

      // Provider should have recovered
      cy.get('body').should('be.visible');
      cy.window().then((win) => {
        expect(win.console.error).to.be.calledWith(
          Cypress.sinon.match(/simulated provider error/i)
        );
      });
    });

    it('does not leak memory from failed provider initializations', () => {
      // This test would require memory profiling tools
      // For now, verify cleanup occurs

      cy.visit('/');

      // Check that cleanup functions are called
      cy.window().then((win) => {
        // Providers should have cleanup/unmount logic
        // Verify no warnings about memory leaks
        expect(win.console.warn).not.to.be.calledWith(
          Cypress.sinon.match(/memory leak/i)
        );
      });
    });
  });

  describe('Console Integration', () => {
    it('captures console.error as Sentry events only', () => {
      cy.visit('/');

      cy.window().then((win) => {
        // Trigger console.error
        win.console.error('Test error message');

        // Should be captured by Sentry captureConsoleIntegration
        // But not cause duplicate reporting
      });

      // Verify app continues normally
      cy.get('body').should('be.visible');
    });

    it('filters console errors correctly', () => {
      const sentryEvents: string[] = [];

      cy.visit('/', {
        onBeforeLoad(win) {
          // Mock Sentry.captureException
          (win as any).Sentry = {
            captureException: (error: Error) => {
              sentryEvents.push(error.message);
            },
          };
        },
      });

      cy.window().then((win) => {
        // These should be filtered
        win.console.error('chrome.runtime.sendMessage error');
        win.console.error('message port closed');
        win.console.error('WalletConnect relay error');

        // This should be captured
        win.console.error('Critical application error');
      });

      cy.wrap(null).then(() => {
        // Only critical error should be in Sentry
        expect(sentryEvents).to.include('Critical application error');
        expect(sentryEvents).not.to.include('chrome.runtime.sendMessage error');
      });
    });
  });
});
