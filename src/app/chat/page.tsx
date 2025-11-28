"use client";

import { Suspense, useEffect } from "react";
import { ChatLayout } from "@/components/chat-v2/ChatLayout";
import { FreeModelsBanner } from "@/components/chat/free-models-banner";
import { useAuth } from "@/hooks/use-auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { initializeReferralTracking } from "@/lib/referral";

// This page uses the v2 chat architecture (Zustand + React Query)
// located under src/components/chat-v2/.

export default function ChatPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  useEffect(() => {
    // Initialize referral tracking on page load
    initializeReferralTracking();
  }, []);

  // Show loading screen while auth is initializing
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner message="Initializing chat..." className="border-none bg-transparent" />
      </div>
    );
  }

  // Allow guest access - ChatLayout will handle guest mode
  return (
    <div className="flex flex-col h-[calc(100dvh-65px)] has-onboarding-banner:h-[calc(100dvh-115px)] md:h-[calc(100dvh-65px)] md:has-onboarding-banner:h-[calc(100dvh-115px)]">
      <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
        <FreeModelsBanner />
        <ChatLayout />
      </Suspense>
    </div>
  );
}
