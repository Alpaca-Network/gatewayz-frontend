"use client";

import {SandboxHome} from "@sampleapp.ai/sdk";

export default function SandboxPage() {
  const apiKey = process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY || "";

  return (
    <SandboxHome
      apiKey={apiKey}
      orgid="gatewayz"
    />
  );
}
