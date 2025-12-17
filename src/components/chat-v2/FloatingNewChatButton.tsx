"use client";

import { useRouter, usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatUIStore } from "@/lib/store/chat-ui-store";
import { useCreateSession } from "@/lib/hooks/use-chat-queries";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * FloatingNewChatButton - A floating action button (FAB) that appears on mobile devices
 * to provide quick access to creating a new chat from any page.
 *
 * Features:
 * - Only visible on mobile viewports (< 1024px / below lg breakpoint)
 * - Fixed positioning in bottom-right corner
 * - Navigates to /chat and creates a new session
 * - Smooth animations and hover effects
 * - Accessible with proper ARIA labels
 */
export function FloatingNewChatButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { setActiveSessionId, selectedModel } = useChatUIStore();
  const createSession = useCreateSession();
  const { toast } = useToast();

  const handleNewChat = async () => {
    try {
      // Create a new chat session
      const newSession = await createSession.mutateAsync({
        title: "Untitled Chat",
        model: selectedModel?.value,
      });

      // Set the active session
      setActiveSessionId(newSession.id);

      // Navigate to chat page if not already there
      if (pathname !== "/chat") {
        router.push("/chat");
      }
    } catch (error) {
      console.error("Failed to create new chat:", error);
      toast({
        title: "Unable to start a new chat",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      onClick={handleNewChat}
      disabled={createSession.isPending}
      size="icon"
      className={cn(
        // Base styles
        "fixed bottom-6 right-6 z-50",
        "h-14 w-14 rounded-full shadow-lg",
        // Only show on mobile (below lg breakpoint)
        "lg:hidden",
        // Animations and transitions
        "transition-all duration-300 ease-in-out",
        "hover:scale-110 hover:shadow-xl",
        "active:scale-95",
        // Gradient background
        "bg-gradient-to-r from-primary to-primary/90",
        // Disabled state
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      )}
      aria-label="Create new chat"
      title="New Chat"
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
