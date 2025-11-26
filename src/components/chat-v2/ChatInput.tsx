"use client";

import { useState, useRef } from "react";
import { Send, Image as ImageIcon, Video as VideoIcon, Mic as AudioIcon, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatUIStore } from "@/lib/store/chat-ui-store";
import { useCreateSession, useSessionMessages } from "@/lib/hooks/use-chat-queries";
import { useChatStream } from "@/lib/hooks/use-chat-stream";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Helper for file to base64
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
};

export function ChatInput() {
  const { activeSessionId, setActiveSessionId, selectedModel, inputValue, setInputValue } = useChatUIStore();
  const { data: messages = [], isLoading: isHistoryLoading } = useSessionMessages(activeSessionId);
  const createSession = useCreateSession();
  const { isStreaming, streamMessage } = useChatStream();
  const { toast } = useToast();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if ((!inputValue.trim() && !selectedImage && !selectedVideo && !selectedAudio) || isStreaming || isHistoryLoading) return;
    if (!selectedModel) {
        toast({ title: "No model selected", variant: "destructive" });
        return;
    }

    let sessionId = activeSessionId;
    let currentMessages = messages;

    if (!sessionId) {
      try {
        const newSession = await createSession.mutateAsync({ 
            title: inputValue.substring(0, 30) || "New Chat", 
            model: selectedModel.value 
        });
        sessionId = newSession.id;
        setActiveSessionId(sessionId);
        currentMessages = [];
      } catch (e) {
        toast({ title: "Failed to create session", variant: "destructive" });
        return;
      }
    }

    // Combine message and attachments
    let content: any = inputValue;
    if (selectedImage || selectedVideo || selectedAudio) {
        content = [
            { type: "text", text: inputValue },
            ...(selectedImage ? [{ type: "image_url", image_url: { url: selectedImage } }] : []),
            ...(selectedVideo ? [{ type: "video_url", video_url: { url: selectedVideo } }] : []),
            ...(selectedAudio ? [{ type: "audio_url", audio_url: { url: selectedAudio } }] : [])
        ];
    }

    try {
        await streamMessage({
            sessionId,
            content,
            model: selectedModel,
            messagesHistory: currentMessages
        });
        
        // Clear input
        setInputValue("");
        setSelectedImage(null);
        setSelectedVideo(null);
        setSelectedAudio(null);
    } catch (e) {
        toast({ title: "Failed to send message", variant: "destructive" });
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          const base64 = await fileToBase64(file);
          setSelectedImage(base64);
      } catch (e) {
          toast({ title: "Failed to load image", variant: "destructive" });
      }
  };

  // ... (similar handlers for video/audio omitted for brevity, logic is same)
  // Reusing fileToBase64 for all

  return (
    <div className="w-full p-4 border-t bg-background">
      <div className="max-w-4xl mx-auto">
        {/* Previews */}
        <div className="flex gap-2 mb-2 overflow-x-auto">
            {selectedImage && (
                <div className="relative">
                    <img src={selectedImage} alt="preview" className="h-16 w-16 object-cover rounded" />
                    <Button size="icon" variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 rounded-full" onClick={() => setSelectedImage(null)}><X className="h-3 w-3" /></Button>
                </div>
            )}
             {/* ... other previews */}
        </div>

        <div className="flex gap-2 items-center bg-muted/30 p-2 rounded-lg border">
            {/* Hidden Inputs */}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            
            <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()}>
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                </Button>
                {/* Add Video/Audio buttons here */}
            </div>

            <Input 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
                placeholder="Type a message..."
                className="flex-1 border-0 bg-transparent focus-visible:ring-0"
                disabled={isStreaming}
            />

            <Button 
                size="icon" 
                onClick={handleSend}
                disabled={(!inputValue.trim() && !selectedImage && !selectedVideo && !selectedAudio) || isStreaming || isHistoryLoading}
                className={cn("bg-primary", (isStreaming || isHistoryLoading) && "opacity-50")}
            >
                {(isStreaming || isHistoryLoading) ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
        </div>
      </div>
    </div>
  );
}
