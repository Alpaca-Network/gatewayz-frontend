"use client";

import { Suspense } from "react";
import { AuthGate } from "@/features/auth/AuthGate";
import { ChatExperience } from "@/features/chat/ChatExperience";
import { Loader2 } from "lucide-react";

function ChatShell() {
  return (
    <div className="container mx-auto px-4 py-6">
      <AuthGate title="Sign in to chat" description="We use Privy to keep your session and API key secure.">
        <ChatExperience />
      </AuthGate>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading chat…
        </div>
      }
    >
      <ChatShell />
    </Suspense>
  );
}

