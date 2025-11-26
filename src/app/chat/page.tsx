"use client";

import { Suspense } from "react";
import { ChatLayout } from "@/components/chat-v2/ChatLayout";
import { FreeModelsBanner } from "@/components/chat/free-models-banner";

// This page has been refactored to use the new "v2" architecture
// based on Zustand + React Query for robust state management.
// See src/components/chat-v2/ for the components.

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <FreeModelsBanner />
      <ChatLayout />
    </Suspense>
  );
}