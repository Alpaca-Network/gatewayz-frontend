"use client";

import { useEffect } from "react";
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
import { useCreateSession } from "@/lib/hooks/use-chat-queries";

function WelcomeScreen({ onPromptSelect }: { onPromptSelect: (txt: string) => void }) {
    const prompts = [
        { title: "What model is better for coding?", subtitle: "Compare different AI models for programming tasks" },
        { title: "How long would it take to walk to the moon?", subtitle: "Calculate travel time and distance to the moon" },
        { title: "When did England last win the world cup?", subtitle: "Get the latest football world cup information" },
        { title: "Which athlete has won the most gold medals?", subtitle: "Find Olympic and sports statistics" }
    ];

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto">
             <h1 className="text-2xl sm:text-4xl font-bold mb-8 text-center">What's On Your Mind?</h1>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl w-full">
                 {prompts.map((p) => (
                     <Card 
                        key={p.title} 
                        className="p-4 cursor-pointer hover:border-primary transition-colors bg-muted/30"
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
   
   // Handle prompt selection from welcome screen
   const handlePromptSelect = (text: string) => {
       setInputValue(text);
       // Focus input handled in ChatInput via store or effect, 
       // but strictly ChatInput reads store? No, ChatInput manages its own state usually.
       // Let's make ChatInput read from store or we pass a prop?
       // The store has `inputValue`. I should update ChatInput to use it.
       // Actually, I'll update ChatInput to sync with store or just use local state + key.
       // For simplicity in v2, I'll update the store and have ChatInput use it.
   };

   if (authLoading && !isAuthenticated) {
       return (
           <div className="flex h-[calc(100vh-160px)] items-center justify-center">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
           </div>
       );
   }

   // Optional: Show login prompt if not authenticated (though Layout handles this usually)
   if (!isAuthenticated) {
       return (
            <div className="flex h-[calc(100vh-160px)] items-center justify-center flex-col gap-4">
                <h2 className="text-xl font-semibold">Please Log In</h2>
                <p className="text-muted-foreground">You need to be logged in to use the chat.</p>
            </div>
       );
   }

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
                    className="absolute top-8 left-1/2 transform -translate-x-1/2 w-[75vh] h-[75vh] pointer-events-none opacity-50 hidden lg:block dark:hidden z-0"
                />
                <img
                    src="/logo_black.svg"
                    alt="Background"
                    className="absolute top-8 left-1/2 transform -translate-x-1/2 w-[75vh] h-[75vh] pointer-events-none opacity-50 hidden dark:lg:block z-0"
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
                   {activeSessionId ? (
                       <MessageList />
                   ) : (
                       <WelcomeScreen onPromptSelect={handlePromptSelect} />
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
