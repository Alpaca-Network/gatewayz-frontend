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
import { Send, Image as ImageIcon, Video as VideoIcon, Mic, Mic as AudioIcon, X, RefreshCw, Plus, FileText, Square, Camera } from "lucide-react";
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
import { usePrivy } from "@privy-io/react-auth";
import { useGatewayzAuth } from "@/context/gatewayz-auth-context";

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

// Finds the overlap between the suffix of accumulated words and prefix of new words
// Returns the number of overlapping words to skip
const findOverlappingPrefixLength = (
  accumulatedWords: string[],
  newWords: string[]
): number => {
  // Cap search at 10 words for performance
  const maxLen = Math.min(accumulatedWords.length, newWords.length, 10);

  for (let len = maxLen; len > 0; len--) {
    const suffix = accumulatedWords.slice(-len).map(normalizeWord);
    const prefix = newWords.slice(0, len).map(normalizeWord);

    if (suffix.every((word, i) => word === prefix[i])) {
      return len;
    }
  }
  return 0;
};

export function ChatInput() {
  const { activeSessionId, setActiveSessionId, selectedModel, inputValue, setInputValue, setMessageStartTime } = useChatUIStore();
  const { data: messages = [], isLoading: isHistoryLoading } = useSessionMessages(activeSessionId);
  const createSession = useCreateSession();
  const { isStreaming, streamMessage, stopStream } = useChatStream();
  const { checkImageSupport, checkVideoSupport, checkAudioSupport, checkFileSupport } = useAutoModelSwitch();
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
  const [isRecording, setIsRecording] = useState(false);
  const [speechRecognition, setSpeechRecognition] = useState<SpeechRecognition | null>(null);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [transcriptBeforeRecording, setTranscriptBeforeRecording] = useState<string>('');
  // Track final transcript accumulated during recording session (separate from inputValue)
  const [finalTranscriptDuringRecording, setFinalTranscriptDuringRecording] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ref for synchronous recording state check to prevent race conditions on rapid clicks
  const isRecordingRef = useRef(false);

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

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Calculate new height (min 48px for single line, max ~150px for ~4 lines)
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 48), 150);
    textarea.style.height = `${newHeight}px`;
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

    // Combine message and attachments
    let content: any = messageText;
    if (currentImage || currentVideo || currentAudio || currentDocument) {
        content = [
            { type: "text", text: messageText },
            ...(currentImage ? [{ type: "image_url", image_url: { url: currentImage } }] : []),
            ...(currentVideo ? [{ type: "video_url", video_url: { url: currentVideo } }] : []),
            ...(currentAudio ? [{ type: "audio_url", audio_url: { url: currentAudio } }] : []),
            ...(currentDocument ? [{ type: "file_url", file_url: { url: currentDocument } }] : [])
        ];
    }

    try {
        // Start the timer when message is sent
        setMessageStartTime(Date.now());

        await streamMessage({
            sessionId,
            content,
            model: freshSelectedModel,
            messagesHistory: currentMessages
        });

        // Clear the timer when streaming completes
        setMessageStartTime(null);

        // Mark chat task as complete in onboarding after first message (authenticated users only)
        if (typeof window !== 'undefined' && isAuthenticated) {
            try {
                const savedTasks = localStorage.getItem('gatewayz_onboarding_tasks');
                const taskState = savedTasks ? JSON.parse(savedTasks) : {};
                if (!taskState.chat) {
                    taskState.chat = true;
                    localStorage.setItem('gatewayz_onboarding_tasks', JSON.stringify(taskState));
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

  // Ref to track current recognition instance for race condition prevention
  const currentRecognitionRef = useRef<SpeechRecognition | null>(null);
  // Ref to track last processed result index to prevent duplicates
  const lastProcessedIndexRef = useRef<number>(-1);
  // Ref to track accumulated final transcript to detect and remove duplicates
  const accumulatedFinalTranscriptRef = useRef<string>('');

  // Speech Recognition for transcription
  const startRecording = useCallback(() => {
    // Prevent race condition: use ref for synchronous check to avoid state timing issues
    // State updates are asynchronous, so rapid double-clicks could bypass state-based guards
    if (isRecordingRef.current) {
      return;
    }

    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      toast({
        title: "Speech recognition not supported",
        description: "Your browser doesn't support speech recognition. Try using Chrome or Edge.",
        variant: "destructive"
      });
      return;
    }

    // Set ref IMMEDIATELY to block any concurrent calls (synchronous update)
    isRecordingRef.current = true;
    setIsRecording(true);

    // Reset tracking state for new recording session
    lastProcessedIndexRef.current = -1;
    accumulatedFinalTranscriptRef.current = '';
    setInterimTranscript('');
    setFinalTranscriptDuringRecording('');
    // Save the current input value before recording starts
    setTranscriptBeforeRecording(useChatUIStore.getState().inputValue);

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // Track this recognition instance to prevent stale handlers from corrupting state
    currentRecognitionRef.current = recognition;

    // Set speechRecognition state BEFORE starting to ensure error handlers have access
    setSpeechRecognition(recognition);

    recognition.onstart = () => {
      // Confirm state is set (should already be set above)
      setIsRecording(true);
      isRecordingRef.current = true;
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Build the complete final transcript from all final results
      // The Web Speech API in continuous mode returns accumulated transcripts,
      // so we need to track what we've already processed to avoid duplicates
      let totalFinalTranscript = '';
      let currentInterim = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          // Accumulate all final transcripts
          totalFinalTranscript += transcript;
          lastProcessedIndexRef.current = i;
        } else {
          // Interim results - these are still being processed
          currentInterim += transcript;
        }
      }

      // Update interim transcript display
      setInterimTranscript(currentInterim);

      const newTotal = totalFinalTranscript.trim();
      if (!newTotal) return;

      const accumulated = accumulatedFinalTranscriptRef.current.trim();

      // Quick exit if identical (no new content)
      if (newTotal === accumulated) return;

      // Use word-level comparison to handle overlapping phrases
      // This fixes issues where the API returns "How are you How are you doing"
      // instead of just "How are you doing"
      const newWords = getWords(newTotal);
      const accWords = getWords(accumulated);

      let wordsToAppend: string[] = [];

      if (accWords.length === 0) {
        // First transcript - add all words
        wordsToAppend = newWords;
      } else {
        // Find overlapping words at the boundary (suffix of accumulated = prefix of new)
        const overlapLen = findOverlappingPrefixLength(accWords, newWords);

        if (overlapLen > 0) {
          // Skip overlapping words, only take genuinely new words
          wordsToAppend = newWords.slice(overlapLen);
        } else if (newWords.length > accWords.length) {
          // No word overlap found, but new is longer - try character-based fallback
          const normalizedNew = newTotal.toLowerCase().replace(/\s+/g, ' ');
          const normalizedAcc = accumulated.toLowerCase().replace(/\s+/g, ' ');
          if (normalizedNew.startsWith(normalizedAcc)) {
            wordsToAppend = getWords(newTotal.slice(accumulated.length));
          }
        }
      }

      // Update accumulated tracking with the full new transcript
      accumulatedFinalTranscriptRef.current = newTotal;

      // Only update input if we have genuinely new words
      if (wordsToAppend.length > 0) {
        const newText = wordsToAppend.join(' ');
        const currentValue = useChatUIStore.getState().inputValue;
        const separator = currentValue && !currentValue.endsWith(' ') ? ' ' : '';
        setInputValue(currentValue + separator + newText);
        // Also track final transcript separately for display
        setFinalTranscriptDuringRecording(prev => {
          const prevSeparator = prev && !prev.endsWith(' ') ? ' ' : '';
          return prev + prevSeparator + newText;
        });
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Only handle error if this is still the current recognition instance
      // This prevents stale handlers from corrupting state of a new recording
      if (currentRecognitionRef.current !== recognition) {
        return;
      }
      console.error('Speech recognition error:', event.error);
      isRecordingRef.current = false;
      setIsRecording(false);
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
      // Only clean up state if this is still the current recognition instance
      // This prevents an old recognition's onend from corrupting a new recording's state
      if (currentRecognitionRef.current !== recognition) {
        return;
      }
      isRecordingRef.current = false;
      setIsRecording(false);
      setSpeechRecognition(null);
      currentRecognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch (error) {
      // Handle synchronous errors from recognition.start()
      // This can happen when audio context is blocked by browser policy
      console.error('Speech recognition start failed:', error);
      isRecordingRef.current = false;
      setIsRecording(false);
      setSpeechRecognition(null);
      currentRecognitionRef.current = null;
      toast({
        title: "Failed to start speech recognition",
        description: "Your browser blocked the microphone. Please check your permissions.",
        variant: "destructive"
      });
    }
  }, [toast, setInputValue]);

  const stopRecording = useCallback(() => {
    if (speechRecognition) {
      // Clear the current recognition ref BEFORE stopping to prevent onend handler
      // from running (since we're intentionally stopping)
      currentRecognitionRef.current = null;
      speechRecognition.stop();
      setSpeechRecognition(null);
      isRecordingRef.current = false;
      setIsRecording(false);
      setInterimTranscript('');
      setFinalTranscriptDuringRecording('');
      lastProcessedIndexRef.current = -1;
      accumulatedFinalTranscriptRef.current = '';
    }
  }, [speechRecognition]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cleanup speech recognition on component unmount
  useEffect(() => {
    return () => {
      if (speechRecognition) {
        try {
          speechRecognition.abort();
        } catch {
          // Ignore errors during cleanup
        }
      }
    };
  }, [speechRecognition]);

  return (
    <>
      {/* Recording Overlay - Full screen modal when recording */}
      {isRecording && (
        <div className="recording-overlay">
          <div className="recording-overlay-content">
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

            {/* Transcription text display */}
            <div className="recording-transcript-container">
              {/* Show what was already in the input before recording */}
              {transcriptBeforeRecording && (
                <span className="recording-transcript-existing">
                  {transcriptBeforeRecording}{' '}
                </span>
              )}
              {/* Show newly captured text (tracked separately to avoid doubling) */}
              {finalTranscriptDuringRecording && (
                <span className="recording-transcript-final">
                  {finalTranscriptDuringRecording}{' '}
                </span>
              )}
              {/* Show interim (in-progress) text */}
              {interimTranscript && (
                <span className="recording-transcript-interim">
                  {interimTranscript}
                </span>
              )}
              {/* Show placeholder if nothing captured yet */}
              {!finalTranscriptDuringRecording && !interimTranscript && (
                <span className="recording-transcript-placeholder">
                  Listening...
                </span>
              )}
            </div>

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

        <div className="flex gap-2 items-end bg-muted p-3 rounded-2xl border">
            {/* Hidden Inputs */}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
            <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudioSelect} className="hidden" />
            <input ref={documentInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.xml" onChange={handleDocumentSelect} className="hidden" />

            <div className="flex flex-col gap-1 self-end">
                {/* Combined "Add photos & files" dropdown with [+] button */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" title="Add photos & files" className="h-10 w-10 rounded-full border border-border hover:bg-accent">
                            <Plus className="h-5 w-5 text-muted-foreground" />
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
                    disabled={isInputEmpty && !selectedImage && !selectedVideo && !selectedAudio && !selectedDocument}
                    className="bg-primary"
                >
                    <Send className="h-4 w-4" />
                </Button>
            )}
        </div>
      </div>
    </div>
    </>
  );
}
