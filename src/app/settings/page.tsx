"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useToast } from "@/hooks/use-toast";
import { makeAuthenticatedRequest, getUserData } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";
import { models } from "@/lib/models-data";
import { X } from "lucide-react";

// Get unique providers from models data
const getUniqueProviders = () => {
  const providers = new Set<string>();
  models.forEach(model => {
    if (model.developer) {
      providers.add(model.developer);
    }
  });
  return Array.from(providers).sort();
};

export default function SettingsPage() {
  const router = useRouter();
  const { user } = usePrivy();
  const { toast } = useToast();

  // State management
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [lowBalanceNotifications, setLowBalanceNotifications] = useState(true);
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState(5.00);
  const [alwaysEnforce, setAlwaysEnforce] = useState(false);
  const [allowedProviders, setAllowedProviders] = useState<string[]>([]);
  const [ignoredProviders, setIgnoredProviders] = useState<string[]>([]);
  const [defaultProviderSort, setDefaultProviderSort] = useState("balanced");
  const [defaultModel, setDefaultModel] = useState("auto-router");
  const [saving, setSaving] = useState(false);

  const availableProviders = getUniqueProviders();

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);

      // Get user email from Privy
      if (user) {
        const email = user?.email?.address || user?.google?.email || user?.github?.email || "";
        setUserEmail(email);
      }

      // Wait for authentication if needed
      const userData = getUserData();
      if (!userData) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      try {
        // Fetch user settings from backend
        const response = await makeAuthenticatedRequest(`${API_BASE_URL}/user/settings`);
        if (response.ok) {
          const data = await response.json();

          // Populate settings from backend
          setLowBalanceNotifications(data.low_balance_notifications || false);
          setLowBalanceThreshold(data.low_balance_threshold || 5.00);
          setAlwaysEnforce(data.always_enforce_providers || false);
          setAllowedProviders(data.allowed_providers || []);
          setIgnoredProviders(data.ignored_providers || []);
          setDefaultProviderSort(data.default_provider_sort || "balanced");
          setDefaultModel(data.default_model || "auto-router");
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  const saveSettings = async () => {
    setSaving(true);

    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/user/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          low_balance_notifications: lowBalanceNotifications,
          always_enforce_providers: alwaysEnforce,
          allowed_providers: allowedProviders,
          ignored_providers: ignoredProviders,
          default_provider_sort: defaultProviderSort,
          default_model: defaultModel
        })
      });

      if (response.ok) {
        toast({ title: "Settings saved successfully" });
      } else {
        throw new Error("Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Failed to save settings",
        description: "Please try again later",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddAllowedProvider = (providerId: string) => {
    if (providerId && !allowedProviders.includes(providerId)) {
      setAllowedProviders([...allowedProviders, providerId]);
    }
  };

  const handleRemoveAllowedProvider = (providerId: string) => {
    setAllowedProviders(allowedProviders.filter(p => p !== providerId));
  };

  const handleAddIgnoredProvider = (providerId: string) => {
    if (providerId && !ignoredProviders.includes(providerId)) {
      setIgnoredProviders([...ignoredProviders, providerId]);
    }
  };

  const handleRemoveIgnoredProvider = (providerId: string) => {
    setIgnoredProviders(ignoredProviders.filter(p => p !== providerId));
  };

  if (loading) {
    return (
      <div className="flex-1 space-y-10">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      <SettingsSection
        title="Account"
        description="Manage your login credentials, security settings, or delete your account."
      >
        <Button variant="outline" onClick={() => router.push('/settings/account')}>
          Manage Account
        </Button>
      </SettingsSection>

      <SettingsSection
        title="Organization"
        description="Create and manage your organization."
      >
        <Button variant="outline" disabled>
          Create Organization
        </Button>
        <p className="text-xs text-muted-foreground mt-2">Coming soon</p>
      </SettingsSection>

      <Separator />

      <SettingsSection
        title="Low Balance Notifications"
        description="Send me emails"
        descriptionDetail={userEmail ? `Alert notifications will be sent to ${userEmail}` : "No email address found"}
      >
        <div className="space-y-2">
          <Switch
            checked={lowBalanceNotifications}
            onCheckedChange={setLowBalanceNotifications}
          />
          <p className="text-xs text-muted-foreground">
            You'll receive an email when your balance drops below ${lowBalanceThreshold.toFixed(2)}
          </p>
        </div>
      </SettingsSection>

      <Separator />

      <SettingsSection
        title="Allowed Providers"
        description="Select the providers you want to exclusively enable for your requests. Additional providers can be added on API requests via the 'only' field. Enabling Always enforce will ensure that only the providers you have explicitly allowed will be used."
      >
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Always enforce
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.064.293.006.399.287.47l.45.082.082-.38-.29-.071a.499.499 0 0 1-.288-.469l.738-3.468a.499.499 0 0 1 .469-.288zM8 5.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg>
          </label>
          <Switch
            checked={alwaysEnforce}
            onCheckedChange={setAlwaysEnforce}
          />
        </div>

        {allowedProviders.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {allowedProviders.map(provider => (
              <Badge key={provider} variant="secondary" className="capitalize">
                {provider.replace(/^@/, '')}
                <button
                  onClick={() => handleRemoveAllowedProvider(provider)}
                  className="ml-2 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <Select onValueChange={handleAddAllowedProvider}>
          <SelectTrigger className="w-full mt-4">
            <SelectValue placeholder="Select a provider to allow" />
          </SelectTrigger>
          <SelectContent>
            {availableProviders
              .filter(p => !allowedProviders.includes(p))
              .map(provider => (
                <SelectItem key={provider} value={provider} className="capitalize">
                  {provider}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-2">
          {allowedProviders.length === 0
            ? "No providers are specifically allowed. All non-ignored providers are used."
            : `${allowedProviders.length} provider${allowedProviders.length > 1 ? 's' : ''} allowed`
          }
        </p>
      </SettingsSection>

      <SettingsSection
        title="Ignored Providers"
        description="Select the providers you want to exclude from serving your requests."
      >
        {ignoredProviders.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {ignoredProviders.map(provider => (
              <Badge key={provider} variant="secondary" className="capitalize">
                {provider.replace(/^@/, '')}
                <button
                  onClick={() => handleRemoveIgnoredProvider(provider)}
                  className="ml-2 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <Select onValueChange={handleAddIgnoredProvider}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a provider to ignore" />
          </SelectTrigger>
          <SelectContent>
            {availableProviders
              .filter(p => !ignoredProviders.includes(p))
              .map(provider => (
                <SelectItem key={provider} value={provider} className="capitalize">
                  {provider}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-2">
          {ignoredProviders.length === 0
            ? "No providers are ignored."
            : `${ignoredProviders.length} provider${ignoredProviders.length > 1 ? 's' : ''} ignored`
          }
        </p>
      </SettingsSection>

      <Separator />

      <SettingsSection
        title="Default Provider Sort"
        description="Choose how providers should be sorted. Individual requests may still override this setting."
      >
        <Select value={defaultProviderSort} onValueChange={setDefaultProviderSort}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="balanced">Default (balanced)</SelectItem>
            <SelectItem value="cost">Cost</SelectItem>
            <SelectItem value="uptime">Uptime</SelectItem>
            <SelectItem value="latency">Latency</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-2">By default, Gatewayz balances low prices with high uptime.</p>
      </SettingsSection>

      <SettingsSection
        title="Default Model"
        description="Apps will use this model by default, but they may override it if they choose to do so. This model will also be used as your default fallback model."
      >
        <p className="text-xs text-muted-foreground mb-2">
          <Link href="/models" className="text-primary underline">Browse available models</Link> and prices.
        </p>
        <Select value={defaultModel} onValueChange={setDefaultModel}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto-router">Gatewayz Router</SelectItem>
            {models.slice(0, 20).map(model => (
              <SelectItem key={model.name} value={model.name}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsSection>

      <div className="flex justify-end pt-6">
        <Button onClick={saveSettings} disabled={saving} size="lg">
          {saving ? "Saving..." : "Save All Settings"}
        </Button>
      </div>
    </div>
  );
}

const SettingsSection = ({ title, description, descriptionDetail, children }: { title: string, description: string, descriptionDetail?: string, children: React.ReactNode }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div className="md:col-span-1">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      {descriptionDetail && <p className="text-sm text-muted-foreground mt-2">{descriptionDetail}</p>}
    </div>
    <div className="md:col-span-2">
      {children}
    </div>
  </div>
);
