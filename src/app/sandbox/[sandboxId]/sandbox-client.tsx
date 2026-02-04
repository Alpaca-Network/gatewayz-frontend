"use client";

import {Sandbox} from "@sampleapp.ai/sdk";
import {getApiKey} from "@/lib/api";
import {useState, useEffect} from "react";
import {AlertCircle} from "lucide-react";

interface SandboxClientProps {
  sandboxId: string;
}

export function SandboxClient({sandboxId}: SandboxClientProps) {
  const [userApiKey, setUserApiKey] = useState<string>("");
  const sampleappApiKey = process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY;

  // Load API key on client-side only to avoid hydration mismatch
  useEffect(() => {
    const apiKey = getApiKey();
    setUserApiKey(apiKey || "");
  }, []);

  if (!sampleappApiKey) {
    return (
      <div className="flex-1 w-full h-full min-h-0 flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sandbox Not Configured</h2>
          <p className="text-muted-foreground">
            The sandbox feature requires a SampleApp API key. Please configure
            the <code className="bg-muted px-1 py-0.5 rounded text-sm">NEXT_PUBLIC_SAMPLEAPP_API_KEY</code> environment
            variable to enable this feature.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full min-h-0 overflow-auto">
      <Sandbox
        apiKey={sampleappApiKey}
        sandboxId={sandboxId}
        env={{
          GATEWAYZ_API_KEY: userApiKey,
          GATEWAYZ_API_BASE_URL: "https://api.gatewayz.ai",
        }}
      />
    </div>
  );
}
