"use client";

import { useState, useMemo } from "react";
import { Menu, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ChatSidebar } from "./ChatSidebar";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { ModelSelect } from "@/components/chat/model-select";
import { useChatUIStore } from "@/lib/store/chat-ui-store";
import { useAuthSync } from "@/lib/hooks/use-auth-sync";
import { useAuthStore } from "@/lib/store/auth-store";
import { Card } from "@/components/ui/card";
import { useSessionMessages } from "@/lib/hooks/use-chat-queries";

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

   // Handle prompt selection from welcome screen - auto-send the message
   const handlePromptSelect = (text: string) => {
       setInputValue(text);
       // Trigger send after setting the value
       // Use requestAnimationFrame to ensure the state has updated
       requestAnimationFrame(() => {
           if (typeof window !== 'undefined' && (window as any).__chatInputSend) {
               (window as any).__chatInputSend();
           }
       });
   };

   const { data: activeMessages = [], isLoading: messagesLoading } = useSessionMessages(activeSessionId);
   // When logged out, always show welcome screen (ignore cached messages and activeSessionId)
   // When logged in, show welcome screen only if no active session or no messages after loading
   const showWelcomeScreen = !isAuthenticated || !activeSessionId || (!messagesLoading && activeMessages.length === 0);

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
                   </div>
                   
                   <div className="w-[200px] sm:w-[250px] shrink-0">
                       <ModelSelect selectedModel={selectedModel} onSelectModel={setSelectedModel} />
                   </div>
               </header>

              {/* Main Content */}
              <div className="flex-1 overflow-hidden relative z-10 flex flex-col">
                  {showWelcomeScreen ? (
                      <WelcomeScreen onPromptSelect={handlePromptSelect} />
                  ) : (
                      <MessageList
                        sessionId={activeSessionId}
                        messages={activeMessages}
                        isLoading={messagesLoading}
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
