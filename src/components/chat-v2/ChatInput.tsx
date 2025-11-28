"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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

// Helper to generate smart session title (truncates at word boundary)
const generateSessionTitle = (text: string, maxLength: number = 30): string => {
    if (!text.trim()) return "New Chat";
    const trimmed = text.trim();
    if (trimmed.length <= maxLength) return trimmed;

    // Find the last space before maxLength
    const lastSpace = trimmed.lastIndexOf(' ', maxLength);
    if (lastSpace > maxLength / 2) {
        return trimmed.substring(0, lastSpace) + '...';
    }
    // If no good word boundary, truncate at maxLength
    return trimmed.substring(0, maxLength - 3) + '...';
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
  const inputRef = useRef<HTMLInputElement>(null);

  // Track if button should be disabled - use input ref for immediate value on mobile
  const [isInputEmpty, setIsInputEmpty] = useState(true);

  // Expose focus method for external use (e.g., welcome screen prompt selection)
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // Store focus function in window for access from ChatLayout
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__chatInputFocus = focusInput;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__chatInputFocus;
      }
    };
  }, [focusInput]);

  const handleSend = async () => {
    // Use the actual input field value to avoid race conditions on mobile
    const currentInputValue = inputRef.current?.value || inputValue;

    if ((!currentInputValue.trim() && !selectedImage && !selectedVideo && !selectedAudio) || isStreaming) return;
    if (!selectedModel) {
        toast({ title: "No model selected", variant: "destructive" });
        return;
    }

    // Capture current input values before any async operations
    const messageText = currentInputValue;
    const currentImage = selectedImage;
    const currentVideo = selectedVideo;
    const currentAudio = selectedAudio;

    // Clear input immediately for better UX
    setInputValue("");
    setIsInputEmpty(true);
    // Also clear the actual input element to ensure it's in sync
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setSelectedImage(null);
    setSelectedVideo(null);
    setSelectedAudio(null);

    let sessionId = activeSessionId;
    // Create a snapshot of messages BEFORE session creation to avoid race conditions
    let currentMessages = [...messages];

    if (!sessionId) {
      try {
        const newSession = await createSession.mutateAsync({
            title: generateSessionTitle(messageText),
            model: selectedModel.value
        });
        sessionId = newSession.id;
        setActiveSessionId(sessionId);
        // For new sessions, start with empty history (the user message will be added by streamMessage)
        currentMessages = [];
      } catch (e) {
        // Restore input on failure
        setInputValue(messageText);
        setIsInputEmpty(!messageText.trim());
        setSelectedImage(currentImage);
        setSelectedVideo(currentVideo);
        setSelectedAudio(currentAudio);
        toast({ title: "Failed to create session", variant: "destructive" });
        return;
      }
    }

    // Combine message and attachments
    let content: any = messageText;
    if (currentImage || currentVideo || currentAudio) {
        content = [
            { type: "text", text: messageText },
            ...(currentImage ? [{ type: "image_url", image_url: { url: currentImage } }] : []),
            ...(currentVideo ? [{ type: "video_url", video_url: { url: currentVideo } }] : []),
            ...(currentAudio ? [{ type: "audio_url", audio_url: { url: currentAudio } }] : [])
        ];
    }

    try {
        await streamMessage({
            sessionId,
            content,
            model: selectedModel,
            messagesHistory: currentMessages
        });
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
      // Reset input so the same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          const base64 = await fileToBase64(file);
          setSelectedVideo(base64);
      } catch (e) {
          toast({ title: "Failed to load video", variant: "destructive" });
      }
      // Reset input so the same file can be selected again
      if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          const base64 = await fileToBase64(file);
          setSelectedAudio(base64);
      } catch (e) {
          toast({ title: "Failed to load audio", variant: "destructive" });
      }
      // Reset input so the same file can be selected again
      if (audioInputRef.current) audioInputRef.current.value = '';
  };

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
            {selectedVideo && (
                <div className="relative">
                    <video src={selectedVideo} className="h-16 w-16 object-cover rounded" />
                    <Button size="icon" variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 rounded-full" onClick={() => setSelectedVideo(null)}><X className="h-3 w-3" /></Button>
                </div>
            )}
            {selectedAudio && (
                <div className="relative flex items-center justify-center h-16 w-16 bg-muted rounded">
                    <AudioIcon className="h-6 w-6 text-muted-foreground" />
                    <Button size="icon" variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 rounded-full" onClick={() => setSelectedAudio(null)}><X className="h-3 w-3" /></Button>
                </div>
            )}
        </div>

        <div className="flex gap-2 items-center bg-muted p-2 rounded-lg border">
            {/* Hidden Inputs */}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
            <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudioSelect} className="hidden" />

            <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} title="Upload image">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => videoInputRef.current?.click()} title="Upload video">
                    <VideoIcon className="h-5 w-5 text-muted-foreground" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => audioInputRef.current?.click()} title="Upload audio">
                    <AudioIcon className="h-5 w-5 text-muted-foreground" />
                </Button>
            </div>

            <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => {
                    const value = e.target.value;
                    setInputValue(value);
                    setIsInputEmpty(!value.trim());
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
                placeholder="Type a message..."
                className="flex-1 border-0 bg-background focus-visible:ring-0"
                disabled={isStreaming}
                enterKeyHint="send"
            />

            <Button
                size="icon"
                onPointerDown={(e) => {
                    // Prevent focus loss on mobile which can cause state sync issues
                    e.preventDefault();
                }}
                onClick={(e) => {
                    // Prevent any default behavior that might interfere
                    e.preventDefault();
                    handleSend();
                }}
                disabled={isStreaming}
                className={cn("bg-primary", isStreaming && "opacity-50")}
                type="button"
            >
                {isStreaming ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
        </div>
      </div>
    </div>
  );
}
