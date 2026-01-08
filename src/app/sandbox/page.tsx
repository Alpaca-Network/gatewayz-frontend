"use client";

import {SandboxHome} from "@sampleapp.ai/sdk";

export default function SandboxPage() {
  console.log(
    "process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY",
    process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY
  );
  return (
    <SandboxHome
      apiKey={process.env.NEXT_PUBLIC_SAMPLEAPP_API_KEY!}
      orgid="gatewayz"
    />
  );
}
