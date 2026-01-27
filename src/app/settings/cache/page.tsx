"use client";

import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Info, Loader2, Zap, TrendingDown, Clock } from "lucide-react";
import Link from "next/link";
import { useGatewayzAuth } from "@/context/gatewayz-auth-context";
import { makeAuthenticatedRequest } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export default function CachePage() {
  const { status, apiKey, privyReady, login } = useGatewayzAuth();
  const { toast } = useToast();

  // Cache settings state
  const [cacheEnabled, setCacheEnabled] = useState(false);
  const [cacheSystemEnabled, setCacheSystemEnabled] = useState(false);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

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
          title: enabled ? "Prompt caching enabled" : "Prompt caching disabled",
          description: enabled
            ? "Your API requests will now be cached to reduce costs and improve response times."
            : "Prompt caching has been turned off.",
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || "Failed to update cache settings");
      }
    } catch (error) {
      console.error("Error updating cache settings:", error);
      const errorMessage = error instanceof Error ? error.message : "Please try again later";
      toast({
        title: "Failed to update setting",
        description: errorMessage,
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
        <h1 className="text-2xl font-bold">Prompt Cache</h1>
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
        <h1 className="text-2xl font-bold">Prompt Cache</h1>
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-muted-foreground">Please sign in to manage your cache settings.</p>
          <Button onClick={() => login()}>Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Prompt Cache</h1>
        <p className="text-muted-foreground mt-1">
          Reduce API costs and latency by caching identical LLM requests.
        </p>
      </div>

      {/* Main toggle card */}
      <div className="border rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-8">
            <h3 className="font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Enable LLM Response Caching
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              When enabled, identical requests are served from cache instead of making new API calls.
              Powered by{" "}
              <a
                href="https://butter.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Butter.dev
              </a>
              .
            </p>
            {!cacheSystemEnabled && settingsLoaded && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-3 flex items-center gap-1">
                <Info className="h-4 w-4" />
                Prompt caching is currently unavailable system-wide.
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
      </div>

      {/* Benefits section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Benefits</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-5 w-5 text-green-500" />
              <h4 className="font-medium">Reduce Costs</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Save up to 50% on API costs by serving repeated requests from cache instead of calling
              the LLM provider.
            </p>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <h4 className="font-medium">Faster Responses</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Cached responses are returned instantly, reducing latency from seconds to milliseconds
              for repeated queries.
            </p>
          </div>
        </div>
      </div>

      {/* How it works section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">How It Works</h3>
        <div className="text-sm text-muted-foreground space-y-3">
          <p>
            When you send an API request, Butter.dev checks if an identical request has been made
            recently. If a cached response exists, it&apos;s returned immediately without calling
            the LLM provider.
          </p>
          <p>
            Cache matching is based on the full request including model, messages, and parameters.
            Different parameters or slight prompt changes will result in new API calls.
          </p>
        </div>
      </div>

      {/* Privacy notice */}
      {cacheEnabled && (
        <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4">
          <h4 className="font-medium flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <Info className="h-4 w-4" />
            Privacy Notice
          </h4>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
            Your prompts are routed through Butter.dev&apos;s proxy for caching. Butter.dev uses
            prompts to identify caching patterns but does not store them long-term. See their{" "}
            <a
              href="https://butter.dev/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              privacy policy
            </a>{" "}
            for details.
          </p>
        </div>
      )}

      {/* Link to activity */}
      {cacheEnabled && (
        <p className="text-sm text-muted-foreground">
          View your cache performance and savings in{" "}
          <Link href="/settings/activity" className="text-primary underline">
            Activity
          </Link>
          .
        </p>
      )}
    </div>
  );
}
