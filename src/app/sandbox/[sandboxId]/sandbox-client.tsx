"use client";

import {Sandbox} from "@sampleapp.ai/sdk";
import {getApiKey} from "@/lib/api";

interface SandboxClientProps {
  sandboxId: string;
}

export function SandboxClient({sandboxId}: SandboxClientProps) {
  const userApiKey = getApiKey() || "";
  const sampleappApiKey = process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY || "";

  return (
    <Sandbox
      apiKey={sampleappApiKey}
      sandboxId={sandboxId}
      env={{
        GATEWAYZ_API_KEY: userApiKey,
        GATEWAYZ_API_BASE_URL: "https://api.gatewayz.ai",
      }}
    />
  );
}
