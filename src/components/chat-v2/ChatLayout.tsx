"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Menu, Pencil, Lock, Unlock, Shield, Plus, ImageIcon, BarChart3, Code2, Lightbulb, MoreHorizontal } from "lucide-react";
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
import { getApiKey } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { useSessionMessages } from "@/lib/hooks/use-chat-queries";
import { GuestChatCounter } from "@/components/chat/guest-chat-counter";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateSession } from "@/lib/hooks/use-chat-queries";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

// Quick action prompt chips
const PROMPT_CHIPS = [
    { label: "Create image", icon: ImageIcon, prompt: "Create an image of " },
    { label: "Analyze data", icon: BarChart3, prompt: "Analyze the following data: " },
    { label: "Code", icon: Code2, prompt: "Write code to " },
    { label: "Brainstorm", icon: Lightbulb, prompt: "Brainstorm ideas for " },
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

function WelcomeScreen({ onPromptSelect, onPromptChipSelect }: { onPromptSelect: (txt: string) => void; onPromptChipSelect?: (prompt: string) => void }) {
    // Select 4 random prompts on mount (useMemo ensures consistency during render)
    const [prompts] = useState(() => shuffleArray(ALL_PROMPTS).slice(0, 4));

    // Note: We no longer show a loading spinner here because ChatLayout immediately
    // switches to MessageList with optimistic UI when a prompt is clicked.
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto">
             <h1 className="text-2xl sm:text-4xl font-bold mb-6 text-center">What can I help with?</h1>

             {/* Prompt chips like ChatGPT */}
             <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-2xl">
                 {PROMPT_CHIPS.map((chip) => (
                     <button
                        key={chip.label}
                        onClick={() => onPromptChipSelect?.(chip.prompt)}
                        className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-background hover:bg-accent transition-colors text-sm font-medium"
                     >
                         <chip.icon className="h-4 w-4" />
                         {chip.label}
                     </button>
                 ))}
                 <button
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-background hover:bg-accent transition-colors text-sm font-medium"
                 >
                     More
                 </button>
             </div>

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
             <a href="/releases" className="mt-8 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                 What's new
             </a>
        </div>
    )
}

export function ChatLayout() {
   const { isLoading: authSyncLoading } = useAuthSync(); // Trigger auth sync and get loading state
   const { isAuthenticated, isLoading: storeLoading } = useAuthStore();

   // Use the more accurate loading state from useAuthSync which considers:
   // 1. The auth query loading state
   // 2. Whether we already have cached auth credentials
   // For non-authenticated users, this will be false immediately after the effect runs
   const authLoading = authSyncLoading;
   const { selectedModel, setSelectedModel, activeSessionId, setActiveSessionId, setInputValue, mobileSidebarOpen, setMobileSidebarOpen, isIncognitoMode, setIncognitoMode, toggleIncognitoMode, syncIncognitoState } = useChatUIStore();
   const searchParams = useSearchParams();
   const queryClient = useQueryClient();
   const createSession = useCreateSession();
   const { toast } = useToast();

   // Track if user has clicked a prompt (to immediately hide welcome screen)
   const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

   // Share privacy dialog state
   const [showSharePrivacyDialog, setShowSharePrivacyDialog] = useState(false);

   const { data: activeMessages = [], isLoading: messagesLoading } = useSessionMessages(activeSessionId);

   // Track if we've already processed the URL message parameter
   const urlMessageProcessedRef = useRef(false);
   // Track pending timeout IDs for cleanup
   const pendingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

   // Sync incognito state after client-side hydration
   // This fixes the SSR mismatch where incognito mode might be enabled in localStorage
   // but the model wasn't correctly set due to server-side rendering
   useEffect(() => {
       syncIncognitoState();
   }, [syncIncognitoState]);

   // Handle URL message parameter - populate input and auto-send on mount
   useEffect(() => {
       const messageParam = searchParams.get('message');
       const modelParam = searchParams.get('model');

       if (messageParam && !urlMessageProcessedRef.current) {
           urlMessageProcessedRef.current = true;

           // Always disable incognito mode when using chat prompts from homepage/start pages
           // This ensures the user's selected model is used instead of the incognito model.
           // We call setIncognitoMode(false) unconditionally because:
           // 1. If incognito is already off, this is a no-op (state doesn't change)
           // 2. If incognito is on (or will be set on by syncIncognitoState due to SSR hydration),
           //    this ensures it gets disabled
           // This avoids a race condition where syncIncognitoState might enable incognito
           // after this effect has already checked the stale isIncognitoMode value.
           setIncognitoMode(false);

           // Set model from URL if provided
           if (modelParam) {
               // Create a minimal ModelOption from the URL parameter
               const modelParts = modelParam.split('/');
               const modelLabel = modelParts.length > 1 ? modelParts[modelParts.length - 1] : modelParam;
               const gateway = modelParts.length > 1 ? modelParts[0] : undefined;

               // Format label: replace dashes/underscores with spaces and capitalize each word
               const formattedLabel = modelLabel
                   .replace(/[-_]/g, ' ')
                   .split(' ')
                   .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                   .join(' ');

               setSelectedModel({
                   value: modelParam,
                   label: formattedLabel,
                   category: 'General',
                   sourceGateway: gateway,
                   developer: gateway ? gateway.charAt(0).toUpperCase() + gateway.slice(1) : undefined,
                   modalities: ['Text']
               });
           }

           // Set pending prompt immediately to show optimistic UI
           setPendingPrompt(messageParam);
           // Set the input value
           setInputValue(messageParam);

           // Clean up URL parameters after reading them
           if (typeof window !== 'undefined') {
               const url = new URL(window.location.href);
               url.searchParams.delete('message');
               url.searchParams.delete('model');
               window.history.replaceState({}, '', url.toString());
           }

           // Auto-send the message after a short delay to ensure ChatInput is mounted
           // Use multiple retries with capped exponential backoff to handle slow component mounting
           const attemptSend = (retryCount: number = 0) => {
               if (typeof window !== 'undefined' && (window as any).__chatInputSend) {
                   (window as any).__chatInputSend();
               } else if (retryCount < 10) {
                   // Retry with exponential backoff capped at 500ms: 50ms, 100ms, 200ms, 400ms, 500ms...
                   const delay = Math.min(50 * Math.pow(2, retryCount), 500);
                   pendingTimeoutRef.current = setTimeout(() => attemptSend(retryCount + 1), delay);
               } else {
                   console.warn('[ChatLayout] __chatInputSend not available after retries for URL message');
                   // Clear pending prompt to avoid stuck optimistic UI
                   setPendingPrompt(null);
               }
           };

           // Start attempting to send after initial render
           requestAnimationFrame(() => {
               attemptSend(0);
           });
       }

       // Cleanup function to cancel any pending timeouts on unmount
       return () => {
           if (pendingTimeoutRef.current) {
               clearTimeout(pendingTimeoutRef.current);
               pendingTimeoutRef.current = null;
           }
       };
   }, [searchParams, setInputValue, setSelectedModel, setIncognitoMode]);

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

   // Handle prompt chip selection - just sets input value without sending, allows user to complete the prompt
   const handlePromptChipSelect = (prompt: string) => {
       setInputValue(prompt);
       // Focus the input field so user can continue typing
       if (typeof window !== 'undefined' && (window as any).__chatInputFocus) {
           (window as any).__chatInputFocus();
       }
   };

   // Handle retry for failed messages (e.g., rate limit errors)
   // This removes both the failed assistant message AND the user message, then resends
   const handleRetry = useCallback(() => {
       if (!activeSessionId || activeMessages.length < 2) return;

       // Find the last user message (should be the second-to-last message)
       const lastAssistantIndex = activeMessages.length - 1;
       const lastUserIndex = lastAssistantIndex - 1;
       const lastUserMessage = activeMessages[lastUserIndex];
       const lastAssistantMessage = activeMessages[lastAssistantIndex];

       // Verify the message structure is as expected
       if (lastUserMessage?.role !== 'user' || lastAssistantMessage?.role !== 'assistant') {
           console.warn('[ChatLayout] Unexpected message structure for retry');
           return;
       }

       // Extract the text content from the user message
       // NOTE: For multimodal messages with attachments, only text is retried.
       // Attachments (images, videos, audio, documents) are not preserved on retry
       // because ChatInput manages them in local state. A full solution would require
       // lifting attachment state to Zustand or exposing a method to set attachments.
       let userContent = '';
       let hasAttachments = false;
       if (typeof lastUserMessage.content === 'string') {
           userContent = lastUserMessage.content;
       } else if (Array.isArray(lastUserMessage.content)) {
           const textParts = lastUserMessage.content.filter((c: any) => c.type === 'text');
           userContent = textParts.map((c: any) => c.text).join('');
           // Check if there are non-text parts (attachments)
           hasAttachments = lastUserMessage.content.some((c: any) => c.type !== 'text');
       }

       if (hasAttachments) {
           console.warn('[ChatLayout] Retry will only resend text content; attachments cannot be preserved');
       }

       if (!userContent.trim()) {
           console.warn('[ChatLayout] No text content found in last user message');
           return;
       }

       // Check if __chatInputSend is available before making any changes
       // This prevents leaving the UI in an inconsistent state
       if (typeof window === 'undefined' || !(window as any).__chatInputSend) {
           console.warn('[ChatLayout] __chatInputSend not available, cannot retry');
           return;
       }

       // Remove BOTH the user message AND the failed assistant message from the query cache
       // This prevents duplicate user messages when handleSend adds the message again
       queryClient.setQueryData(['chat-messages', activeSessionId], (old: any[] | undefined) => {
           if (!old || old.length < 2) return old;
           // Remove the last two messages (user message + failed assistant message)
           return old.slice(0, -2);
       });

       // Set the input value to the last user message
       setInputValue(userContent);

       // Trigger send - handleSend reads fresh state from Zustand store via getState()
       // so the inputValue will be correctly picked up
       (window as any).__chatInputSend();
   }, [activeSessionId, activeMessages, queryClient, setInputValue]);

   // Handle regenerate - re-send the last user message to get a new response
   const handleRegenerate = useCallback(() => {
       if (!activeSessionId || activeMessages.length < 2) return;

       // Find the last user message
       const lastAssistantIndex = activeMessages.length - 1;
       const lastUserIndex = lastAssistantIndex - 1;
       const lastUserMessage = activeMessages[lastUserIndex];
       const lastAssistantMessage = activeMessages[lastAssistantIndex];

       if (lastUserMessage?.role !== 'user' || lastAssistantMessage?.role !== 'assistant') {
           console.warn('[ChatLayout] Unexpected message structure for regenerate');
           return;
       }

       // Don't regenerate while streaming
       if (lastAssistantMessage.isStreaming) {
           console.warn('[ChatLayout] Cannot regenerate while message is still streaming');
           return;
       }

       // Extract text content
       let userContent = '';
       if (typeof lastUserMessage.content === 'string') {
           userContent = lastUserMessage.content;
       } else if (Array.isArray(lastUserMessage.content)) {
           userContent = lastUserMessage.content
               .filter((c: any) => c.type === 'text' && c.text)
               .map((c: any) => c.text)
               .join('');
       }

       if (!userContent.trim()) return;

       // Check if __chatInputSend is available
       if (typeof window === 'undefined' || !(window as any).__chatInputSend) {
           console.warn('[ChatLayout] __chatInputSend not available, cannot regenerate');
           return;
       }

       // Remove BOTH the user message AND the assistant message from cache
       // This prevents duplicate user messages when handleSend adds the message again
       queryClient.setQueryData(['chat-messages', activeSessionId], (old: any[] | undefined) => {
           if (!old || old.length < 2) return old;
           return old.slice(0, -2);
       });

       // Set the input and re-send
       setInputValue(userContent);
       (window as any).__chatInputSend();
   }, [activeSessionId, activeMessages, queryClient, setInputValue]);

   // Handle feedback - like a message
   const handleLike = useCallback(async (messageId: number) => {
       const apiKey = getApiKey();
       const message = activeMessages.find(m => m.id === messageId);

       try {
           const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai'}/v1/chat/feedback`, {
               method: 'POST',
               headers: {
                   ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
                   'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                   feedback_type: 'thumbs_up',
                   session_id: activeSessionId,
                   message_id: messageId,
                   model: message?.model,
                   rating: 5,
                   metadata: {
                       response_content: typeof message?.content === 'string' ? message.content : undefined
                   }
               })
           });

           if (!response.ok) {
               throw new Error(`HTTP ${response.status}: ${response.statusText}`);
           }

           toast({
               title: "Feedback received",
               description: "Thanks for the positive feedback!",
           });
       } catch (error) {
           console.error('[ChatLayout] Failed to submit feedback:', error);
           toast({
               title: "Feedback failed",
               description: "Unable to submit feedback. Please try again.",
               variant: "destructive",
           });
       }
   }, [activeSessionId, activeMessages, toast]);

   // Handle feedback - dislike a message
   const handleDislike = useCallback(async (messageId: number) => {
       const apiKey = getApiKey();
       const message = activeMessages.find(m => m.id === messageId);

       try {
           const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai'}/v1/chat/feedback`, {
               method: 'POST',
               headers: {
                   ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
                   'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                   feedback_type: 'thumbs_down',
                   session_id: activeSessionId,
                   message_id: messageId,
                   model: message?.model,
                   rating: 1,
                   metadata: {
                       response_content: typeof message?.content === 'string' ? message.content : undefined
                   }
               })
           });

           if (!response.ok) {
               throw new Error(`HTTP ${response.status}: ${response.statusText}`);
           }

           toast({
               title: "Feedback received",
               description: "Thanks for letting us know. We'll work to improve.",
           });
       } catch (error) {
           console.error('[ChatLayout] Failed to submit feedback:', error);
           toast({
               title: "Feedback failed",
               description: "Unable to submit feedback. Please try again.",
               variant: "destructive",
           });
       }
   }, [activeSessionId, activeMessages, toast]);

   // Handle share - create and copy shareable link
   // Note: messageId parameter is kept for interface compatibility with MessageList,
   // but we share the entire session (not individual messages)
   const handleShare = useCallback(async (messageId: number) => {
       if (!activeSessionId) {
           toast({
               title: "Unable to share",
               description: "No active chat session.",
               variant: "destructive",
           });
           return;
       }

       // Show privacy warning dialog (messageId not used in actual sharing)
       setShowSharePrivacyDialog(true);
   }, [activeSessionId, toast]);

   // Execute share after user confirms privacy warning
   const executeShare = useCallback(async () => {
       try {
           if (!activeSessionId) {
               toast({
                   title: "Unable to share",
                   description: "No active chat session.",
                   variant: "destructive",
               });
               return;
           }
           // Import the share utility function
           const { createShareLink, copyShareUrlToClipboard } = await import('@/lib/share-chat');

           // Create a shareable link for the entire chat session
           const result = await createShareLink({
               sessionId: activeSessionId,
           });

           if (!result.success || !result.share_url) {
               throw new Error(result.error || 'Failed to create share link');
           }

           // Copy the share URL to clipboard
           await copyShareUrlToClipboard(result.share_url, toast);

       } catch (error) {
           console.error('[ChatLayout] Failed to create share link:', error);
           toast({
               title: "Share failed",
               description: "Unable to create share link. Please try again.",
               variant: "destructive",
           });
       } finally {
           // Clean up
           setShowSharePrivacyDialog(false);
       }
   }, [activeSessionId, toast]);

   // Show welcome screen only when:
   // 1. No pending prompt (user hasn't clicked a starter prompt)
   // 2. AND either no active session OR (not loading AND no messages)
   // This applies to both authenticated and guest users to ensure the welcome screen
   // disappears when a message is sent or a prompt is clicked
   const showWelcomeScreen = !pendingPrompt && (!activeSessionId || (!messagesLoading && activeMessages.length === 0));

   // Handle creating a new chat session (for mobile new chat button)
   const handleCreateNewChat = useCallback(async () => {
       try {
           const newSession = await createSession.mutateAsync({
               title: "Untitled Chat",
               model: selectedModel?.value
           });
           setActiveSessionId(newSession.id);
       } catch (e) {
           console.error("Failed to create session", e);
           toast({
               title: "Unable to start a new chat",
               description: "Please try again in a moment.",
               variant: "destructive",
           });
       }
   }, [createSession, selectedModel?.value, setActiveSessionId, toast]);

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

                       {/* Mobile New Chat Button - easily accessible on mobile */}
                       <Button
                           variant="ghost"
                           size="icon"
                           className="lg:hidden"
                           onClick={handleCreateNewChat}
                           disabled={createSession.isPending}
                           title="New Chat"
                       >
                           <Plus className="h-5 w-5" />
                       </Button>

                       {/* Title - Placeholder for now, could use useSession details */}
                       <h1 className="font-semibold text-lg truncate hidden sm:block">
                           {activeSessionId ? "Chat" : "New Chat"}
                       </h1>

                       {/* Guest Chat Counter - only show for non-authenticated users */}
                       {!isAuthenticated && (
                           <GuestChatCounter className="hidden sm:flex" />
                       )}
                   </div>

                   <div className="flex items-center gap-2 shrink-0">
                       {/* Incognito Mode Toggle */}
                       <Button
                           variant={isIncognitoMode ? "default" : "ghost"}
                           size="icon"
                           onClick={toggleIncognitoMode}
                           title={isIncognitoMode ? "Incognito mode enabled - Click to disable" : "Enable incognito mode"}
                           className={`
                               transition-all duration-500 ease-out
                               ${isIncognitoMode
                                   ? "bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-700 hover:via-purple-600 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/30 scale-110 ring-2 ring-purple-400/50 ring-offset-2 ring-offset-background"
                                   : "hover:bg-muted"
                               }
                           `}
                       >
                           {isIncognitoMode
                               ? <Lock className="h-4 w-4 animate-pulse" />
                               : <Unlock className="h-4 w-4" />
                           }
                       </Button>

                       <div className="w-[180px] sm:w-[250px]">
                           <ModelSelect selectedModel={selectedModel} onSelectModel={setSelectedModel} isIncognitoMode={isIncognitoMode} />
                       </div>
                   </div>
               </header>

              {/* Connection Status - shows when offline or has pending/failed messages */}
              <ConnectionStatus className="mx-auto mt-2" />

              {/* Incognito Mode Banner */}
              {isIncognitoMode && (
                  <div className="mx-auto mt-2 mb-2 px-4 py-2 bg-gradient-to-r from-purple-600/10 via-purple-500/10 to-indigo-600/10 border border-purple-500/30 rounded-lg max-w-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center gap-3">
                          <Shield className="h-5 w-5 text-purple-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-purple-300">Incognito Mode Active</p>
                              <p className="text-xs text-purple-400/80 truncate">
                                  Using NEAR AI models for enhanced privacy. Your conversations are not stored.
                              </p>
                          </div>
                          <Button
                              variant="ghost"
                              size="sm"
                              onClick={toggleIncognitoMode}
                              className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 shrink-0"
                          >
                              Exit
                          </Button>
                      </div>
                  </div>
              )}

              {/* Main Content */}
              <div className="flex-1 overflow-hidden relative z-10 flex flex-col">
                  {showWelcomeScreen ? (
                      <WelcomeScreen onPromptSelect={handlePromptSelect} onPromptChipSelect={handlePromptChipSelect} />
                  ) : (
                      <MessageList
                        sessionId={activeSessionId}
                        messages={activeMessages}
                        isLoading={messagesLoading}
                        pendingPrompt={pendingPrompt}
                        onRetry={handleRetry}
                        onRegenerate={handleRegenerate}
                        onLike={handleLike}
                        onDislike={handleDislike}
                        onShare={handleShare}
                      />
                  )}
               </div>

               {/* Input */}
               <div className="relative z-20">
                    <ChatInput />
               </div>
           </div>

           {/* Privacy Warning Dialog for Sharing */}
           <AlertDialog open={showSharePrivacyDialog} onOpenChange={setShowSharePrivacyDialog}>
             <AlertDialogContent>
               <AlertDialogHeader>
                 <AlertDialogTitle>Share this conversation?</AlertDialogTitle>
                 <AlertDialogDescription className="space-y-2">
                   <p>
                     Anyone with the link will be able to view the entire conversation, including all messages and responses.
                   </p>
                   <p className="font-medium text-foreground">
                     Please ensure your conversation doesn't contain:
                   </p>
                   <ul className="list-disc list-inside space-y-1 text-sm">
                     <li>Personal information (names, emails, phone numbers)</li>
                     <li>Passwords or API keys</li>
                     <li>Confidential or sensitive data</li>
                     <li>Private business information</li>
                   </ul>
                 </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                 <AlertDialogCancel onClick={() => {
                   setShowSharePrivacyDialog(false);
                 }}>
                   Cancel
                 </AlertDialogCancel>
                 <AlertDialogAction onClick={executeShare}>
                   I understand, share anyway
                 </AlertDialogAction>
               </AlertDialogFooter>
             </AlertDialogContent>
           </AlertDialog>
       </div>
   )
}
