"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { saveUserData, getUserData } from '@/lib/api';
import type { UserData } from '@/lib/api';
import { CreditsDisplay } from '@/components/layout/credits-display';

/**
 * Test Page for Tier Display
 *
 * This page allows manual testing of the CreditsDisplay component
 * by simulating different user tier scenarios.
 *
 * Access at: http://localhost:3000/test-tier-display
 */
export default function TestTierDisplayPage() {
  const [currentUserData, setCurrentUserData] = useState<UserData | null>(getUserData());
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 20));
  };

  const setTestUser = (tier: 'basic' | 'pro' | 'max', credits: number) => {
    const userData: UserData = {
      user_id: 999,
      api_key: `test-${tier}-key`,
      auth_method: 'email',
      privy_user_id: `test-${tier}-user`,
      display_name: `Test ${tier.toUpperCase()} User`,
      email: `${tier}@test.com`,
      credits,
      tier,
      subscription_status: tier !== 'basic' ? 'active' : undefined,
    };

    saveUserData(userData);
    setCurrentUserData(userData);
    addLog(`Set ${tier.toUpperCase()} tier user with ${credits} credits`);

    // Trigger storage event to update CreditsDisplay
    window.dispatchEvent(new Event('storage'));
  };

  const testUppercase = () => {
    const userData: UserData = {
      user_id: 999,
      api_key: 'test-uppercase-key',
      auth_method: 'email',
      privy_user_id: 'test-uppercase-user',
      display_name: 'Test UPPERCASE User',
      email: 'uppercase@test.com',
      credits: 5000,
      tier: 'PRO' as any, // Simulate backend sending uppercase
      subscription_status: 'active',
    };

    saveUserData(userData);
    setCurrentUserData(userData);
    addLog('Set UPPERCASE PRO tier (testing case sensitivity)');
    window.dispatchEvent(new Event('storage'));
  };

  const clearTestData = () => {
    localStorage.removeItem('gatewayz_user_data');
    localStorage.removeItem('gatewayz_api_key');
    setCurrentUserData(null);
    addLog('Cleared all test data');
    window.dispatchEvent(new Event('storage'));
  };

  const checkData = () => {
    const data = getUserData();
    setCurrentUserData(data);
    addLog(data ? `Current data: ${JSON.stringify(data)}` : 'No user data found');
  };

  return (
    <div className="container mx-auto py-12 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Tier Display Test Page</h1>
        <p className="text-muted-foreground">
          Test the CreditsDisplay component with different tier scenarios
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column: Test Controls */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Scenarios</CardTitle>
              <CardDescription>
                Click a button to simulate different user tiers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold mb-2">Basic Tier (shows credits)</h3>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => setTestUser('basic', 0)} variant="outline" size="sm">
                    0 credits
                  </Button>
                  <Button onClick={() => setTestUser('basic', 100)} variant="outline" size="sm">
                    100 credits
                  </Button>
                  <Button onClick={() => setTestUser('basic', 1000)} variant="outline" size="sm">
                    1,000 credits
                  </Button>
                  <Button onClick={() => setTestUser('basic', 50000)} variant="outline" size="sm">
                    50,000 credits
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">PRO Tier (shows badge)</h3>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => setTestUser('pro', 5000)} variant="outline" size="sm">
                    PRO with 5k credits
                  </Button>
                  <Button onClick={() => setTestUser('pro', 0)} variant="outline" size="sm">
                    PRO with 0 credits
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">MAX Tier (shows badge)</h3>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => setTestUser('max', 15000)} variant="outline" size="sm">
                    MAX with 15k credits
                  </Button>
                  <Button onClick={() => setTestUser('max', 0)} variant="outline" size="sm">
                    MAX with 0 credits
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Edge Cases</h3>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={testUppercase} variant="outline" size="sm">
                    Uppercase PRO
                  </Button>
                  <Button onClick={clearTestData} variant="destructive" size="sm">
                    Clear Data
                  </Button>
                  <Button onClick={checkData} variant="secondary" size="sm">
                    Check Current
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Component Preview</CardTitle>
              <CardDescription>
                This is how the component appears in the header
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center p-8 bg-muted rounded-lg">
                <CreditsDisplay />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Current State and Logs */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Current User Data</CardTitle>
              <CardDescription>
                Data stored in localStorage
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentUserData ? (
                <div className="space-y-2 text-sm font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span>{currentUserData.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Credits:</span>
                    <span>{currentUserData.credits.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tier:</span>
                    <span className="font-bold">
                      {currentUserData.tier?.toUpperCase() || 'undefined'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subscription:</span>
                    <span>{currentUserData.subscription_status || 'none'}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No user data in localStorage
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>
                Recent test actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-xs font-mono max-h-96 overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="text-muted-foreground">No activity yet</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="text-muted-foreground">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expected Behavior</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <strong>Basic Tier:</strong> Should show coin icon (🪙) with credit count
              </div>
              <div>
                <strong>PRO Tier:</strong> Should show crown icon (👑) with "PRO" text
              </div>
              <div>
                <strong>MAX Tier:</strong> Should show crown icon (👑) with "MAX" text
              </div>
              <div className="pt-2 border-t">
                <strong>Note:</strong> Check the browser console for detailed debugging logs
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="text-sm font-semibold mb-2">Instructions</h3>
        <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
          <li>Click a test scenario button above</li>
          <li>Check the "Current Component Preview" to see the result</li>
          <li>Open browser console (F12) to see debugging logs</li>
          <li>Check the header at the top of the page as well</li>
          <li>Test switching between different tiers to verify updates</li>
        </ol>
      </div>
    </div>
  );
}
