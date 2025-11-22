import { test, expect } from './fixtures';

test.describe('Email Action Sign-in', () => {
  test('persists email session via token transfer', async ({ page }) => {
    const token = 'gw_temp_e2e_email_login_123';
    const userId = '777001';
    const email = 'automation-email@gatewayz.ai';
    const privyUserId = 'privy-e2e-automation-user';
    const displayName = 'Automation Email User';

    let userMeRequests = 0;

    await page.route('**/api/user/me', async (route) => {
      userMeRequests += 1;
      const headers = route.request().headers();
      expect(headers['authorization']).toBe(`Bearer ${token}`);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user_id: Number(userId),
          email,
          display_name: displayName,
          credits: 250,
          tier: 'pro',
          tier_display_name: 'Pro',
          auth_method: 'email_magic_link',
          privy_user_id: privyUserId,
          subscription_status: 'active',
          subscription_end_date: Math.floor(Date.now() / 1000) + 86400,
        }),
      });
    });

    const returnUrl = encodeURIComponent('/chat');
    await page.goto(`/chat?token=${token}&userId=${userId}&returnUrl=${returnUrl}&action=signin`);

    await expect(page).toHaveURL(/\/chat$/);

    await page.waitForFunction(
      ({ expectedEmail, expectedToken }) => {
        const apiKey = window.localStorage.getItem('gatewayz_api_key');
        const rawUser = window.localStorage.getItem('gatewayz_user_data');
        if (!apiKey || !rawUser) {
          return false;
        }

        try {
          const parsed = JSON.parse(rawUser);
          return (
            apiKey === expectedToken &&
            parsed.api_key === expectedToken &&
            parsed.email === expectedEmail
          );
        } catch (error) {
          console.error('failed to parse user data', error);
          return false;
        }
      },
      { expectedEmail: email, expectedToken: token },
      { timeout: 10000 }
    );

    const storedKey = await page.evaluate(() => localStorage.getItem('gatewayz_api_key'));
    expect(storedKey).toBe(token);

    const storedUser = await page.evaluate(() => {
      const raw = localStorage.getItem('gatewayz_user_data');
      return raw ? JSON.parse(raw) : null;
    });

    expect(storedUser).not.toBeNull();
    expect(storedUser.email).toBe(email);
    expect(storedUser.display_name).toBe(displayName);
    expect(storedUser.credits).toBe(250);
    expect(storedUser.tier).toBe('pro');

    const sessionTransferRaw = await page.evaluate(() => sessionStorage.getItem('gatewayz_session_transfer_token'));
    expect(sessionTransferRaw).not.toBeNull();

    const sessionTransfer = sessionTransferRaw ? JSON.parse(sessionTransferRaw) : null;
    expect(sessionTransfer?.token).toBe(token);
    expect(sessionTransfer?.userId).toBe(String(userId));

    expect(userMeRequests).toBe(1);
  });
});
