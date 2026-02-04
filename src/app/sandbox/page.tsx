"use client";

import {SandboxHome} from "@sampleapp.ai/sdk";
import {AlertCircle} from "lucide-react";

export default function SandboxPage() {
  const apiKey = process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY;

  if (!apiKey) {
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
      <SandboxHome
        apiKey={apiKey}
        orgid="gatewayz"
      />
    </div>
  );
}
