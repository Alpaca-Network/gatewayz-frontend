"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Menu, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ChatSidebar } from "./ChatSidebar";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { ConnectionStatus } from "./ConnectionStatus";
import { ModelSelect } from "@/components/chat/model-select";
import { useChatUIStore } from "@/lib/store/chat-ui-store";
import { useAuthSync } from "@/lib/hooks/use-auth-sync";
import { useAuthStore } from "@/lib/store/auth-store";
import { Card } from "@/components/ui/card";
import { useSessionMessages } from "@/lib/hooks/use-chat-queries";
import { GuestChatCounter } from "@/components/chat/guest-chat-counter";
import { useNetworkStatus } from "@/hooks/use-network-status";

// Pool of prompts to randomly select from
const ALL_PROMPTS = [
    { title: "What model is better for coding?", subtitle: "Compare different AI models for programming tasks" },
    { title: "How long would it take to walk to the moon?", subtitle: "Calculate travel time and distance to the moon" },
    { title: "When did England last win the world cup?", subtitle: "Get the latest football world cup information" },
    { title: "Which athlete has won the most gold medals?", subtitle: "Find Olympic and sports statistics" },
    { title: "Explain quantum computing in simple terms", subtitle: "Break down complex quantum concepts" },
    { title: "What are the best practices for API design?", subtitle: "Learn about RESTful API patterns" },
    { title: "How does machine learning differ from AI?", subtitle: "Understand the relationship between ML and AI" },
    { title: "What's the fastest animal on Earth?", subtitle: "Discover amazing animal facts" },
    { title: "How do black holes form?", subtitle: "Explore the mysteries of space" },
    { title: "What programming language should I learn first?", subtitle: "Get guidance on starting your coding journey" },
    { title: "Explain the theory of relativity", subtitle: "Understand Einstein's groundbreaking theory" },
    { title: "What are the health benefits of meditation?", subtitle: "Learn about mindfulness and wellness" },
    { title: "How does cryptocurrency work?", subtitle: "Understand blockchain and digital currencies" },
    { title: "What caused the extinction of dinosaurs?", subtitle: "Explore prehistoric mysteries" },
    { title: "How can I improve my writing skills?", subtitle: "Tips for better communication" },
    { title: "What's the difference between HTTP and HTTPS?", subtitle: "Learn about web security basics" },
];

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function WelcomeScreen({ onPromptSelect }: { onPromptSelect: (txt: string) => void }) {
    // Select 4 random prompts on mount (useMemo ensures consistency during render)
    const [prompts] = useState(() => shuffleArray(ALL_PROMPTS).slice(0, 4));

    // Note: We no longer show a loading spinner here because ChatLayout immediately
    // switches to MessageList with optimistic UI when a prompt is clicked.
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto">
             <h1 className="text-2xl sm:text-4xl font-bold mb-8 text-center">What's On Your Mind?</h1>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl w-full">
                 {prompts.map((p) => (
                     <Card
                        key={p.title}
                        className="p-4 cursor-pointer hover:border-primary transition-colors bg-transparent border-border"
                        onClick={() => onPromptSelect(p.title)}
                     >
                         <p className="font-medium text-sm">{p.title}</p>
                         <p className="text-xs text-muted-foreground mt-1">{p.subtitle}</p>
                     </Card>
                 ))}
             </div>
        </div>
    )
}

export function ChatLayout() {
   useAuthSync(); // Trigger auth sync
   const { isAuthenticated, isLoading: authLoading } = useAuthStore();
   const { selectedModel, setSelectedModel, activeSessionId, setActiveSessionId, setInputValue, mobileSidebarOpen, setMobileSidebarOpen } = useChatUIStore();
   const searchParams = useSearchParams();

   // Track if user has clicked a prompt (to immediately hide welcome screen)
   const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

   const { data: activeMessages = [], isLoading: messagesLoading } = useSessionMessages(activeSessionId);

   // Handle URL message parameter - populate input on mount
   useEffect(() => {
       const messageParam = searchParams.get('message');
       if (messageParam) {
           setInputValue(messageParam);
           // Clean up URL parameter after reading it
           if (typeof window !== 'undefined') {
               const url = new URL(window.location.href);
               url.searchParams.delete('message');
               window.history.replaceState({}, '', url.toString());
           }
       }
   }, [searchParams, setInputValue]);

   // Clear pending prompt once we have real messages OR when session changes
   useEffect(() => {
       if (pendingPrompt && activeMessages.length > 0) {
           setPendingPrompt(null);
       }
   }, [pendingPrompt, activeMessages.length]);

   // Track the previous session ID to detect user-initiated session switches
   const prevSessionIdRef = useRef<number | null>(activeSessionId);

   // Clear pending prompt when user switches to a DIFFERENT existing session
   // (not when a new session is created from the prompt click)
   useEffect(() => {
       const prevSessionId = prevSessionIdRef.current;
       prevSessionIdRef.current = activeSessionId;

       // Only clear if:
       // 1. We have a pending prompt AND
       // 2. Session changed from one non-null value to a DIFFERENT non-null value
       //    (this means user clicked a different session in the sidebar)
       // Don't clear when going from null -> non-null (new session creation from prompt)
       if (pendingPrompt && prevSessionId !== null && activeSessionId !== null && prevSessionId !== activeSessionId) {
           setPendingPrompt(null);
       }
   }, [activeSessionId, pendingPrompt]);

   // Timeout to clear pending prompt if send fails silently (e.g., network error)
   // This prevents the optimistic UI from being stuck indefinitely
   useEffect(() => {
       if (!pendingPrompt) return;

       const timeoutId = setTimeout(() => {
           // If we still have a pending prompt after 30 seconds, something went wrong
           // Clear it to allow the user to try again
           console.warn('[ChatLayout] Pending prompt timed out, clearing optimistic UI');
           setPendingPrompt(null);
       }, 30000);

       return () => clearTimeout(timeoutId);
   }, [pendingPrompt]);

   // Handle prompt selection from welcome screen - auto-send the message
   const handlePromptSelect = (text: string) => {
       // Set pending prompt immediately to hide welcome screen and show chat UI
       setPendingPrompt(text);
       // Set the input value
       setInputValue(text);
       // Use requestAnimationFrame to ensure React has finished rendering and
       // the Zustand state update has propagated before triggering send.
       // This prevents race conditions where __chatInputSend might be stale or undefined.
       requestAnimationFrame(() => {
           if (typeof window !== 'undefined' && (window as any).__chatInputSend) {
               (window as any).__chatInputSend();
           } else {
               console.warn('[ChatLayout] __chatInputSend not available when prompt was selected');
               // Clear pending prompt to avoid stuck optimistic UI
               setPendingPrompt(null);
           }
       });
   };

   // When logged out, always show welcome screen (ignore cached messages and activeSessionId)
   // When logged in, show welcome screen only if no active session or no messages after loading
   // ALSO hide welcome screen immediately when a prompt is clicked (pendingPrompt is set)
   const showWelcomeScreen = !pendingPrompt && (!isAuthenticated || !activeSessionId || (!messagesLoading && activeMessages.length === 0));

   if (authLoading) {
       return (
           <div className="flex flex-1 items-center justify-center">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
           </div>
       );
   }

   // Allow guest mode - no login required

   return (
       <div className="flex flex-1 w-full overflow-hidden bg-background">
           {/* Desktop Sidebar */}
           <div className="hidden lg:block w-72 border-r flex-shrink-0">
               <ChatSidebar className="h-full border-none" />
           </div>

           <div className="flex-1 flex flex-col min-w-0 relative">
               {/* Background Logo */}
               <img
                    src="/logo_transparent.svg"
                    alt="Background"
                    className="absolute top-8 left-1/2 transform -translate-x-1/2 w-48 h-48 pointer-events-none opacity-50 hidden lg:block dark:hidden z-0"
                />
                <img
                    src="/logo_black.svg"
                    alt="Background"
                    className="absolute top-8 left-1/2 transform -translate-x-1/2 w-48 h-48 pointer-events-none opacity-50 hidden dark:lg:block z-0"
                />

               {/* Header */}
               <header className="flex items-center justify-between p-3 border-b bg-background/95 backdrop-blur z-10">
                   <div className="flex items-center gap-2 min-w-0">
                       <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
                           <SheetTrigger asChild>
                               <Button variant="ghost" size="icon" className="lg:hidden">
                                   <Menu className="h-5 w-5" />
                               </Button>
                           </SheetTrigger>
                           <SheetContent side="left" className="p-0 w-80">
                               <SheetTitle className="sr-only">Chat Sidebar</SheetTitle>
                               <ChatSidebar className="h-full border-none" onClose={() => setMobileSidebarOpen(false)} />
                           </SheetContent>
                       </Sheet>

                       {/* Title - Placeholder for now, could use useSession details */}
                       <h1 className="font-semibold text-lg truncate hidden sm:block">
                           {activeSessionId ? "Chat" : "New Chat"}
                       </h1>

                       {/* Guest Chat Counter - only show for non-authenticated users */}
                       {!isAuthenticated && (
                           <GuestChatCounter className="hidden sm:flex" />
                       )}
                   </div>

                   <div className="w-[200px] sm:w-[250px] shrink-0">
                       <ModelSelect selectedModel={selectedModel} onSelectModel={setSelectedModel} />
                   </div>
               </header>

              {/* Connection Status - shows when offline or has pending/failed messages */}
              <ConnectionStatus className="mx-auto mt-2" />

              {/* Main Content */}
              <div className="flex-1 overflow-hidden relative z-10 flex flex-col">
                  {showWelcomeScreen ? (
                      <WelcomeScreen onPromptSelect={handlePromptSelect} />
                  ) : (
                      <MessageList
                        sessionId={activeSessionId}
                        messages={activeMessages}
                        isLoading={messagesLoading}
                        pendingPrompt={pendingPrompt}
                      />
                  )}
               </div>

               {/* Input */}
               <div className="relative z-20">
                    <ChatInput />
               </div>
           </div>
       </div>
   )
}
