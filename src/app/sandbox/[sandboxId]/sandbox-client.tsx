"use client";

import {Sandbox} from "@sampleapp.ai/sdk";
import {getApiKey} from "@/lib/api";
import {useState, useEffect} from "react";

interface SandboxClientProps {
  sandboxId: string;
}

export function SandboxClient({sandboxId}: SandboxClientProps) {
  const [userApiKey, setUserApiKey] = useState<string>("");
  const sampleappApiKey = process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY || "";

  // Load API key on client-side only to avoid hydration mismatch
  useEffect(() => {
    const apiKey = getApiKey();
    setUserApiKey(apiKey || "");
  }, []);

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
