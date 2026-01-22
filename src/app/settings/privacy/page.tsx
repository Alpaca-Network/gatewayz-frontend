"use client";

import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Info, Loader2, Zap } from "lucide-react";
import Link from "next/link";
import { useGatewayzAuth } from "@/context/gatewayz-auth-context";
import { makeAuthenticatedRequest } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

const PrivacySettingRow = ({
  title,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  loading = false,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
}) => (
  <div className="flex items-start justify-between py-4">
    <div className="flex-1 pr-8">
      <h4 className="font-medium">{title}</h4>
      <p className="text-sm text-muted-foreground flex items-center gap-1">
        {description}
        <Info className="h-4 w-4" />
      </p>
    </div>
    <div className="flex items-center gap-2">
      {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled || loading}
      />
    </div>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="text-xl font-semibold mb-2">{title}</h3>
    <div className="divide-y divide-border">{children}</div>
  </div>
);

export default function PrivacyPage() {
  const { status, apiKey, privyReady, login } = useGatewayzAuth();
  const { toast } = useToast();

  // Cache settings state
  const [cacheEnabled, setCacheEnabled] = useState(false);
  const [cacheSystemEnabled, setCacheSystemEnabled] = useState(false);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Other privacy settings (local state for now - not persisted)
  const [enableTrainingPaid, setEnableTrainingPaid] = useState(false);
  const [enableLoggingPaid, setEnableLoggingPaid] = useState(false);
  const [enableTrainingFree, setEnableTrainingFree] = useState(true);
  const [enableLoggingFree, setEnableLoggingFree] = useState(false);
  const [analyticsCookies, setAnalyticsCookies] = useState(true);

  const isAuthLoading = !privyReady || status === "idle" || status === "authenticating";
  const isAuthenticated = status === "authenticated" && apiKey;

  // Load cache settings
  useEffect(() => {
    if (!isAuthenticated || settingsLoaded) return;

    const loadCacheSettings = async () => {
      try {
        const response = await makeAuthenticatedRequest(`${API_BASE_URL}/user/cache-settings`);
        if (response.ok) {
          const data = await response.json();
          setCacheEnabled(data.enable_butter_cache || false);
          setCacheSystemEnabled(data.system_enabled || false);
          setSettingsLoaded(true);
        }
      } catch (error) {
        console.error("Error loading cache settings:", error);
      }
    };

    loadCacheSettings();
  }, [isAuthenticated, settingsLoaded]);

  // Reset on logout
  useEffect(() => {
    if (!isAuthenticated) {
      setSettingsLoaded(false);
    }
  }, [isAuthenticated]);

  const handleCacheToggle = async (enabled: boolean) => {
    setCacheLoading(true);
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/user/cache-settings?enable_butter_cache=${enabled}`,
        { method: "PUT" }
      );

      if (response.ok) {
        setCacheEnabled(enabled);
        toast({
          title: enabled ? "Response caching enabled" : "Response caching disabled",
          description: enabled
            ? "Your API requests may now be cached to reduce costs and improve response times."
            : "Response caching has been turned off.",
        });
      } else {
        throw new Error("Failed to update cache settings");
      }
    } catch (error) {
      console.error("Error updating cache settings:", error);
      toast({
        title: "Failed to update setting",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setCacheLoading(false);
    }
  };

  // Show loading state while auth is in progress
  if (isAuthLoading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold">Privacy</h1>
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Connecting to your account...</span>
        </div>
      </div>
    );
  }

  // Show sign-in prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold">Privacy</h1>
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-muted-foreground">Please sign in to view your privacy settings.</p>
          <Button onClick={() => login()}>Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Privacy</h1>

      <Section title="Response Caching">
        <div className="flex items-start justify-between py-4">
          <div className="flex-1 pr-8">
            <h4 className="font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Enable LLM Response Caching
            </h4>
            <p className="text-sm text-muted-foreground mt-1">
              Cache identical LLM requests to reduce API costs by up to 50% and improve response times.
              Powered by <a href="https://butter.dev" target="_blank" rel="noopener noreferrer" className="text-primary underline">Butter.dev</a>.
            </p>
            {cacheEnabled && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Your prompts will be routed through Butter.dev&apos;s proxy for caching.
              </p>
            )}
            {!cacheSystemEnabled && settingsLoaded && (
              <p className="text-xs text-muted-foreground mt-2">
                Response caching is currently unavailable system-wide.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {cacheLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch
              checked={cacheEnabled}
              onCheckedChange={handleCacheToggle}
              disabled={cacheLoading || !cacheSystemEnabled}
            />
          </div>
        </div>
        {cacheEnabled && (
          <div className="pb-4">
            <p className="text-xs text-muted-foreground">
              View your cache performance and savings in{" "}
              <Link href="/settings/activity" className="text-primary underline">
                Activity
              </Link>.
            </p>
          </div>
        )}
      </Section>

      <Section title="Paid Models">
        <PrivacySettingRow
          title="Enable providers that may train on inputs"
          description="Control whether to enable paid providers that can anonymously use your data."
          checked={enableTrainingPaid}
          onCheckedChange={setEnableTrainingPaid}
        />
        <PrivacySettingRow
          title="Enable input/output logging"
          description="Store inputs & outputs with OpenRouter and get a 1% discount on all LLMs."
          checked={enableLoggingPaid}
          onCheckedChange={setEnableLoggingPaid}
        />
      </Section>

      <Section title="Free Models">
        <PrivacySettingRow
          title="Enable training and logging (chatroom and API)"
          description="Enable free providers that may publish your prompts"
          checked={enableTrainingFree}
          onCheckedChange={setEnableTrainingFree}
        />
        <PrivacySettingRow
          title="Free endpoints may log, retain, or train on your prompts"
          description="You remain anonymous."
          checked={enableLoggingFree}
          onCheckedChange={setEnableLoggingFree}
        />
      </Section>

      <div>
        <h3 className="text-xl font-semibold mb-2">Chat History</h3>
        <p className="text-sm text-muted-foreground">
          Your chat history in the{" "}
          <Link href="#" className="text-primary underline">
            Chatroom
          </Link>{" "}
          is stored locally on your device. If logging is enabled, only LLM inputs and outputs are
          saved.
        </p>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-2">Analytics Cookies</h3>
        <div className="flex items-center justify-between py-4">
          <p className="text-sm text-muted-foreground flex-1 pr-8">
            Enable analytics cookies to help us improve the user experience and site performance.
          </p>
          <Switch checked={analyticsCookies} onCheckedChange={setAnalyticsCookies} />
        </div>
      </div>
    </div>
  );
}
