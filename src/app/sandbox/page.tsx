"use client";

import {SandboxHome} from "@sampleapp.ai/sdk";

export default function SandboxPage() {
  const apiKey = process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY || "";

  return (
    <div className="flex-1 w-full h-full min-h-0 overflow-hidden">
      <SandboxHome
        apiKey={apiKey}
        orgid="gatewayz"
      />
    </div>
  );
}
