/**
 * Authentication Error Flow Integration Tests
 *
 * Tests error handling for authentication flows including:
 * - Sign-in timeouts
 * - Invalid hook calls
 * - Storage access denied
 * - Provider initialization failures
 *
 * Related PRs: #650, #652, #653
 */

describe('Authentication Error Flows', () => {
  beforeEach(() => {
    // Clear auth state before each test
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  describe('Sign-in Flow Error Handling', () => {
    it('handles sign-in timeout gracefully', () => {
      // Mock backend API to timeout
      cy.intercept('POST', '**/api/auth', {
        delay: 35000, // Longer than timeout
        statusCode: 504,
        body: { error: 'Gateway Timeout' },
      }).as('authTimeout');

      cy.visit('/');
      cy.get('[data-testid="sign-in-button"]').click();

      // Wait for timeout
      cy.wait('@authTimeout', { timeout: 40000 });

      // Verify error message is shown
      cy.contains('Sign-in timed out').should('be.visible');

      // Verify user is not authenticated
      cy.get('[data-testid="user-menu"]').should('not.exist');

      // Verify error is logged (check console)
      cy.window().then((win) => {
        expect(win.console.error).to.be.called;
      });
    });

    it('handles backend auth failure with proper error message', () => {
      cy.intercept('POST', '**/api/auth', {
        statusCode: 401,
        body: { error: 'Invalid credentials' },
      }).as('authFail');

      cy.visit('/');
      cy.get('[data-testid="sign-in-button"]').click();

      cy.wait('@authFail');

      // Verify error message
      cy.contains('Authentication failed').should('be.visible');

      // Verify user can retry
      cy.get('[data-testid="sign-in-button"]').should('be.enabled');
    });

    it('logs timing metrics for successful auth', () => {
      cy.intercept('POST', '**/api/auth', {
        statusCode: 200,
        body: {
          success: true,
          user_id: 123,
          api_key: 'test_key',
          email: 'test@example.com',
        },
      }).as('authSuccess');

      cy.visit('/');
      cy.get('[data-testid="sign-in-button"]').click();

      cy.wait('@authSuccess');

      // Verify auth success
      cy.get('[data-testid="user-menu"]').should('be.visible');

      // Check that timing logs were created
      cy.window().then((win) => {
        const consoleLog = cy.spy(win.console, 'log');
        expect(consoleLog).to.be.calledWith(
          Cypress.sinon.match(/Backend auth response received/)
        );
      });
    });
  });

  describe('Storage Access Error Handling (PR #650)', () => {
    it('handles localStorage access denied gracefully', () => {
      // Mock localStorage to throw error
      cy.visit('/', {
        onBeforeLoad(win) {
          const originalSetItem = win.localStorage.setItem;
          cy.stub(win.localStorage, 'setItem').callsFake((key, value) => {
            if (key === 'gatewayz_api_key') {
              throw new Error('Access is denied for this document');
            }
            return originalSetItem.call(win.localStorage, key, value);
          });
        },
      });

      // Verify error doesn't crash the app
      cy.get('body').should('be.visible');

      // Verify error is filtered (not sent to Sentry)
      cy.window().then((win) => {
        expect(win.console.debug).to.be.calledWith(
          Cypress.sinon.match(/localStorage.*access denied/)
        );
      });
    });

    it('shows storage disabled notice when storage is blocked', () => {
      cy.visit('/', {
        onBeforeLoad(win) {
          // Simulate complete storage blocking
          Object.defineProperty(win, 'localStorage', {
            get() {
              throw new Error('localStorage is not available');
            },
          });
        },
      });

      // Verify notice is shown
      cy.contains('Storage is disabled').should('be.visible');
      cy.contains('enable cookies and local storage').should('be.visible');
    });
  });

  describe('Provider Initialization Error Handling (PR #650)', () => {
    it('handles Privy provider initialization with storage checking', () => {
      cy.visit('/');

      // Verify PrivyProvider renders during "checking" state
      // This tests that we don't get "Invalid hook call" errors
      cy.get('body').should('be.visible');

      // Wait for storage check to complete
      cy.wait(100);

      // Verify no console errors about hooks
      cy.window().then((win) => {
        expect(win.console.error).not.to.be.calledWith(
          Cypress.sinon.match(/Invalid hook call/)
        );
      });
    });

    it('always renders PrivyProvider to prevent hook violations', () => {
      let providerRendered = false;

      cy.visit('/', {
        onBeforeLoad(win) {
          // Spy on React.createElement to detect provider rendering
          const originalCreateElement = win.React?.createElement;
          if (originalCreateElement) {
            cy.stub(win.React, 'createElement').callsFake((...args: any[]) => {
              if (args[0]?.name === 'PrivyProviderNoSSR') {
                providerRendered = true;
              }
              return (originalCreateElement as any).apply(win.React, args);
            });
          }
        },
      });

      cy.wrap(null).then(() => {
        expect(providerRendered).to.be.true;
      });
    });
  });

  describe('Privy Origin Configuration (PR #653)', () => {
    it('handles Privy iframe origin errors', () => {
      // Mock Privy iframe error
      cy.visit('/', {
        onBeforeLoad(win) {
          win.addEventListener('error', (event) => {
            if (event.message.includes('origin not allowed')) {
              event.preventDefault(); // Prevent error from propagating
            }
          });
        },
      });

      // Verify error is filtered
      cy.window().then((win) => {
        expect(win.console.debug).to.be.calledWith(
          Cypress.sinon.match(/Privy iframe.*origin/)
        );
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('recovers from network errors with retry', () => {
      let attemptCount = 0;

      cy.intercept('POST', '**/api/auth', (req) => {
        attemptCount++;
        if (attemptCount === 1) {
          req.reply({
            statusCode: 500,
            body: { error: 'Internal server error' },
          });
        } else {
          req.reply({
            statusCode: 200,
            body: {
              success: true,
              user_id: 123,
              api_key: 'test_key',
            },
          });
        }
      }).as('authWithRetry');

      cy.visit('/');
      cy.get('[data-testid="sign-in-button"]').click();

      // Wait for retry
      cy.wait('@authWithRetry');
      cy.wait('@authWithRetry');

      // Verify eventual success
      cy.get('[data-testid="user-menu"]').should('be.visible');
    });

    it('maintains auth state across page reloads', () => {
      // Set up authenticated state
      cy.window().then((win) => {
        win.localStorage.setItem('gatewayz_api_key', 'test_key_123');
        win.localStorage.setItem('gatewayz_user_data', JSON.stringify({
          user_id: 123,
          email: 'test@example.com',
        }));
      });

      cy.visit('/');

      // Verify auth persists
      cy.get('[data-testid="user-menu"]').should('be.visible');

      // Reload page
      cy.reload();

      // Verify auth still persists
      cy.get('[data-testid="user-menu"]').should('be.visible');
    });
  });

  describe('Error Logging and Observability (PR #652)', () => {
    it('logs structured error data for debugging', () => {
      cy.intercept('POST', '**/api/auth', {
        statusCode: 500,
        body: { error: 'Backend error' },
      }).as('authError');

      cy.visit('/');
      cy.get('[data-testid="sign-in-button"]').click();

      cy.wait('@authError');

      // Verify structured logging
      cy.window().then((win) => {
        expect(win.console.error).to.be.calledWith(
          Cypress.sinon.match(/Backend auth failed/),
          Cypress.sinon.match.has('status', 500)
        );
      });
    });

    it('includes timing information in auth logs', () => {
      cy.intercept('POST', '**/api/auth', (req) => {
        req.reply({
          delay: 1000, // Add delay to measure
          statusCode: 200,
          body: {
            success: true,
            user_id: 123,
            api_key: 'test_key',
          },
        });
      }).as('authWithDelay');

      cy.visit('/');
      cy.get('[data-testid="sign-in-button"]').click();

      cy.wait('@authWithDelay');

      // Verify timing logs include duration
      cy.window().then((win) => {
        expect(win.console.log).to.be.calledWith(
          Cypress.sinon.match(/duration/i)
        );
      });
    });
  });
});
