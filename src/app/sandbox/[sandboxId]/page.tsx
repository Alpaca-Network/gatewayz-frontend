"use client";

import {Sandbox} from "@sampleapp.ai/sdk";
import {getApiKey} from "@/lib/api";

export default async function SandboxPage({params}: {params: Promise<{sandboxId: string}>}) {
  const {sandboxId} = await params;
  const apiKey = getApiKey() || "";
  const {sandboxId} = params;
  return (
    <Sandbox
      apiKey={process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY!}
      sandboxId={sandboxId}
      env={{
        GATEWAYZ_API_KEY: apiKey,
        GATEWAYZ_API_BASE_URL: "https://api.gatewayz.ai",
      }}
    />
  );
}
