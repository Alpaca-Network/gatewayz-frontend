"use client";

// Web Speech API types for TypeScript
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  0: {
    transcript: string;
    confidence: number;
  };
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

import { useState, useRef, useCallback, useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Send, Image as ImageIcon, Video as VideoIcon, Mic, Mic as AudioIcon, X, RefreshCw, Plus, FileText, Square, Camera, Globe, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChatUIStore } from "@/lib/store/chat-ui-store";
import { useCreateSession, useSessionMessages } from "@/lib/hooks/use-chat-queries";
import { useChatStream } from "@/lib/hooks/use-chat-stream";
import { useAutoModelSwitch } from "@/lib/hooks/use-auto-model-switch";
import { useAutoSearchDetection } from "@/lib/hooks/use-auto-search-detection";
import { useToolDefinitions, filterEnabledTools } from "@/lib/hooks/use-tool-definitions";
import { useSearchAugmentation } from "@/lib/hooks/use-search-augmentation";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import {
  incrementGuestMessageCount,
  hasReachedGuestLimit,
  getRemainingGuestMessages,
  getGuestMessageLimit
} from "@/lib/guest-chat";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { usePrivy } from "@privy-io/react-auth";
import { useGatewayzAuth } from "@/context/gatewayz-auth-context";
import { useWhisperTranscription } from "@/lib/hooks/use-whisper-transcription";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/safe-storage";

// Helper for file to base64
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
};

// Maximum raw image file size (10MB)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

// Helper to compress images before upload to avoid 413 errors
const compressImage = (file: File, maxWidth = 1920, maxHeight = 1920, quality = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
        }

        img.onload = () => {
            let { width, height } = img;

            // Calculate new dimensions maintaining aspect ratio
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            // Use JPEG for photos (smaller), PNG for images with transparency
            const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            const compressedDataUrl = canvas.toDataURL(mimeType, quality);

            // Clean up object URL
            URL.revokeObjectURL(img.src);

            resolve(compressedDataUrl);
        };

        img.onerror = () => {
            URL.revokeObjectURL(img.src);
            reject(new Error('Failed to load image'));
        };

        img.src = URL.createObjectURL(file);
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

// Helper functions for word-level speech transcript deduplication
// Normalizes a word for comparison (lowercase, alphanumeric only)
const normalizeWord = (word: string): string =>
  word.toLowerCase().replace(/[^\w]/g, '');

// Splits text into words, filtering out empty strings
const getWords = (text: string): string[] =>
  text.trim().split(/\s+/).filter(w => w.length > 0);

// Finds the LAST occurrence of accumulated content within the new transcript
// This handles cases where the API returns duplicated content like "hello world hello world doing"
// Returns the index in newWords where genuinely new content begins, or -1 if no match found
const findAccumulatedEndIndex = (
  accumulatedWords: string[],
  newWords: string[]
): number => {
  if (accumulatedWords.length === 0) return 0;
  if (newWords.length < accumulatedWords.length) return -1;

  // Search for the LAST occurrence of accumulated content in newWords
  // This handles the case where API sends "hello world hello world doing"
  // We want to find the LAST "hello world" and append only "doing"
  let lastMatchEndIndex = -1;

  for (let startIdx = 0; startIdx <= newWords.length - accumulatedWords.length; startIdx++) {
    const slice = newWords.slice(startIdx, startIdx + accumulatedWords.length);
    const matches = slice.every((w, i) =>
      normalizeWord(w) === normalizeWord(accumulatedWords[i])
    );
    if (matches) {
      // Found a match - record where it ends
      lastMatchEndIndex = startIdx + accumulatedWords.length;
      // Continue searching for later occurrences
    }
  }

  if (lastMatchEndIndex >= 0) {
    return lastMatchEndIndex;
  }

  // No exact match found - check for partial overlap where suffix of accumulated
  // matches prefix of new (e.g., accumulated: "hello world", new: "world how are you")
  const maxOverlapCheck = Math.min(accumulatedWords.length, newWords.length, 10);

  for (let overlapLen = maxOverlapCheck; overlapLen > 0; overlapLen--) {
    const accSuffix = accumulatedWords.slice(-overlapLen).map(normalizeWord);
    const newPrefix = newWords.slice(0, overlapLen).map(normalizeWord);

    if (accSuffix.every((word, i) => word === newPrefix[i])) {
      return overlapLen;
    }
  }

  return -1;
};

export function ChatInput() {
  const { activeSessionId, setActiveSessionId, selectedModel, inputValue, setInputValue, setMessageStartTime, enabledTools, toggleTool, autoEnableSearch, setAutoEnableSearch } = useChatUIStore();
  const { data: messages = [], isLoading: isHistoryLoading } = useSessionMessages(activeSessionId);
  const createSession = useCreateSession();
  const { isStreaming, streamMessage, stopStream } = useChatStream();
  const { checkImageSupport, checkVideoSupport, checkAudioSupport, checkFileSupport } = useAutoModelSwitch();
  const { shouldAutoEnableSearch } = useAutoSearchDetection();
  const { data: toolDefinitions } = useToolDefinitions();
  const { augmentWithSearch, isSearching } = useSearchAugmentation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuthStore();
  const { login } = usePrivy();
  const { logout } = useGatewayzAuth();

  // Handle stop button click
  const handleStop = useCallback(() => {
    stopStream();
    // Clear the timer when stopped
    setMessageStartTime(null);
  }, [stopStream, setMessageStartTime]);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [selectedDocumentName, setSelectedDocumentName] = useState<string | null>(null);
  const [guestMessageCount, setGuestMessageCount] = useState(0);
  const [showGuestLimitWarning, setShowGuestLimitWarning] = useState(false);
  // Whisper transcription - high quality backend-based transcription
  const userLanguage = typeof navigator !== 'undefined' ? navigator.language?.split('-')[0] || 'en' : 'en';
  const {
    startRecording: whisperStartRecording,
    stopRecording: whisperStopRecording,
    isRecording: whisperIsRecording,
    isTranscribing,
    error: whisperError,
  } = useWhisperTranscription({
    language: userLanguage,
    preprocess: true,
    targetSampleRate: 16000,
  });

  // Recording state - combines Whisper recording state with local UI state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcriptionStatus, setTranscriptionStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle');

  // Fallback: Web Speech API state (used when Whisper is unavailable)
  const [useWebSpeechFallback, setUseWebSpeechFallback] = useState(false);
  const [speechRecognition, setSpeechRecognition] = useState<SpeechRecognition | null>(null);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [transcriptBeforeRecording, setTranscriptBeforeRecording] = useState<string>('');
  // Track final transcript accumulated during recording session (separate from inputValue)
  const [finalTranscriptDuringRecording, setFinalTranscriptDuringRecording] = useState<string>('');
  // Track if textarea has expanded to multiple lines
  const [isMultiline, setIsMultiline] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ref for synchronous recording state check to prevent race conditions on rapid clicks
  const isRecordingRef = useRef(false);
  // Ref for recording duration interval
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derive input empty state directly from inputValue to avoid desync issues
  const isInputEmpty = !inputValue.trim();

  // Expose focus method for external use (e.g., welcome screen prompt selection)
  const focusInput = useCallback(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea based on content
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Early exit if no parent node to append clone to
    const parentNode = textarea.parentNode;
    if (!parentNode) return;

    // Get current height before any changes
    const currentHeight = textarea.offsetHeight;

    // Use a clone to avoid visual flicker - measure in a hidden element
    const clone = textarea.cloneNode(true) as HTMLTextAreaElement;

    // Copy the text content (cloneNode doesn't copy the value property)
    clone.value = textarea.value;

    // Copy computed styles that affect height measurement
    const computedStyle = window.getComputedStyle(textarea);
    clone.style.position = 'absolute';
    clone.style.visibility = 'hidden';
    clone.style.height = 'auto';
    clone.style.width = `${textarea.offsetWidth}px`;
    clone.style.overflow = 'hidden';
    clone.style.fontSize = computedStyle.fontSize;
    clone.style.fontFamily = computedStyle.fontFamily;
    clone.style.lineHeight = computedStyle.lineHeight;
    clone.style.padding = computedStyle.padding;
    clone.style.border = computedStyle.border;
    clone.style.boxSizing = computedStyle.boxSizing;

    parentNode.appendChild(clone);

    let newHeight: number;
    try {
      // Calculate new height (min 48px for single line, max ~150px for ~4 lines)
      newHeight = Math.min(Math.max(clone.scrollHeight, 48), 150);
    } finally {
      // Always remove the clone, even if an error occurs
      clone.remove();
    }

    // Only update height if it changed to avoid unnecessary reflows
    if (currentHeight !== newHeight) {
      textarea.style.height = `${newHeight}px`;
    }

    // Track if textarea has expanded beyond single line (48px is single line height)
    setIsMultiline(newHeight > 48);
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

  // Auto-adjust textarea height when inputValue changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue, adjustTextareaHeight]);

  const handleSend = useCallback(async () => {
    // IMPORTANT: Use fresh state from Zustand store to avoid stale closures
    // This is critical for preloaded message clicks where inputValue and selectedModel were just set
    const storeState = useChatUIStore.getState();
    const freshInputValue = storeState.inputValue;
    const freshSelectedModel = storeState.selectedModel;
    // Also check the actual textarea field as a fallback for typing scenarios
    const currentInputValue = freshInputValue || textareaRef.current?.value || inputValue;

    if ((!currentInputValue.trim() && !selectedImage && !selectedVideo && !selectedAudio && !selectedDocument) || isStreaming) return;
    if (!freshSelectedModel) {
        toast({ title: "No model selected", variant: "destructive" });
        return;
    }

    // Guest mode: Check daily message limit
    if (!isAuthenticated) {
      if (hasReachedGuestLimit()) {
        setShowGuestLimitWarning(true);
        toast({
          title: "Daily limit reached",
          description: `You've used all ${getGuestMessageLimit()} messages for today. Sign up to continue chatting!`,
          variant: "destructive",
        });
        return;
      }
    }

    // Auto-enable search if the query needs real-time information
    // Get fresh tools state from store
    const freshEnabledTools = storeState.enabledTools;
    const freshAutoEnableSearch = storeState.autoEnableSearch;

    // Check if we should auto-enable web search for this query
    if (shouldAutoEnableSearch(currentInputValue, freshSelectedModel, freshAutoEnableSearch)) {
      // Auto-enable web search if not already enabled
      if (!freshEnabledTools.includes('web_search')) {
        toggleTool('web_search');
      }
    }

    // Capture current input values before any async operations
    const messageText = currentInputValue;
    const currentImage = selectedImage;
    const currentVideo = selectedVideo;
    const currentAudio = selectedAudio;
    const currentDocument = selectedDocument;
    const currentDocumentName = selectedDocumentName;

    // Clear input immediately for better UX
    setInputValue("");
    // Also clear the actual textarea element to ensure it's in sync
    if (textareaRef.current) {
      textareaRef.current.value = "";
    }
    setSelectedImage(null);
    setSelectedVideo(null);
    setSelectedAudio(null);
    setSelectedDocument(null);
    setSelectedDocumentName(null);

    let sessionId = activeSessionId;
    // Create a snapshot of messages BEFORE session creation to avoid race conditions
    let currentMessages = [...messages];

    if (!sessionId) {
      try {
        const newSession = await createSession.mutateAsync({
            title: generateSessionTitle(messageText),
            model: freshSelectedModel.value
        });
        sessionId = newSession.id;
        setActiveSessionId(sessionId);
        // For new sessions, start with empty history (the user message will be added by streamMessage)
        currentMessages = [];
      } catch (e) {
        // Restore input on failure
        setInputValue(messageText);
        setSelectedImage(currentImage);
        setSelectedVideo(currentVideo);
        setSelectedAudio(currentAudio);
        setSelectedDocument(currentDocument);
        setSelectedDocumentName(currentDocumentName);
        toast({ title: "Failed to create session", variant: "destructive" });
        return;
      }
    }

    // Check if we need search augmentation (search enabled but model doesn't support tools)
    let finalMessageText = messageText;
    const currentEnabledTools = useChatUIStore.getState().enabledTools ?? [];
    const searchEnabled = currentEnabledTools.includes('web_search');
    const modelSupportsTools = freshSelectedModel?.supportsTools ?? false;

    // If search is enabled but model doesn't support native tools, use search augmentation
    if (searchEnabled && !modelSupportsTools) {
        try {
            const searchContext = await augmentWithSearch(messageText);
            if (searchContext) {
                // Prepend search results to the user's message
                finalMessageText = `${searchContext}\nUser's question: ${messageText}`;
                toast({
                    title: "Search augmentation",
                    description: "Web search results added to your message",
                });
            }
        } catch (e) {
            console.error('[ChatInput] Search augmentation failed:', e);
            // Continue without search augmentation - don't block the message
        }
    }

    // Combine message and attachments
    let content: any = finalMessageText;
    if (currentImage || currentVideo || currentAudio || currentDocument) {
        content = [
            { type: "text", text: finalMessageText },
            ...(currentImage ? [{ type: "image_url", image_url: { url: currentImage } }] : []),
            ...(currentVideo ? [{ type: "video_url", video_url: { url: currentVideo } }] : []),
            ...(currentAudio ? [{ type: "audio_url", audio_url: { url: currentAudio } }] : []),
            ...(currentDocument ? [{ type: "file_url", file_url: { url: currentDocument } }] : [])
        ];
    }

    try {
        // Start the timer when message is sent
        setMessageStartTime(Date.now());

        // Only send tools to models that support them
        // For non-tool models, search augmentation was already applied above
        const toolsToSend = modelSupportsTools
            ? filterEnabledTools(toolDefinitions, currentEnabledTools)
            : [];

        await streamMessage({
            sessionId,
            content,
            model: freshSelectedModel,
            messagesHistory: currentMessages,
            tools: toolsToSend.length > 0 ? toolsToSend : undefined,
        });

        // Clear the timer when streaming completes
        setMessageStartTime(null);

        // Mark chat task as complete in onboarding after first message (authenticated users only)
        if (typeof window !== 'undefined' && isAuthenticated) {
            try {
                const savedTasks = safeLocalStorageGet('gatewayz_onboarding_tasks');
                const taskState = savedTasks ? JSON.parse(savedTasks) : {};
                if (!taskState.chat) {
                    taskState.chat = true;
                    safeLocalStorageSet('gatewayz_onboarding_tasks', JSON.stringify(taskState));
                    console.log('Onboarding - Chat task marked as complete');

                    // Dispatch custom event to notify the banner
                    window.dispatchEvent(new Event('onboarding-task-updated'));
                }
            } catch (error) {
                console.error('Failed to update onboarding task:', error);
            }
        }

        // Guest mode: Increment daily message count after successful send
        if (!isAuthenticated) {
          const newCount = incrementGuestMessageCount();
          setGuestMessageCount(newCount);

          // Dispatch event to update counter display
          window.dispatchEvent(new Event('guest-count-updated'));

          // Show warning when approaching limit
          const remaining = getRemainingGuestMessages();

          if (remaining === 0) {
            // Show banner when limit is reached
            setShowGuestLimitWarning(true);
            toast({
              title: "Daily limit reached!",
              description: `You've used all ${getGuestMessageLimit()} messages for today. Sign up to continue chatting!`,
              variant: "destructive",
            });
          } else if (remaining <= 3) {
            // Show warning toast when approaching limit
            toast({
              title: `${remaining} ${remaining === 1 ? 'message' : 'messages'} remaining today`,
              description: "Sign up to chat without daily limits!",
            });
          }
        }
    } catch (e) {
        // Clear the timer on error
        setMessageStartTime(null);

        const errorMessage = e instanceof Error ? e.message : "Failed to send message";

        // Check if the error is auth-related (guest mode not available, session expired, or API key issues)
        const lowerErrorMessage = errorMessage.toLowerCase();

        // Rate limit errors should NOT be treated as auth errors, even if they mention "sign up"
        // Rate limit messages like "You've used all X messages for today. Sign up..." contain "sign up"
        // but should show the rate limit message, not trigger login
        const isRateLimitError = lowerErrorMessage.includes('rate limit') ||
                                lowerErrorMessage.includes('daily limit') ||
                                lowerErrorMessage.includes('messages for today') ||
                                lowerErrorMessage.includes('too many');

        // Only check for guest auth errors if NOT a rate limit error
        const isGuestAuthError = !isRateLimitError && (
                                lowerErrorMessage.includes('sign in') ||
                                lowerErrorMessage.includes('sign up') ||
                                lowerErrorMessage.includes('create a free account'));
        const isApiKeyError = lowerErrorMessage.includes('api key') ||
                             lowerErrorMessage.includes('access forbidden') ||
                             lowerErrorMessage.includes('logging out and back in') ||
                             lowerErrorMessage.includes('log out and log back in') ||
                             lowerErrorMessage === 'forbidden';
        const isSessionError = lowerErrorMessage.includes('session expired') ||
                              lowerErrorMessage.includes('authentication');
        const isAuthError = isGuestAuthError || isApiKeyError || isSessionError;

        // Capture error to Sentry with appropriate tags
        const errorType = isRateLimitError ? 'chat_rate_limit_error' : isAuthError ? 'chat_auth_error' : 'chat_send_error';
        Sentry.captureException(
          e instanceof Error ? e : new Error(errorMessage),
          {
            tags: {
              error_type: errorType,
              is_authenticated: isAuthenticated ? 'true' : 'false',
              model: freshSelectedModel?.value || 'unknown',
            },
            extra: {
              errorMessage,
              isRateLimitError,
              isGuestAuthError,
              isApiKeyError,
              isSessionError,
              sessionId,
              hasImage: !!currentImage,
              hasVideo: !!currentVideo,
              hasAudio: !!currentAudio,
              hasDocument: !!currentDocument,
            },
            level: isRateLimitError ? 'warning' : isAuthError ? 'warning' : 'error',
          }
        );

        if (isAuthError) {
          if (!isAuthenticated) {
            // Unauthenticated user - show the login modal
            toast({
              title: "Sign in required",
              description: "Create a free account to use the chat feature.",
              variant: "destructive"
            });
            // Trigger Privy login modal
            login();
          } else if (isApiKeyError) {
            // Authenticated user with invalid API key - prompt to re-authenticate
            toast({
              title: "Session expired",
              description: "Your session has expired. Please log out and log back in.",
              variant: "destructive"
            });
            // Auto-logout and re-login to refresh API key
            Promise.resolve(logout())
              .catch(() => {/* ignore logout errors */})
              .finally(() => login());
          } else {
            // Other auth errors for authenticated users
            toast({ title: errorMessage, variant: "destructive" });
          }
        } else {
          toast({ title: errorMessage, variant: "destructive" });
        }
    }
  }, [inputValue, selectedImage, selectedVideo, selectedAudio, selectedDocument, isStreaming, selectedModel, activeSessionId, messages, setInputValue, setActiveSessionId, createSession, streamMessage, toast, isAuthenticated, login, logout, setMessageStartTime]);

  // Expose send function for prompt auto-send from WelcomeScreen
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__chatInputSend = handleSend;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__chatInputSend;
      }
    };
  }, [handleSend]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file size before processing
      if (file.size > MAX_IMAGE_SIZE) {
          toast({
              title: "Image too large",
              description: "Please select an image under 10MB",
              variant: "destructive"
          });
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
      }

      try {
          // Compress image to avoid 413 payload too large errors
          const compressedBase64 = await compressImage(file);
          setSelectedImage(compressedBase64);

          // Auto-switch to a multimodal model if current model doesn't support images
          const currentModel = useChatUIStore.getState().selectedModel;
          checkImageSupport(currentModel);
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

          // Auto-switch to a multimodal model if current model doesn't support video
          const currentModel = useChatUIStore.getState().selectedModel;
          checkVideoSupport(currentModel);
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

          // Auto-switch to a multimodal model if current model doesn't support audio
          const currentModel = useChatUIStore.getState().selectedModel;
          checkAudioSupport(currentModel);
      } catch (e) {
          toast({ title: "Failed to load audio", variant: "destructive" });
      }
      // Reset input so the same file can be selected again
      if (audioInputRef.current) audioInputRef.current.value = '';
  };

  const handleDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          const base64 = await fileToBase64(file);
          setSelectedDocument(base64);
          setSelectedDocumentName(file.name);

          // Auto-switch to a multimodal model if current model doesn't support files
          const currentModel = useChatUIStore.getState().selectedModel;
          checkFileSupport(currentModel);
      } catch (e) {
          toast({ title: "Failed to load document", variant: "destructive" });
      }
      // Reset input so the same file can be selected again
      if (documentInputRef.current) documentInputRef.current.value = '';
  };

  // Ref to track current recognition instance for race condition prevention (fallback mode)
  const currentRecognitionRef = useRef<SpeechRecognition | null>(null);
  // Ref to track last processed result index to prevent duplicates (fallback mode)
  const lastProcessedIndexRef = useRef<number>(-1);
  // Ref to track accumulated final transcript to detect and remove duplicates (fallback mode)
  const accumulatedFinalTranscriptRef = useRef<string>('');

  // Format recording duration as mm:ss
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Web Speech API fallback - used when Whisper is unavailable (guest users, API errors)
  const startWebSpeechRecording = useCallback(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      toast({
        title: "Speech recognition not supported",
        description: "Your browser doesn't support speech recognition. Try using Chrome or Edge.",
        variant: "destructive"
      });
      return;
    }

    // Reset tracking state for new recording session
    lastProcessedIndexRef.current = -1;
    accumulatedFinalTranscriptRef.current = '';
    setInterimTranscript('');
    setFinalTranscriptDuringRecording('');
    setTranscriptBeforeRecording(useChatUIStore.getState().inputValue);

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = userLanguage === 'en' ? 'en-US' : userLanguage;
    recognition.maxAlternatives = 3;

    currentRecognitionRef.current = recognition;
    setSpeechRecognition(recognition);

    recognition.onstart = () => {
      setIsRecording(true);
      isRecordingRef.current = true;
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let totalFinalTranscript = '';
      let currentInterim = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          totalFinalTranscript += transcript;
          lastProcessedIndexRef.current = i;
        } else {
          currentInterim += transcript;
        }
      }

      setInterimTranscript(currentInterim);

      const newTotal = totalFinalTranscript.trim();
      if (!newTotal) return;

      const accumulated = accumulatedFinalTranscriptRef.current.trim();
      if (newTotal === accumulated) return;

      const newWords = getWords(newTotal);
      const accWords = getWords(accumulated);

      let wordsToAppend: string[] = [];

      if (accWords.length === 0) {
        wordsToAppend = newWords;
      } else {
        const newContentStartIndex = findAccumulatedEndIndex(accWords, newWords);
        if (newContentStartIndex >= 0) {
          wordsToAppend = newWords.slice(newContentStartIndex);
        } else {
          return;
        }
      }

      accumulatedFinalTranscriptRef.current = newTotal;

      if (wordsToAppend.length > 0) {
        const newText = wordsToAppend.join(' ');
        const currentValue = useChatUIStore.getState().inputValue;
        const separator = currentValue && !currentValue.endsWith(' ') ? ' ' : '';
        setInputValue(currentValue + separator + newText);
        setFinalTranscriptDuringRecording(prev => {
          const prevSeparator = prev && !prev.endsWith(' ') ? ' ' : '';
          return prev + prevSeparator + newText;
        });
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (currentRecognitionRef.current !== recognition) return;
      console.error('Speech recognition error:', event.error);
      isRecordingRef.current = false;
      setIsRecording(false);
      setTranscriptionStatus('idle');
      setSpeechRecognition(null);
      currentRecognitionRef.current = null;

      if (event.error === 'not-allowed') {
        toast({
          title: "Microphone access denied",
          description: "Please allow microphone access to use voice input.",
          variant: "destructive"
        });
      } else if (event.error !== 'aborted') {
        toast({
          title: "Speech recognition error",
          description: `Error: ${event.error}`,
          variant: "destructive"
        });
      }
    };

    recognition.onend = () => {
      if (currentRecognitionRef.current !== recognition) return;
      isRecordingRef.current = false;
      setIsRecording(false);
      setTranscriptionStatus('idle');
      setSpeechRecognition(null);
      currentRecognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch (error) {
      console.error('Speech recognition start failed:', error);
      isRecordingRef.current = false;
      setIsRecording(false);
      setTranscriptionStatus('idle');
      setSpeechRecognition(null);
      currentRecognitionRef.current = null;
      toast({
        title: "Failed to start speech recognition",
        description: "Your browser blocked the microphone. Please check your permissions.",
        variant: "destructive"
      });
    }
  }, [toast, setInputValue, userLanguage]);

  // Main recording function - uses Whisper by default, falls back to Web Speech API
  const startRecording = useCallback(async () => {
    // Prevent race condition: use ref for synchronous check
    if (isRecordingRef.current) {
      return;
    }

    // Set ref IMMEDIATELY to block any concurrent calls
    isRecordingRef.current = true;
    setIsRecording(true);
    setTranscriptionStatus('recording');
    setRecordingDuration(0);
    setTranscriptBeforeRecording(useChatUIStore.getState().inputValue);

    // Start duration timer
    const startTime = Date.now();
    durationIntervalRef.current = setInterval(() => {
      setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 100);

    // Use Web Speech API fallback for guest users (no API key for Whisper)
    if (!isAuthenticated) {
      setUseWebSpeechFallback(true);
      startWebSpeechRecording();
      return;
    }

    // Try Whisper (high-quality transcription)
    try {
      setUseWebSpeechFallback(false);
      await whisperStartRecording();
    } catch (error) {
      console.error('Whisper recording failed, falling back to Web Speech API:', error);
      // Fall back to Web Speech API
      setUseWebSpeechFallback(true);
      startWebSpeechRecording();
    }
  }, [isAuthenticated, whisperStartRecording, startWebSpeechRecording]);

  // Stop recording and get transcription
  const stopRecording = useCallback(async () => {
    // Clear duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Handle Web Speech API fallback mode
    if (useWebSpeechFallback && speechRecognition) {
      currentRecognitionRef.current = null;
      speechRecognition.stop();
      setSpeechRecognition(null);
      isRecordingRef.current = false;
      setIsRecording(false);
      setTranscriptionStatus('idle');
      setInterimTranscript('');
      setFinalTranscriptDuringRecording('');
      lastProcessedIndexRef.current = -1;
      accumulatedFinalTranscriptRef.current = '';
      return;
    }

    // Whisper mode - show transcribing state
    setTranscriptionStatus('transcribing');
    setIsRecording(false);

    try {
      const result = await whisperStopRecording();

      if (result?.text) {
        const currentValue = useChatUIStore.getState().inputValue;
        const separator = currentValue && !currentValue.endsWith(' ') ? ' ' : '';
        setInputValue(currentValue + separator + result.text.trim());
      }
    } catch (error) {
      console.error('Whisper transcription failed:', error);
      toast({
        title: "Transcription failed",
        description: "Unable to transcribe audio. Please try again.",
        variant: "destructive"
      });
    } finally {
      isRecordingRef.current = false;
      setTranscriptionStatus('idle');
    }
  }, [useWebSpeechFallback, speechRecognition, whisperStopRecording, setInputValue, toast]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cleanup speech recognition and recording resources on component unmount
  useEffect(() => {
    return () => {
      // Clean up speech recognition
      if (speechRecognition) {
        try {
          speechRecognition.abort();
        } catch {
          // Ignore errors during cleanup
        }
      }
      // Clean up duration interval
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      // Reset recording state
      isRecordingRef.current = false;
    };
  }, [speechRecognition]);

  return (
    <>
      {/* Recording/Transcribing Overlay - Full screen modal */}
      {(transcriptionStatus === 'recording' || transcriptionStatus === 'transcribing') && (
        <div className="recording-overlay">
          <div className="recording-overlay-content">
            {transcriptionStatus === 'recording' ? (
              <>
                {/* Animated waveform */}
                <div className="recording-waveform">
                  <span className="recording-waveform-bar" />
                  <span className="recording-waveform-bar" />
                  <span className="recording-waveform-bar" />
                  <span className="recording-waveform-bar" />
                  <span className="recording-waveform-bar" />
                  <span className="recording-waveform-bar" />
                  <span className="recording-waveform-bar" />
                  <span className="recording-waveform-bar" />
                  <span className="recording-waveform-bar" />
                </div>

                {/* Recording duration display */}
                <div className="recording-duration text-2xl font-mono text-white mb-4">
                  {formatDuration(recordingDuration)}
                </div>

                {/* Transcription text display - only for Web Speech API fallback mode */}
                {useWebSpeechFallback && (
                  <div className="recording-transcript-container">
                    {transcriptBeforeRecording && (
                      <span className="recording-transcript-existing">
                        {transcriptBeforeRecording}{' '}
                      </span>
                    )}
                    {finalTranscriptDuringRecording && (
                      <span className="recording-transcript-final">
                        {finalTranscriptDuringRecording}{' '}
                      </span>
                    )}
                    {interimTranscript && (
                      <span className="recording-transcript-interim">
                        {interimTranscript}
                      </span>
                    )}
                    {!finalTranscriptDuringRecording && !interimTranscript && (
                      <span className="recording-transcript-placeholder">
                        Listening...
                      </span>
                    )}
                  </div>
                )}

                {/* Whisper mode status */}
                {!useWebSpeechFallback && (
                  <div className="recording-transcript-container">
                    <span className="recording-transcript-placeholder">
                      Recording... Speak now
                    </span>
                  </div>
                )}

                {/* Stop button */}
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={toggleRecording}
                  className="recording-stop-button"
                >
                  <Square className="h-5 w-5 mr-2" />
                  Stop Recording
                </Button>
              </>
            ) : (
              <>
                {/* Transcribing state - show spinner */}
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-white" />
                  <span className="text-xl text-white font-medium">Transcribing...</span>
                  <span className="text-sm text-white/70">Using high-quality AI transcription</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    <div className="w-full p-4 border-t bg-background">
      <div className="max-w-4xl mx-auto">
        {/* Guest Daily Limit Warning */}
        {!isAuthenticated && showGuestLimitWarning && (
          <Alert className="mb-3 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <AlertDescription className="flex items-center justify-between">
              <span className="text-sm">
                You've reached your daily limit of {getGuestMessageLimit()} messages.{" "}
                <button
                  onClick={login}
                  className="font-semibold underline hover:no-underline"
                >
                  Sign up
                </button>{" "}
                to chat without limits!
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowGuestLimitWarning(false)}
                className="h-6 px-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

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
            {selectedDocument && (
                <div className="relative flex items-center justify-center h-16 px-3 bg-muted rounded gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground truncate max-w-[100px]">{selectedDocumentName}</span>
                    <Button size="icon" variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 rounded-full" onClick={() => { setSelectedDocument(null); setSelectedDocumentName(null); }}><X className="h-3 w-3" /></Button>
                </div>
            )}
        </div>

        <div className={cn("flex gap-2 bg-muted p-3 rounded-2xl border", isMultiline ? "items-end" : "items-center")}>
            {/* Hidden Inputs */}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
            <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudioSelect} className="hidden" />
            <input ref={documentInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.xml" onChange={handleDocumentSelect} className="hidden" />

            <div className={cn("flex gap-1", isMultiline ? "flex-col self-end" : "flex-row items-center")}>
                {/* Combined "Add photos & files" dropdown with [+] button */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            size="icon"
                            variant="ghost"
                            title={enabledTools.length > 0 ? `Tools enabled: ${enabledTools.join(', ')}` : "Add photos & files"}
                            className={cn(
                                "h-10 w-10 rounded-full border hover:bg-accent relative",
                                enabledTools.length > 0
                                    ? "border-blue-500 bg-blue-500/10"
                                    : "border-border"
                            )}
                        >
                            <Plus className={cn(
                                "h-5 w-5",
                                enabledTools.length > 0 ? "text-blue-500" : "text-muted-foreground"
                            )} />
                            {/* Badge indicator when tools are enabled */}
                            {enabledTools.length > 0 && (
                                <span className="absolute -top-1 -right-1 h-4 w-4 bg-blue-500 rounded-full flex items-center justify-center text-[10px] text-white font-medium">
                                    {enabledTools.length}
                                </span>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top" className="w-80 p-4">
                        {/* Top row: Camera, Photos, Files */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center justify-center p-4 rounded-xl bg-muted hover:bg-accent transition-colors"
                            >
                                <Camera className="h-6 w-6 mb-2 text-foreground" />
                                <span className="text-sm font-medium">Camera</span>
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center justify-center p-4 rounded-xl bg-muted hover:bg-accent transition-colors"
                            >
                                <ImageIcon className="h-6 w-6 mb-2 text-foreground" />
                                <span className="text-sm font-medium">Photos</span>
                            </button>
                            <button
                                onClick={() => documentInputRef.current?.click()}
                                className="flex flex-col items-center justify-center p-4 rounded-xl bg-muted hover:bg-accent transition-colors"
                            >
                                <FileText className="h-6 w-6 mb-2 text-foreground" />
                                <span className="text-sm font-medium">Files</span>
                            </button>
                        </div>
                        {/* Divider */}
                        <div className="border-t border-border mb-3" />
                        {/* Additional options */}
                        <DropdownMenuItem onClick={() => videoInputRef.current?.click()} className="py-3">
                            <VideoIcon className="h-5 w-5 mr-3" />
                            <div>
                                <p className="font-medium">Upload video</p>
                                <p className="text-xs text-muted-foreground">Add video files</p>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => audioInputRef.current?.click()} className="py-3">
                            <AudioIcon className="h-5 w-5 mr-3" />
                            <div>
                                <p className="font-medium">Upload audio</p>
                                <p className="text-xs text-muted-foreground">Add audio files</p>
                            </div>
                        </DropdownMenuItem>

                        {/* Tools Section */}
                        <div className="border-t border-border my-3" />
                        <div className="px-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
                                Tools
                            </p>
                            {/* Web Search Toggle */}
                            <div className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-accent transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                        <Globe className="h-5 w-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Web Search</p>
                                        <p className="text-xs text-muted-foreground">
                                            {selectedModel?.supportsTools
                                                ? "Search for current info"
                                                : "Search augmentation mode"}
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    checked={enabledTools.includes('web_search')}
                                    onCheckedChange={() => toggleTool('web_search')}
                                    aria-label="Toggle web search"
                                />
                            </div>
                            {/* Auto-enable search preference */}
                            <div className="flex items-center justify-between py-2 px-2 mt-1 rounded-md hover:bg-accent transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                        <Search className="h-5 w-5 text-purple-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Auto Search</p>
                                        <p className="text-xs text-muted-foreground">
                                            Auto-enable for relevant queries
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    checked={autoEnableSearch}
                                    onCheckedChange={setAutoEnableSearch}
                                    aria-label="Toggle auto search detection"
                                />
                            </div>
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Microphone button for speech-to-text */}
                <Button
                    size="icon"
                    variant={isRecording ? "destructive" : "ghost"}
                    onClick={toggleRecording}
                    title={isRecording ? "Stop recording" : "Start voice input"}
                    className={cn(isRecording && "animate-pulse")}
                >
                    {isRecording ? (
                        <Square className="h-4 w-4" />
                    ) : (
                        <Mic className="h-5 w-5 text-muted-foreground" />
                    )}
                </Button>
            </div>

            {/* Pill indicators for enabled tools */}
            {enabledTools.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {enabledTools.includes('web_search') && (
                        <button
                            onClick={() => toggleTool('web_search')}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-full text-xs font-medium text-blue-600 dark:text-blue-400 transition-colors"
                            title="Click to disable web search"
                        >
                            <Globe className="h-3 w-3" />
                            <span>Search</span>
                            <X className="h-3 w-3 opacity-60 hover:opacity-100" />
                        </button>
                    )}
                </div>
            )}

            <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
                placeholder="Ask Gatewayz"
                className="flex-1 border-0 bg-background focus-visible:ring-0 min-h-[48px] max-h-[150px] py-3 px-3 text-base resize-none overflow-y-auto rounded-xl"
                disabled={isStreaming}
                enterKeyHint="send"
                rows={1}
                data-testid="chat-textarea"
            />

            {isStreaming ? (
                <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    onPointerDown={(e) => {
                        // Prevent focus loss on mobile which can cause state sync issues
                        e.preventDefault();
                    }}
                    onClick={(e) => {
                        e.preventDefault();
                        handleStop();
                    }}
                    title="Stop generating"
                >
                    <Square className="h-4 w-4" />
                </Button>
            ) : (
                <Button
                    type="button"
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
                    disabled={isSearching || (isInputEmpty && !selectedImage && !selectedVideo && !selectedAudio && !selectedDocument)}
                    className="bg-primary"
                >
                    {isSearching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                </Button>
            )}
        </div>
      </div>
    </div>
    </>
  );
}
