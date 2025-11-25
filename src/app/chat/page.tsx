
"use client"

import React, { useState, useRef, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Plus,
  Search,
  Pencil,
  MessageSquare,
  Settings,
  Paperclip,
  Globe,
  Send,
  Menu,
  Bot,
  Code,
  Heart,
  BrainCircuit,
  Box,
  User,
  MoreHorizontal,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
  Video as VideoIcon,
  Mic as AudioIcon,
  X,
  Sparkles
} from 'lucide-react';
import dynamic from 'next/dynamic';
import type { ModelOption } from '@/components/chat/model-select';
import { FreeModelsBanner } from '@/components/chat/free-models-banner';
import './chat.css';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { AUTH_REFRESH_EVENT, getApiKey, getUserData, saveApiKey, saveUserData, type UserData } from '@/lib/api';
import { ChatHistoryAPI, ChatSession as ApiChatSession, ChatMessage as ApiChatMessage, handleApiError } from '@/lib/chat-history';
import { MessageQueue, type QueuedMessage } from '@/lib/message-queue';
import { ChatStreamHandler } from '@/lib/chat-stream-handler';
import { Copy, Share2, RotateCcw } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { streamChatResponse } from '@/lib/streaming';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { logAnalyticsEvent } from '@/lib/analytics';
import { useEagerModelPreload } from '@/hooks/useEagerModelPreload';
import { useRecentlyUsedModels } from '@/hooks/useRecentlyUsedModels';
import { debounce } from '@/lib/utils';
import { sessionUpdatesManager } from '@/lib/optimistic-updates';
import { useVirtualScroll } from '@/hooks/useVirtualScroll';
import { ChatMessage } from '@/components/chat/ChatMessage';

// Lazy load ModelSelect for better initial load performance
// Reduces initial bundle by ~100KB and defers expensive model processing
const ModelSelect = dynamic(
    () => import('@/components/chat/model-select').then(mod => ({ default: mod.ModelSelect })),
    {
        loading: () => (
            <Button variant="outline" className="w-[250px] justify-between bg-muted/30" disabled>
                <span className="truncate">Loading models...</span>
            </Button>
        ),
        ssr: false
    }
);

// Lazy load ReactMarkdown and plugins for better initial load performance
// These are only needed when displaying assistant messages with markdown
const ReactMarkdown = dynamic(() => import('react-markdown'), {
    loading: () => <div className="animate-pulse bg-muted/30 h-16 rounded-md"></div>,
    ssr: false
});

// Lazy-loaded markdown component with plugins
const MarkdownRenderer = ({ children, className }: { children: string; className?: string }) => {
    const [plugins, setPlugins] = React.useState<{ remarkPlugins: any[]; rehypePlugins: any[] } | null>(null);

    React.useEffect(() => {
        let isMounted = true;

        const loadPlugins = async () => {
            try {
                // Check if content contains math notation before loading expensive libraries
                const hasMath = children && (children.includes('$') || children.includes('\\(') || children.includes('\\['));

                // Always load GFM (required for markdown)
                const gfm = await import('remark-gfm');

                let remarkPlugins: any[] = [gfm.default];
                let rehypePlugins: any[] = [];

                // Only load math libraries if content actually contains math
                if (hasMath) {
                    const [math, katex] = await Promise.all([
                        import('remark-math'),
                        import('rehype-katex')
                    ]);

                    remarkPlugins.push(math.default);
                    rehypePlugins.push(katex.default);
                }

                if (!isMounted) return;

                setPlugins({
                    remarkPlugins,
                    rehypePlugins
                });
            } catch (error) {
                console.error('[MarkdownRenderer] Failed to load markdown plugins', error);
                if (isMounted) {
                    setPlugins({
                        remarkPlugins: [],
                        rehypePlugins: []
                    });
                }
            }
        };

        loadPlugins();

        return () => {
            isMounted = false;
        };
    }, [children]);

    if (!plugins) {
        return <div className={`${className} animate-pulse`}>{children}</div>;
    }

    return (
        <ReactMarkdown
            remarkPlugins={plugins.remarkPlugins}
            rehypePlugins={plugins.rehypePlugins}
            components={{
                code: ({ node, inline, className: codeClassName, children: codeChildren, ...props }: any) => {
                    return !inline ? (
                        <pre className="bg-muted p-3 rounded-md overflow-x-auto">
                            <code className={codeClassName} {...props}>
                                {codeChildren}
                            </code>
                        </pre>
                    ) : (
                        <code className="bg-muted px-1.5 py-0.5 rounded text-sm" {...props}>
                            {codeChildren}
                        </code>
                    );
                },
                p: ({ children: pChildren }) => <p className="mb-2 last:mb-0">{pChildren}</p>,
                ul: ({ children: ulChildren }) => <ul className="list-disc list-inside mb-2">{ulChildren}</ul>,
                ol: ({ children: olChildren }) => <ol className="list-decimal list-inside mb-2">{olChildren}</ol>,
                li: ({ children: liChildren }) => <li className="mb-1">{liChildren}</li>,
            }}
        >
            {children}
        </ReactMarkdown>
    );
};

// Lazy load ReasoningDisplay for better initial load performance
// Only needed for models with reasoning capabilities (~10% of usage)
const ReasoningDisplay = dynamic(() => import('@/components/chat/reasoning-display').then(mod => ({ default: mod.ReasoningDisplay })), {
    loading: () => <div className="animate-pulse bg-muted/30 h-12 rounded-md w-full"></div>,
    ssr: false
});

const TEMP_API_KEY_PREFIX = 'gw_temp_';

export type Message = {
    role: 'user' | 'assistant';
    content: string;
    reasoning?: string;
    image?: string; // Base64 image data
    video?: string; // Base64 video data
    audio?: string; // Base64 audio data
    isStreaming?: boolean; // Track if message is currently streaming
    model?: string; // Model ID that generated this message
};

type ChatSession = {
    id: string;
    title: string;
    startTime: Date;
    messages: Message[];
    userId?: string;
    createdAt: Date;
    updatedAt: Date;
    apiSessionId?: number; // Link to API session ID
};

// Mock data for chat sessions
const mockChatSessions: ChatSession[] = [

    {
        id: "chat-2",
        title: "Authentication in React",
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        userId: "user-1",
        messages: [
            {
                role: "user",
                content: "How do I implement authentication in React?"
            },
            {
                role: "assistant",
                content: "For React authentication, you can use several approaches:\n\n1. **JWT with localStorage** - Simple but less secure\n2. **OAuth providers** (Google, GitHub) - More secure\n3. **Auth0 or Firebase Auth** - Managed solutions\n4. **Custom backend with sessions** - Most control\n\nWould you like me to show you an example implementation?"
            },
            {
                role: "user",
                content: "Show me JWT implementation"
            },
            {
                role: "assistant",
                content: "Here's a basic JWT implementation:\n\n```javascript\n// Login function\nconst login = async (email, password) => {\n  const response = await fetch('/api/auth/login', {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json' },\n    body: JSON.stringify({ email, password })\n  });\n  \n  const { token } = await response.json();\n  localStorage.setItem('token', token);\n};\n\n// Protected route component\nconst ProtectedRoute = ({ children }) => {\n  const token = localStorage.getItem('token');\n  return token ? children : <Navigate to='/login' />;\n};\n```"
            }
        ]
    },
    {
        id: "chat-3",
        title: "API Design Best Practices",
        startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        userId: "user-1",
        messages: [
            {
                role: "user",
                content: "What are the best practices for REST API design?"
            },
            {
                role: "assistant",
                content: "Here are key REST API design best practices:\n\n**1. Use HTTP methods correctly:**\n- GET: Retrieve data\n- POST: Create new resources\n- PUT: Update entire resource\n- PATCH: Partial updates\n- DELETE: Remove resources\n\n**2. Consistent URL structure:**\n- Use nouns, not verbs: `/users` not `/getUsers`\n- Use plural nouns: `/users` not `/user`\n- Hierarchical: `/users/123/posts`\n\n**3. Status codes:**\n- 200: Success\n- 201: Created\n- 400: Bad Request\n- 401: Unauthorized\n- 404: Not Found\n- 500: Server Error\n\n**4. Response format:**\n```json\n{\n  \"data\": [...],\n  \"meta\": {\n    \"total\": 100,\n    \"page\": 1,\n    \"limit\": 10\n  }\n}\n```"
            }
        ]
    },
    {
        id: "chat-4",
        title: "Database Optimization",
        startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
        userId: "user-1",
        messages: [
            {
                role: "user",
                content: "How can I optimize my database queries?"
            },
            {
                role: "assistant",
                content: "Database optimization strategies:\n\n**1. Indexing:**\n- Add indexes on frequently queried columns\n- Use composite indexes for multi-column queries\n- Avoid over-indexing (slows writes)\n\n**2. Query optimization:**\n- Use EXPLAIN to analyze query plans\n- Avoid SELECT * (fetch only needed columns)\n- Use LIMIT for pagination\n- Optimize JOIN operations\n\n**3. Connection pooling:**\n- Reuse database connections\n- Set appropriate pool sizes\n- Monitor connection usage\n\n**4. Caching:**\n- Redis for frequently accessed data\n- Application-level caching\n- CDN for static content\n\n**5. Database design:**\n- Normalize appropriately (not over-normalize)\n- Use appropriate data types\n- Consider partitioning for large tables"
            }
        ]
    }
];

// Helper function to safely parse dates from backend
const parseBackendDate = (dateString: string, fieldName: string, sessionId?: number): Date => {
    if (!dateString) {
        console.warn(`Empty ${fieldName} for session ${sessionId || 'unknown'}`);
        return new Date(); // Fallback to current time
    }
    
    const parsedDate = new Date(dateString);
    if (isNaN(parsedDate.getTime())) {
        console.warn(`Invalid ${fieldName} date for session ${sessionId || 'unknown'}:`, dateString);
        return new Date(); // Fallback to current time
    }
    
    return parsedDate;
};

// API helper functions for chat history integration
const apiHelpers = {
    // Load chat sessions from cache or API (without messages for faster initial load)
    // Uses cached sessions for instant page load, syncs with backend in background
    loadChatSessions: async (userId: string): Promise<ChatSession[]> => {
        try {
            const apiKey = getApiKey();
            const userData = getUserData();
            console.log('Chat sessions - API Key found:', !!apiKey);
            console.log('Chat sessions - API Key preview:', apiKey ? `${apiKey.substring(0, 10)}...` : 'None');
            console.log('Chat sessions - Privy User ID:', userData?.privy_user_id);

            if (!apiKey) {
                console.warn('No API key found, returning empty sessions');
                return [];
            }

            const chatAPI = new ChatHistoryAPI(apiKey, undefined, userData?.privy_user_id);

            // Use cache-aware loading: returns cached sessions immediately, syncs in background
            console.log('Chat sessions - Loading sessions with cache support');
            const apiSessions = await chatAPI.getSessionsWithCache(50, 0);

            // Map sessions WITHOUT loading messages (for faster initial load)
            const sessions = apiSessions.map((apiSession) => {
                // Use helper function to safely parse dates
                const createdAt = parseBackendDate(apiSession.created_at, 'created_at', apiSession.id);
                const updatedAt = parseBackendDate(apiSession.updated_at, 'updated_at', apiSession.id);

                return {
                    id: `api-${apiSession.id}`,
                    title: apiSession.title,
                    startTime: createdAt, // Use created_at as startTime for consistency
                    createdAt: createdAt,
                    updatedAt: updatedAt,
                    userId: userId,
                    apiSessionId: apiSession.id,
                    messages: [] // Empty initially, will load on demand
                };
            });

            console.log(`Chat sessions - Loaded ${sessions.length} sessions (messages will load on demand)`);
            console.log('Chat sessions - Sample session dates:', sessions.slice(0, 2).map(s => ({
                id: s.id,
                title: s.title,
                startTime: s.startTime.toISOString(),
                createdAt: s.createdAt.toISOString(),
                updatedAt: s.updatedAt.toISOString()
            })));
            return sessions;
        } catch (error) {
            console.error('Failed to load chat sessions from API:', error);
            // Return empty array instead of throwing error
            return [];
        }
    },

    // Load messages for a specific session (lazy loading)
    loadSessionMessages: async (sessionId: string, apiSessionId?: number): Promise<Message[]> => {
        try {
            const apiKey = getApiKey();
            if (!apiKey || !apiSessionId) {
                return [];
            }

            const chatAPI = new ChatHistoryAPI(apiKey, undefined, getUserData()?.privy_user_id);
            const fullSession = await chatAPI.getSession(apiSessionId);

            return fullSession.messages?.map(msg => ({
                role: msg.role,
                content: msg.content,
                reasoning: undefined,
                image: undefined,
                model: msg.model
            })) || [];
        } catch (error) {
            console.error(`Failed to load messages for session ${sessionId}:`, error);
            return [];
        }
    },

    // Save chat session to API
    saveChatSession: async (session: ChatSession): Promise<ChatSession> => {
        try {
            const apiKey = getApiKey();
            if (!apiKey || !session.apiSessionId) {
                return session;
            }

            const chatAPI = new ChatHistoryAPI(apiKey, undefined, getUserData()?.privy_user_id);
            await chatAPI.updateSession(session.apiSessionId, session.title);
            return session;
        } catch (error) {
            console.error('Failed to save chat session to API:', error);
            return session;
        }
    },

    // Create new chat session in API with caching support
    // Stores model preference in cache for faster future sessions
    createChatSession: async (title: string, model?: string): Promise<ChatSession> => {
        try {
            const apiKey = getApiKey();
            console.log('Create session - API Key found:', !!apiKey);
            console.log('Create session - API Key preview:', apiKey ? `${apiKey.substring(0, 10)}...` : 'None');

            if (!apiKey) {
                console.warn('No API key found, creating local session');
                // Fallback to local session
                const now = new Date();
                return {
                    id: `local-${Date.now()}`,
                    title,
                    startTime: now,
                    createdAt: now,
                    updatedAt: now,
                    userId: 'user-1',
                    messages: []
                };
            }

            const chatAPI = new ChatHistoryAPI(apiKey, undefined, getUserData()?.privy_user_id);

            // Cache the model preference for faster future sessions
            if (model) {
                console.log('Create session - Caching default model:', model);
                chatAPI.cacheDefaultModel(model);
            }

            console.log('Create session - Making API request to createSession (with retry support)');
            const apiSession = await chatAPI.createSession(title, model);

            // Use helper function to safely parse dates
            const createdAt = parseBackendDate(apiSession.created_at, 'created_at', apiSession.id);
            const updatedAt = parseBackendDate(apiSession.updated_at, 'updated_at', apiSession.id);

            const newSession = {
                id: `api-${apiSession.id}`,
                title: apiSession.title,
                startTime: createdAt, // Use created_at as startTime for consistency
                createdAt: createdAt,
                updatedAt: updatedAt,
                userId: 'user-1',
                apiSessionId: apiSession.id,
                messages: []
            };

            // Cache the new session for instant recall on next page load
            chatAPI.optimisticAddSession(apiSession);

            return newSession;
        } catch (error) {
            console.error('Failed to create chat session in API:', error);
            // Fallback to local session
            const now = new Date();
            return {
                id: `local-${Date.now()}`,
                title,
                startTime: now,
                createdAt: now,
                updatedAt: now,
                userId: 'user-1',
                messages: []
            };
        }
    },

    // Update chat session in API
    updateChatSession: async (sessionId: string, updates: Partial<ChatSession>, currentSessions: ChatSession[]): Promise<ChatSession> => {
        try {
            const apiKey = getApiKey();
            const session = currentSessions.find(s => s.id === sessionId);
            if (!apiKey || !session?.apiSessionId) {
                return { ...session!, ...updates };
            }

            const chatAPI = new ChatHistoryAPI(apiKey, undefined, getUserData()?.privy_user_id);
            await chatAPI.updateSession(session.apiSessionId, updates.title);
            return { ...session, ...updates };
        } catch (error) {
            console.error('Failed to update chat session in API:', error);
            const session = currentSessions.find(s => s.id === sessionId);
            return { ...session!, ...updates };
        }
    },

    // Delete chat session from API
    deleteChatSession: async (sessionId: string, currentSessions: ChatSession[]): Promise<void> => {
        try {
            const apiKey = getApiKey();
            const session = currentSessions.find(s => s.id === sessionId);
            if (!apiKey || !session?.apiSessionId) {
                return;
            }

            const chatAPI = new ChatHistoryAPI(apiKey, undefined, getUserData()?.privy_user_id);
            await chatAPI.deleteSession(session.apiSessionId);
        } catch (error) {
            console.error('Failed to delete chat session from API:', error);
        }
    },

    // Save message to API session
    saveMessage: async (sessionId: string, role: 'user' | 'assistant', content: string, model?: string, tokens?: number, currentSessions?: ChatSession[]): Promise<{ apiSessionId?: number } | null> => {
        try {
            const apiKey = getApiKey();
            const session = currentSessions?.find(s => s.id === sessionId);
            
            console.log(`SaveMessage - Session ID: ${sessionId}`);
            console.log(`SaveMessage - Session found:`, session);
            console.log(`SaveMessage - API Key:`, apiKey ? `${apiKey.substring(0, 10)}...` : 'None');
            console.log(`SaveMessage - Role: ${role}, Content: ${content.substring(0, 50)}...`);
            
            if (!apiKey || !session) {
                console.warn('SaveMessage - Missing API key or session');
                return null;
            }

            const chatAPI = new ChatHistoryAPI(apiKey, undefined, getUserData()?.privy_user_id);
            
            // If no API session exists, try to create one
            if (!session.apiSessionId) {
                console.log('SaveMessage - No API session ID, creating new session');
                try {
                    const apiSession = await chatAPI.createSession(session.title, model || 'openai/gpt-3.5-turbo');
                    console.log('SaveMessage - Created new API session:', apiSession.id);
                    // Save the message to the new API session
                    await chatAPI.saveMessage(apiSession.id, role, content, model, tokens);
                    console.log('SaveMessage - Message saved to new API session');
                    return { apiSessionId: apiSession.id };
                } catch (createError) {
                    console.error('Failed to create API session for message saving:', createError);
                    return null;
                }
            } else {
                console.log(`SaveMessage - Using existing API session: ${session.apiSessionId}`);
                // Save message to existing API session
                await chatAPI.saveMessage(session.apiSessionId, role, content, model, tokens);
                console.log('SaveMessage - Message saved to existing API session');
                return { apiSessionId: session.apiSessionId };
            }
        } catch (error) {
            console.error('Failed to save message to API:', error);
            return null;
        }
    }
};

interface ModelSuggestionCardProps {
    title: string;
    icon: React.ElementType;
}

const ModelSuggestionCard = ({ title, icon: Icon }: ModelSuggestionCardProps) => (
    <Card className="hover:border-primary cursor-pointer">
        <CardContent className="p-4">
            <h3 className="text-sm font-semibold">{title}</h3>
            <div className="flex justify-end mt-4">
                <div className="flex -space-x-2">
                     <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
            </div>
        </CardContent>
    </Card>
);

interface ExamplePromptProps {
    title: string;
    subtitle: string;
    onClick?: () => void;
}

const ExamplePrompt = ({ title, subtitle, onClick }: ExamplePromptProps) => (
    <Card
        className="hover:border-primary cursor-pointer p-4 text-left bg-muted/30 dark:bg-muted/20 transition-colors rounded-xl border-border"
        onClick={onClick}
    >
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </Card>
)

// Session list item component - extracted to properly use hooks
const SessionListItem = ({
    session,
    activeSessionId,
    switchToSession,
    onRenameSession,
    onDeleteSession
}: {
    session: ChatSession;
    activeSessionId: string | null;
    switchToSession: (id: string) => void;
    onRenameSession: (sessionId: string, newTitle: string) => void;
    onDeleteSession: (sessionId: string) => void;
}) => {
    const [menuOpen, setMenuOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [renameDialogOpen, setRenameDialogOpen] = React.useState(false);
    const [renameValue, setRenameValue] = React.useState('');

    const handleRenameClick = () => {
        setRenameValue(session.title);
        setRenameDialogOpen(true);
        setMenuOpen(false);
    };

    const handleRenameConfirm = () => {
        if (renameValue.trim() && renameValue !== session.title) {
            onRenameSession(session.id, renameValue.trim());
        }
        setRenameDialogOpen(false);
    };

    const handleDeleteClick = () => {
        setDeleteDialogOpen(true);
        setMenuOpen(false);
    };

    const handleDeleteConfirm = () => {
        onDeleteSession(session.id);
        setDeleteDialogOpen(false);
    };

    return (
        <>
        <li key={session.id} className="group relative min-w-0 w-full">
            <div
                className={`flex items-start justify-between gap-2 w-full px-2 py-2 sm:py-1.5 rounded-lg transition-colors touch-manipulation ${
                    activeSessionId === session.id 
                        ? 'bg-secondary' 
                        : 'hover:bg-accent active:bg-accent/80'
                }`}
                onContextMenu={(e) => {
                    e.preventDefault();
                    setMenuOpen(true);
                }}
                >
                   <button
                        className="flex-1 min-w-0 justify-start items-start text-left flex flex-col h-auto touch-manipulation"
                        onClick={() => switchToSession(session.id)}
                    >
                        <span className="font-medium text-sm leading-tight block truncate w-full">
                            {session.title}
                        </span>
                        <span className="text-xs text-muted-foreground truncate leading-tight mt-0.5 block w-full">
                            {formatDistanceToNow(session.startTime, { addSuffix: true })}
                        </span>
                    </button>

                    {/* Three dots menu - Always visible on mobile for better UX */}
                    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 sm:h-7 sm:w-7 hover:bg-muted active:bg-muted rounded-md shrink-0 self-start opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpen(true);
                                }}
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={handleRenameClick} className="touch-manipulation">
                                <Pencil className="h-4 w-4 mr-2" />
                                Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={handleDeleteClick}
                                className="text-destructive focus:text-destructive touch-manipulation"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </li>

            {/* Rename Dialog */}
            <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Rename Chat</DialogTitle>
                        <DialogDescription>
                            Enter a new name for this chat session.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Input
                            id="name"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleRenameConfirm();
                                }
                                setMenuOpen(false);
                            }}
                            placeholder="Chat name"
                            className="col-span-3"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleRenameConfirm}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Chat</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{session.title}"? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                            </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

// Virtual scrolling component for efficient rendering of large session lists
const VirtualSessionList = ({
    groupedSessions,
    activeSessionId,
    switchToSession,
    onRenameSession,
    onDeleteSession
}: {
    groupedSessions: Record<string, ChatSession[]>,
    activeSessionId: string | null,
    switchToSession: (id: string) => void,
    onRenameSession: (sessionId: string, newTitle: string) => void,
    onDeleteSession: (sessionId: string) => void
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });

    // Flatten sessions with group headers for virtual scrolling
    const flatItems = useMemo(() => {
        const items: Array<{ type: 'header' | 'session', data: string | ChatSession, groupName?: string }> = [];
        Object.entries(groupedSessions).forEach(([groupName, sessions]) => {
            items.push({ type: 'header', data: groupName, groupName });
            sessions.forEach(session => {
                items.push({ type: 'session', data: session as ChatSession, groupName });
            });
        });
        return items;
    }, [groupedSessions]);

    // Only render items within visible range + buffer (for smooth scrolling)
    const ITEM_HEIGHT = 60; // Approximate height of each session item
    const HEADER_HEIGHT = 30; // Height of group headers
    const BUFFER = 10; // Render extra items outside viewport

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const scrollTop = container.scrollTop;
            const containerHeight = container.clientHeight;

            const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER);
            const end = Math.min(flatItems.length, Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER);

            setVisibleRange({ start, end });
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Initial calculation

        return () => {
            if (container) {
                container.removeEventListener('scroll', handleScroll);
            }
        };
    }, [flatItems.length]);

    const totalHeight = flatItems.reduce((height, item) =>
        height + (item.type === 'header' ? HEADER_HEIGHT : ITEM_HEIGHT), 0
    );

    return (
        <div ref={containerRef} className="flex-grow overflow-y-auto" style={{ position: 'relative' }}>
            {flatItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                    <p className="text-sm text-muted-foreground">No conversations yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Start a new chat to begin</p>
                </div>
            ) : (
                <div style={{ height: totalHeight, position: 'relative' }}>
                    {flatItems.slice(visibleRange.start, visibleRange.end).map((item, index) => {
                        const actualIndex = visibleRange.start + index;
                        const offsetTop = flatItems.slice(0, actualIndex).reduce((height, prevItem) =>
                            height + (prevItem.type === 'header' ? HEADER_HEIGHT : ITEM_HEIGHT), 0
                        );

                        if (item.type === 'header') {
                            return (
                                <div
                                    key={`header-${item.data}`}
                                    style={{
                                        position: 'absolute',
                                        top: offsetTop,
                                        width: '100%',
                                        height: HEADER_HEIGHT
                                    }}
                                >
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase my-1.5 px-2">
                                        {item.data as string}
                                    </h3>
                                </div>
                            );
                        }

                        const session = item.data as ChatSession;
                        return (
                            <div
                                key={session.id}
                                style={{
                                    position: 'absolute',
                                    top: offsetTop,
                                    width: '100%',
                                    minHeight: ITEM_HEIGHT
                                }}
                            >
                                <SessionListItem
                                    session={session}
                                    activeSessionId={activeSessionId}
                                    switchToSession={switchToSession}
                                    onRenameSession={onRenameSession}
                                    onDeleteSession={onDeleteSession}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

interface ChatSidebarProps {
    sessions: ChatSession[];
    activeSessionId: string | null;
    switchToSession: (id: string) => void;
    createNewChat: () => void;
    onDeleteSession: (sessionId: string) => void;
    onRenameSession: (sessionId: string, newTitle: string) => void;
    onClose?: () => void;
}

const ChatSidebar = ({ sessions, activeSessionId, switchToSession, createNewChat, onDeleteSession, onRenameSession, onClose }: ChatSidebarProps) => {

    // Memoize the grouped sessions to avoid expensive O(n) computation on every render
    const groupedSessions = useMemo(() => {
        // Filter out untitled chats that haven't been started yet
        const startedChats = sessions.filter(session =>
            session.messages.length > 0 || session.title !== 'Untitled Chat'
        );

        return startedChats.reduce((groups, session) => {
            const date = session.startTime;
            let groupName = format(date, 'MMMM d, yyyy');
            if (isToday(date)) groupName = 'Today';
            else if (isYesterday(date)) groupName = 'Yesterday';

            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(session);
            return groups;

        }, {} as Record<string, ChatSession[]>);
    }, [sessions]); // Only recompute when sessions array changes

    // Create wrapped functions that also close the mobile sidebar
    const wrappedSwitchToSession = (sessionId: string) => {
        switchToSession(sessionId);
        onClose?.();
    };

    const wrappedCreateNewChat = () => {
        createNewChat();
        onClose?.();
    };

    return (
    <aside className="flex flex-col gap-3 sm:gap-4 p-3 sm:p-4 pb-0 h-full w-full overflow-hidden bg-background">
        <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold">Chat</h2>
        </div>

        <Button
            onClick={wrappedCreateNewChat}
            className="w-full bg-foreground text-background hover:bg-foreground/90 h-10 sm:h-9 font-medium flex justify-between items-center gap-2 text-left text-sm touch-manipulation"
        >
            <span>New Chat</span>
            <img src="/uil_plus.svg" alt="Plus" width={18} height={18} className="sm:w-5 sm:h-5" />
        </Button>

        <div className="relative">
            <Input placeholder="Search Chats" className="pl-3 rounded-lg h-9 sm:h-8 text-sm" />
            <img 
                src="/material-symbols_search.svg" 
                alt="Search" 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 sm:w-5 sm:h-5" 
            />
        </div>

        <VirtualSessionList
            groupedSessions={groupedSessions}
            activeSessionId={activeSessionId}
            switchToSession={wrappedSwitchToSession}
            onRenameSession={onRenameSession}
            onDeleteSession={onDeleteSession}
        />
    </aside>
    )
}

// Preprocess LaTeX to fix common formatting issues
const fixLatexSyntax = (content: string): string => {
    // Fix display math: [ ... ] -> $$ ... $$ with newlines for proper parsing
    // Match any brackets that contain LaTeX syntax
    content = content.replace(/\[\s*([^\]]+?)\s*\]/g, (match, formula) => {
        // Check if it contains LaTeX-like syntax (backslashes, frac, text, etc.)
        if (/\\[a-zA-Z]+|\\frac|\\text|\\sqrt|\\sum|\\int|\\approx|\\times|\\div/.test(formula)) {
            // Use $$ with newlines for display math (remark-math requires this format)
            return `\n$$\n${formula}\n$$\n`;
        }
        return match; // Not LaTeX, keep original (could be array notation, etc.)
    });

    // Also fix any existing $$ delimiters that aren't on their own lines
    content = content.replace(/\$\$([^$]+?)\$\$/g, (match, formula) => {
        // Add newlines around display math for proper parsing
        return `\n$$\n${formula}\n$$\n`;
    });

    return content;
};

interface ThinkingLoaderProps {
    modelName: string | undefined;
}

// Exciting loading component for when AI is thinking
const ThinkingLoader = ({ modelName }: ThinkingLoaderProps) => {
    return (
        <div className="flex items-start gap-3 animate-in fade-in duration-500">
            <div className="flex flex-col gap-1 items-start max-w-[85%]">
                <div className="rounded-lg p-5 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-blue-500/20 dark:from-purple-500/10 dark:via-pink-500/10 dark:to-blue-500/10 border-2 border-purple-500/30 relative overflow-hidden shadow-lg">
                    {/* Multiple animated shimmer effects for more dopamine */}
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-purple-300/20 to-transparent" />
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-pink-300/20 to-transparent" style={{ animationDelay: '0.5s' }} />
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-blue-300/20 to-transparent" style={{ animationDelay: '1s' }} />

                    <div className="relative">
                        <p className="text-xs font-semibold mb-4 text-purple-600 dark:text-purple-400 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 animate-spin" style={{ animationDuration: '3s' }} />
                            {modelName}
                        </p>
                        <div className="flex items-center gap-4">
                            {/* Pulsing brain icon */}
                            <BrainCircuit className="h-6 w-6 text-purple-500 animate-pulse" />

                            {/* Rainbow bouncing dots */}
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 animate-bounce shadow-lg shadow-purple-500/50" style={{ animationDelay: '0ms', animationDuration: '0.6s' }} />
                                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 animate-bounce shadow-lg shadow-pink-500/50" style={{ animationDelay: '100ms', animationDuration: '0.6s' }} />
                                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 animate-bounce shadow-lg shadow-blue-500/50" style={{ animationDelay: '200ms', animationDuration: '0.6s' }} />
                                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 animate-bounce shadow-lg shadow-cyan-500/50" style={{ animationDelay: '300ms', animationDuration: '0.6s' }} />
                            </div>

                            {/* Animated text with gradient */}
                            <span className="text-sm font-medium bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 dark:from-purple-400 dark:via-pink-400 dark:to-blue-400 bg-clip-text text-transparent animate-pulse">
                                Generating magic...
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const getReasoningSource = (model?: string) => {
    if (!model) return 'gatewayz';
    const normalized = model.toLowerCase();
    const aiSdkSignatures = ['claude', 'gpt', 'gemini', 'perplexity', 'opus', 'sonnet', 'haiku', 'sonar'];
    return aiSdkSignatures.some(signature => normalized.includes(signature)) ? 'ai-sdk' : 'gatewayz';
};


const ChatSkeleton = () => (
  <div className="flex items-start gap-3">
    {/* Animated arrow icon */}
    <div className="mt-1 flex-shrink-0">
      <svg
        className="w-5 h-5 text-blue-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M5 12h14M12 5l7 7-7 7"
          className="animate-pulse"
          style={{ animationDuration: '1.5s' }}
        />
      </svg>
      <style jsx>{`
        @keyframes slideArrow {
          0%, 100% {
            transform: translateX(0);
            opacity: 0.6;
          }
          50% {
            transform: translateX(4px);
            opacity: 1;
          }
        }
      `}</style>
    </div>

    {/* Skeleton loading bars */}
    <div className="flex flex-col gap-3 w-full max-w-2xl">
      <Skeleton className="h-3 w-full rounded-full" />
      <Skeleton className="h-3 w-full rounded-full" />
      <Skeleton className="h-3 w-2/3 rounded-full" />
    </div>
  </div>
);

// Helper function to generate a concise chat title with random emoji
const generateChatTitle = (message: string): string => {
    // Expanded array of emojis from standard emoji set
    const emojis = [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇',
        '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑',
        '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
        '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵',
        '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️',
        '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱',
        '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿',
        '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹',
        '😻', '😼', '😽', '🙀', '😿', '😾', '💋', '👋', '🤚', '🖐️', '✋', '🖖', '👌',
        '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
        '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅',
        '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀',
        '👁️', '👅', '👄', '💬', '💭', '🗨️', '💕', '💞', '💓', '💗', '💖', '💘', '💝',
        '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎',
        '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️',
        '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮',
        '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘',
        '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱',
        '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️',
        '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠',
        '🔷', '🔸', '🔹', '🔺', '🔻', '🔲', '🔳', '⬛', '⬜', '◾', '◽', '◼️', '◻️',
        '⚫', '⚪', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🟤', '⭐', '🌟', '💫',
        '✨', '⚡', '💥', '🔥', '🌈', '🎃', '🎄', '🎆', '🎇', '🧨', '✨', '🎈', '🎉',
        '🎊', '🎋', '🎍', '🎎', '🎏', '🎐', '🎑', '🧧', '🎀', '🎁', '🎗️', '🎟️', '🎫',
        '🎖️', '🏆', '🏅', '🥇', '🥈', '🥉', '⚽', '⚾', '🥎', '🏀', '🏐', '🏈', '🏉',
        '🎾', '🥏', '🎳', '🏏', '🏑', '🏒', '🥍', '🏓', '🏸', '🥊', '🥋', '🥅', '⛳',
        '⛸️', '🎣', '🤿', '🎽', '🎿', '🛷', '🥌', '🎯', '🪀', '🪁', '🎱', '🔮', '🪄',
        '🧿', '🎮', '🕹️', '🎰', '🎲', '🧩', '🧸', '🪅', '🪆', '♠️', '♥️', '♦️', '♣️',
        '♟️', '🃏', '🀄', '🎴', '🎭', '🖼️', '🎨', '🧵', '🪡', '🧶', '🪢', '🌍', '🌎',
        '🌏', '🌐', '🗺️', '🗾', '🧭', '🏔️', '⛰️', '🌋', '🗻', '🏕️', '🏖️', '🏜️', '🏝️',
        '🏞️', '🏟️', '🏛️', '🏗️', '🧱', '🪨', '🪵', '🛖', '🏘️', '🏚️', '🏠', '🏡', '🏢',
        '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '💒',
        '🗼', '🗽', '⛪', '🕌', '🛕', '🕍', '⛩️', '🕋', '⛲', '⛺', '🌁', '🌃', '🏙️',
        '🌄', '🌅', '🌆', '🌇', '🌉', '♨️', '🎠', '🎡', '🎢', '💈', '🎪'
    ];

    // Pick a random emoji
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

    // Clean and normalize the message
    const cleaned = message.trim();

    // Smart title generation based on common question patterns
    const words = cleaned.split(/\s+/);

    // If message is already short (5 words or less), use it as is
    if (words.length <= 5) {
        return `${randomEmoji} ${cleaned}`;
    }

    // Remove common filler words and extract key terms
    const fillerWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now']);

    // Keep question words and important content words
    const importantWords = words.filter((word, index) => {
        const lower = word.toLowerCase();
        // Always keep the first word if it's a question word
        if (index === 0 && ['what', 'how', 'why', 'when', 'where', 'who', 'which', 'whose', 'whom', 'can', 'could', 'would', 'should', 'is', 'are', 'do', 'does'].includes(lower)) {
            return true;
        }
        // Keep words that aren't filler words
        return !fillerWords.has(lower) || index === 0;
    });

    // Take first 5-6 important words
    const maxWords = 6;
    const titleWords = importantWords.slice(0, maxWords);
    const title = titleWords.join(' ') + (words.length > maxWords ? '...' : '');

    return `${randomEmoji} ${title}`;
};

// OPTIMIZATION: Dev-only logging helper to remove console logs from production
const devLog = (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
        console.log(...args);
    }
};

const devError = (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
        console.error(...args);
    }
};

const devWarn = (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
        console.warn(...args);
    }
};

// OPTIMIZATION: Virtualized message list for smooth performance with 1000+ messages
const VirtualizedMessageList = React.memo<{
    messages: Message[];
    loading: boolean;
    chatContainerRef: React.RefObject<HTMLDivElement>;
    handleRegenerate?: () => void;
}>(({ messages, loading, chatContainerRef, handleRegenerate }) => {
    const handleCopy = useCallback((content: string) => {
        navigator.clipboard.writeText(content);
    }, []);

    const handleShare = useCallback((content: string) => {
        if (navigator.share) {
            navigator.share({ text: content });
        }
    }, []);

    return (
        <div ref={chatContainerRef} className="flex-1 flex flex-col gap-3 sm:gap-4 lg:gap-6 overflow-y-auto p-3 sm:p-4 lg:p-6 max-w-4xl mx-auto w-full">
            {messages.filter(msg => msg && msg.role).map((msg, index) => (
                <ChatMessage
                    key={`${msg.role}-${index}`}
                    role={msg.role}
                    content={msg.content}
                    reasoning={msg.reasoning}
                    image={msg.image}
                    video={msg.video}
                    audio={msg.audio}
                    isStreaming={msg.isStreaming}
                    model={msg.model}
                    onCopy={() => handleCopy(msg.content)}
                    onRegenerate={handleRegenerate}
                    showActions={msg.role === 'assistant'}
                />
            ))}
            {loading && <ChatSkeleton />}
        </div>
    );
});

VirtualizedMessageList.displayName = 'VirtualizedMessageList';

function ChatPageContent() {
    const searchParams = useSearchParams();
    const { login, isAuthenticated, loading: authLoading } = useAuth();

    // Eager preload models in the background for instant access
    // This runs on component mount and preloads the first 50 models
    useEagerModelPreload();

    // Track recently used models for quick access
    const { recentModels, addRecentModel } = useRecentlyUsedModels();

    // All hooks must be declared before any conditional returns
    const [hasApiKey, setHasApiKey] = useState(false);
    const [message, setMessage] = useState('');
    const [userHasTyped, setUserHasTyped] = useState(false);
    const userHasTypedRef = useRef(userHasTyped);

    // Immediate log to confirm latest code is deployed
    console.log('[Chat Page] Component mounted - Version with auto-login and pending message queue');
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isStreamingResponse, setIsStreamingResponse] = useState(false);
    const [rateLimitCountdown, setRateLimitCountdown] = useState<number>(0);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState('');
    const [selectedModel, setSelectedModel] = useState<ModelOption | null>({
        value: 'openrouter/auto',
        label: 'Alpaca Router',
        category: 'Router',
        sourceGateway: 'openrouter',
        developer: 'Alpaca',
        modalities: ['Text', 'Image', 'File', 'Audio', 'Video']
    });
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
    const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const { toast } = useToast();
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const messageInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);
    const fallbackAttemptRef = useRef<{ messageId: string; attempts: number } | null>(null);

    // Helper function to get display name for a model ID
    const getModelDisplayName = (modelId?: string): string => {
        if (!modelId) return selectedModel?.label || 'Unknown Model';

        // If it's the current model, return its label
        if (modelId === selectedModel?.value) {
            return selectedModel.label;
        }

        // Try to extract a readable name from the model ID
        // Format is typically "provider/model-name" (e.g., "openai/gpt-4")
        const parts = modelId.split('/');
        if (parts.length > 1) {
            // Return the model name part, capitalizing first letter
            const modelName = parts[1];
            return modelName.charAt(0).toUpperCase() + modelName.slice(1);
        }

        // Fallback to the full model ID
        return modelId;
    };

    // Helper function to get dynamic placeholder text based on model capabilities
    const getPlaceholderText = (): string => {
        if (!selectedModel) return 'Start A Message';

        const capabilities = [];
        if (selectedModel.modalities?.includes('Image')) capabilities.push('image');
        if (selectedModel.modalities?.includes('Video')) capabilities.push('video');
        if (selectedModel.modalities?.includes('Audio')) capabilities.push('audio');

        if (capabilities.length === 0) {
            return 'Start A Message';
        } else if (capabilities.length === 1) {
            return `Type a message or add an ${capabilities[0]}...`;
        } else if (capabilities.length === 2) {
            return `Type a message or add ${capabilities.join(' and ')}...`;
        } else {
            return `Type a message or add ${capabilities.join(', ')}...`;
        }
    };

    useEffect(() => {
        userHasTypedRef.current = userHasTyped;
    }, [userHasTyped]);

    // Always use Alpaca Router as default - removed credit-based selection
    // Users can manually select other models if they prefer

    // Track which sessions have loaded their messages
    const [loadedSessionIds, setLoadedSessionIds] = useState<Set<string>>(new Set());
    const [loadingMessages, setLoadingMessages] = useState(false);

    // Track if we should auto-send the message from URL
    const [shouldAutoSend, setShouldAutoSend] = useState(false);

    // Track if we're currently creating a session to prevent race conditions
    const creatingSessionRef = useRef(false);
    const createSessionPromiseRef = useRef<Promise<ChatSession | null> | null>(null);

    // Track if auto-send has already been triggered to prevent duplicate sends
    const autoSendTriggeredRef = useRef(false);

    // Store handleSendMessage ref to avoid closure staling in effects
    const handleSendMessageRef = useRef<() => Promise<void>>();

    // Trigger for forcing session reload after API key becomes available
    const [authReady, setAuthReady] = useState(false);

    // Queue message to be sent after authentication completes
    const [pendingMessage, setPendingMessage] = useState<{message: string, model: ModelOption | null, image?: string | null, video?: string | null, audio?: string | null} | null>(null);

    // Message queue to prevent duplicate sends and race conditions
    const messageQueueRef = useRef<MessageQueue | null>(null);
    if (!messageQueueRef.current) {
        messageQueueRef.current = new MessageQueue();
    }

    // Test backend connectivity function
    const testBackendConnectivity = async () => {
        const apiKey = getApiKey();
        const userData = getUserData();
        
        if (!apiKey || !userData?.privy_user_id) {
            console.error('❌ Cannot test backend - missing API key or user data');
            return false;
        }

        try {
            console.log('🧪 Testing backend connectivity...');
            const chatAPI = new ChatHistoryAPI(apiKey, undefined, userData.privy_user_id);
            
            // Test 1: Get sessions (this is the most important one)
            const sessions = await chatAPI.getSessions(5, 0);
            console.log('✅ Backend test - Get sessions:', sessions);
            
            // Test 2: Get stats (skip if it fails due to backend bug)
            try {
                const stats = await chatAPI.getStats();
                console.log('✅ Backend test - Get stats:', stats);
            } catch (statsError) {
                console.warn('⚠️ Backend test - Get stats failed (backend bug):', statsError);
                console.log('ℹ️ This is a known backend issue with the stats endpoint, but sessions should work fine');
            }
            
            return true;
        } catch (error) {
            console.error('❌ Backend test failed:', error);
            return false;
        }
    };

    // Upgrade temp API key if needed (must be before early return)
    const upgradeTempKeyIfNeeded = useCallback(
        async (currentKey: string, currentUserData: UserData | null): Promise<string> => {
            if (
                !currentKey ||
                !currentUserData ||
                !currentKey.startsWith(TEMP_API_KEY_PREFIX) ||
                Math.floor(currentUserData.credits ?? 0) <= 10
            ) {
                return currentKey;
            }

            try {
                const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
                const response = await fetch(`${apiBaseUrl}/user/api-keys`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${currentKey}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    console.log('[Auth] Unable to upgrade API key during send:', response.status);
                    return currentKey;
                }

                const data = await response.json();
                const keys: Array<{ api_key?: string; is_primary?: boolean; environment_tag?: string }> =
                    Array.isArray(data?.keys) ? data.keys : [];

                const upgraded =
                    keys.find(
                        (key) =>
                            key?.api_key &&
                            !key.api_key.startsWith(TEMP_API_KEY_PREFIX) &&
                            key.environment_tag === 'live' &&
                            key.is_primary
                    ) ||
                    keys.find(
                        (key) =>
                            key?.api_key &&
                            !key.api_key.startsWith(TEMP_API_KEY_PREFIX) &&
                            key.environment_tag === 'live'
                    ) ||
                    keys.find((key) => key?.api_key && !key.api_key.startsWith(TEMP_API_KEY_PREFIX));

                if (upgraded?.api_key && upgraded.api_key !== currentKey) {
                    console.log('[Auth] Upgraded API key obtained during message send');
                    saveApiKey(upgraded.api_key);
                    saveUserData({
                        ...currentUserData,
                        api_key: upgraded.api_key
                    });
                    setHasApiKey(true);
                    return upgraded.api_key;
                }
            } catch (error) {
                console.log('[Auth] Failed upgrading API key during send:', error);
            }

            return currentKey;
        },
        [setHasApiKey]
    );

    // Handle model and message from URL parameters (guard against null searchParams)
    useEffect(() => {
        if (!searchParams) return;
        
        console.log('[URL Params] useEffect triggered, searchParams:', searchParams);

        const modelParam = searchParams.get('model');
        const messageParam = searchParams.get('message');
        console.log('[URL Params] Parsed params:', { modelParam, messageParam });

        if (modelParam) {
            console.log('URL model parameter detected:', modelParam);
            // Check ModelSelect's localStorage cache first (avoid redundant API calls)
            const CACHE_KEY = 'gatewayz_models_cache_v5_optimized';
            const cached = localStorage.getItem(CACHE_KEY);

            if (cached) {
                try {
                    const { data, timestamp } = JSON.parse(cached);
                    const CACHE_DURATION = 60 * 60 * 1000; // 60 minutes

                    // Use cache if valid
                    if (Date.now() - timestamp < CACHE_DURATION && data && data.length > 0) {
                        const foundModel = data.find((m: any) => m.value === modelParam);
                        if (foundModel) {
                            console.log('Found model from cache:', foundModel.label, foundModel.value);
                            setSelectedModel(foundModel);
                        } else {
                            console.warn('Model not found in cache:', modelParam);
                            // Fallback: create basic model option from parameter
                            // Extract gateway from model ID (e.g., 'google/gemini-pro' -> 'google')
                            const extractedGateway = modelParam.includes('/')
                                ? modelParam.split('/')[0]
                                : (modelParam.includes('openrouter') ? 'openrouter' : 'unknown');
                            setSelectedModel({
                                value: modelParam,
                                label: modelParam.split('/').pop() || modelParam,
                                category: 'Unknown',
                                sourceGateway: extractedGateway
                            });
                        }
                    }
                } catch (e) {
                    console.error('Failed to parse model cache:', e);
                    // Fallback: create basic model option
                    // Extract gateway from model ID (e.g., 'google/gemini-pro' -> 'google')
                    const extractedGateway = modelParam.includes('/')
                        ? modelParam.split('/')[0]
                        : 'unknown';
                    setSelectedModel({
                        value: modelParam,
                        label: modelParam.split('/').pop() || modelParam,
                        category: 'Unknown',
                        sourceGateway: extractedGateway
                    });
                }
            } else {
                // No cache available, create basic model option and let ModelSelect load in background
                console.log('No cache available, using fallback model option');
                // Extract gateway from model ID (e.g., 'google/gemini-pro' -> 'google')
                const extractedGateway = modelParam.includes('/')
                    ? modelParam.split('/')[0]
                    : 'unknown';
                setSelectedModel({
                    value: modelParam,
                    label: modelParam.split('/').pop() || modelParam,
                    category: 'Unknown',
                    sourceGateway: extractedGateway
                });
            }
        }

        // Set the message from URL parameter and flag for auto-send
        const autoSendParam = searchParams.get('autoSend');
        console.log('[URL Params] Detected:', { messageParam, autoSendParam });

        if (messageParam) {
            const decodedMessage = decodeURIComponent(messageParam);
            console.log('[URL Params] Setting message:', decodedMessage);
            setMessage(decodedMessage);
            setUserHasTyped(true); // Allow auto-send from URL
            userHasTypedRef.current = true;

            // Auto-send if explicitly requested via autoSend parameter, or if message param exists
            if (autoSendParam === 'true' || messageParam) {
                console.log('[URL Params] Setting shouldAutoSend = true');
                setShouldAutoSend(true);
            }
        }
    }, [searchParams]);

    const activeSession = useMemo(() => {
        return sessions.find(s => s.id === activeSessionId) || null;
    }, [sessions, activeSessionId]);

    // Filter and deduplicate messages to prevent unsent messages from appearing in history
    // Messages are deduplicated by checking for any duplicate (same role + content anywhere in history)
    const messages = ((activeSession?.messages || []).filter(msg => msg && msg.role) as Message[]).reduce((acc, msg) => {
        // Skip if this message already exists in accumulated messages
        const isDuplicate = acc.some(m =>
            m.role === msg.role &&
            m.content === msg.content &&
            m.image === msg.image &&
            m.video === msg.video &&
            m.audio === msg.audio
        );

        if (isDuplicate) {
            console.warn('[MessageDedup] Skipping duplicate message:', { role: msg.role, contentLength: msg.content.length });
            return acc;
        }
        return [...acc, msg];
    }, [] as Message[]);

    // Auto-send message from URL parameter when session is ready
    useEffect(() => {
        console.log('[AutoSend] Effect triggered:', {
            shouldAutoSend,
            activeSessionId,
            hasMessage: !!message.trim(),
            message: message,
            hasModel: !!selectedModel,
            selectedModel: selectedModel?.label,
            loading,
            creatingSession: creatingSessionRef.current,
            isStreamingResponse,
            hasPendingMessage: !!pendingMessage,
            autoSendTriggered: autoSendTriggeredRef.current
        });

        // If we have a pending message, let the pending message handler deal with it
        if (pendingMessage) {
            console.log('[AutoSend] Pending message exists, waiting for auth/session to complete before auto-sending.');
            return;
        }

        // If shouldAutoSend is true but we don't have a session yet, trigger session creation
        // Note: We use a ref to track if we're already creating to avoid dependency issues
        if (shouldAutoSend && !activeSessionId && message.trim() && selectedModel && !loading && !creatingSessionRef.current && !isStreamingResponse) {
            const apiKey = getApiKey();
            const userData = getUserData();
            
            // Only create session if we're authenticated
            if (apiKey && userData?.privy_user_id) {
                console.log('[AutoSend] Session needed for auto-send, will be handled by session loading logic');
                // The session loading logic will create a new chat when message param is detected
                // We just need to ensure shouldAutoSend stays true until session is ready
                return;
            }
        }

        // All conditions met - send the message
        if (
            shouldAutoSend &&
            activeSessionId &&
            message.trim() &&
            selectedModel &&
            !loading &&
            !creatingSessionRef.current &&
            !isStreamingResponse &&
            !autoSendTriggeredRef.current
        ) {
            console.log('[AutoSend] All conditions met! Sending message now...');
            autoSendTriggeredRef.current = true; // Mark as triggered to prevent re-sending
            setShouldAutoSend(false); // Reset flag
            // Use ref to avoid dependency on handleSendMessage which is defined later
            if (handleSendMessageRef.current) {
                handleSendMessageRef.current();
            }
        }
    }, [shouldAutoSend, activeSessionId, message, selectedModel, loading, isStreamingResponse, pendingMessage]);

    // Check for API key in localStorage as fallback authentication
    useEffect(() => {
        const updateApiKeyState = () => {
            const apiKey = getApiKey();
            setHasApiKey(!!apiKey);
        };

        updateApiKeyState();

        if (typeof window === 'undefined') {
            return;
        }

        const handleStorageChange = (event: StorageEvent) => {
            if (!event.key || event.key === 'gatewayz_api_key') {
                updateApiKeyState();
            }
        };

        const handleAuthRefresh = () => updateApiKeyState();

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener(AUTH_REFRESH_EVENT as unknown as string, handleAuthRefresh as EventListener);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener(AUTH_REFRESH_EVENT as unknown as string, handleAuthRefresh as EventListener);
        };
    }, [authLoading, isAuthenticated]);

    // Check for referral bonus notification flag
    useEffect(() => {
        if (authLoading || !(isAuthenticated || hasApiKey) || typeof window === 'undefined') return;

        // Check if we should show referral bonus notification
        const showReferralBonus = localStorage.getItem('gatewayz_show_referral_bonus');
        if (showReferralBonus === 'true') {
            // Remove the flag
            localStorage.removeItem('gatewayz_show_referral_bonus');

            // Show the bonus credits notification
            setTimeout(() => {
                toast({
                    title: "Bonus Credits Added!",
                    description: "An additional $10 in free credits has been added to your account from your referral. Start chatting!",
                    duration: 8000,
                });
            }, 1000); // Delay to allow page to settle
        }
    }, [authLoading, isAuthenticated, hasApiKey]);

    // Send pending message after authentication completes
    useEffect(() => {
        if (!pendingMessage) return;
        if (authLoading) return;
        if (!isAuthenticated && !hasApiKey) return;

        const apiKey = getApiKey();

        // Wait for API key to be available
        if (!apiKey) {
            console.log('[Pending Message] Waiting for API key to be available...');
            return;
        }

        // Wait for active session to be created
        if (!activeSessionId) {
            console.log('[Pending Message] Waiting for active session to be created...');
            return;
        }

        // All conditions met - send the pending message
        console.log('[Pending Message] Auth complete! Sending pending message:', pendingMessage.message);

        // Restore the message to state
        setMessage(pendingMessage.message);
        if (pendingMessage.model) {
            setSelectedModel(pendingMessage.model);
        }
        if (pendingMessage.image) {
            setSelectedImage(pendingMessage.image);
        }
        setUserHasTyped(true);
        userHasTypedRef.current = true;

        // Set shouldAutoSend flag to ensure auto-send effect triggers
        setShouldAutoSend(true);

        // Clear pending message
        setPendingMessage(null);

        // Trigger send after a short delay to ensure state is updated
        // Note: We rely on the auto-send effect to actually send, which will handle
        // the case where activeSessionId might not be set yet
        setTimeout(() => {
            // If session is ready, send immediately, otherwise auto-send effect will handle it
            if (activeSessionId && !loading && !creatingSessionRef.current && !isStreamingResponse) {
                handleSendMessage();
            }
        }, 100);

    }, [pendingMessage, authLoading, isAuthenticated, hasApiKey, activeSessionId]);

    useEffect(() => {
        // Optimized: Load sessions in parallel with auth, don't wait for ready state
        // This significantly improves perceived load time
        const apiKey = getApiKey();
        const userData = getUserData();

        // If we already have API key in localStorage, start loading immediately
        if (apiKey && userData?.privy_user_id) {
            let isMounted = true; // Track if component is still mounted

            const loadSessions = async () => {
                try {
                    const sessionsData = await apiHelpers.loadChatSessions('user-1');

                    if (!isMounted) return; // Don't update state if unmounted

                    setSessions(sessionsData);

                    // Check if there's a message parameter in the URL - if so, create a new chat
                    const messageParam = searchParams?.get('message');
                    if (messageParam) {
                        console.log('[loadSessions] Message parameter detected, creating new chat instead of loading recent session');
                        const newSession = await createNewChat();
                        // After creating session, the auto-send effect will trigger when activeSessionId is set
                        if (newSession) {
                            console.log('[loadSessions] New session created, activeSessionId will be set and auto-send will trigger');
                        }
                        return;
                    }

                    // Select the most recent session by default (most likely to have messages)
                    // Sort by updatedAt descending to get the most recently active session
                    const mostRecentSession = [...sessionsData].sort((a, b) =>
                        b.updatedAt.getTime() - a.updatedAt.getTime()
                    )[0];

                    // If there are existing sessions, load the most recent one
                    // Otherwise, create a new chat session
                    if (mostRecentSession) {
                        console.log('[loadSessions] Loaded sessions, switching to most recent:', mostRecentSession.id);
                        setActiveSessionId(mostRecentSession.id);
                    } else {
                        console.log('[loadSessions] No existing sessions, creating new chat');
                        // Auto-create first chat session when no sessions exist
                        await createNewChat();
                    }
                } catch (error) {
                    console.error('[loadSessions] Failed to load sessions:', error);
                    // Failed to load sessions, fallback to creating a new chat
                    if (isMounted) {
                        createNewChat();
                    }
                }
            };

            loadSessions();

            return () => {
                isMounted = false; // Cleanup: mark as unmounted
            };
        }

        // If no API key yet, wait for authentication to complete
        if (authLoading) {
            return;
        }

        if (!isAuthenticated && !hasApiKey) {
            return;
        }

        // Wait for API key to be saved to localStorage after authentication
        if (!apiKey || !userData?.privy_user_id) {
            // Retry with increasing intervals until we have the API key
            const checkInterval = setInterval(() => {
                const key = getApiKey();
                const data = getUserData();
                if (key && data?.privy_user_id) {
                    clearInterval(checkInterval);
                    // Trigger auth ready state to force effect to re-run
                    setAuthReady(prev => !prev);
                }
            }, 100);

            // Clean up after 10 seconds
            const timeoutId = window.setTimeout(() => clearInterval(checkInterval), 10000);
            return () => {
                clearInterval(checkInterval);
                clearTimeout(timeoutId);
            };
        }
    }, [authLoading, isAuthenticated, hasApiKey, searchParams, authReady]);

    // Handle rate limit countdown timer
    useEffect(() => {
        if (rateLimitCountdown > 0) {
            const timer = setInterval(() => {
                setRateLimitCountdown(prev => {
                    if (prev <= 1) {
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(timer);
        }
    }, [rateLimitCountdown]);

    // Note: In a real app, you would save sessions to backend API here
    // useEffect(() => {
    //     // Save sessions to backend API whenever they change
    //     if(sessions.length > 0) {
    //         saveSessionsToAPI(sessions);
    //     }
    // }, [sessions]);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // Lazy load messages when switching to a session
    const switchToSession = async (sessionId: string) => {
        const session = sessions.find(s => s.id === sessionId);
        if (!session) {
            console.warn('[switchToSession] Session not found:', sessionId);
            return;
        }

        console.log('[switchToSession] Switching to session:', {
            sessionId,
            hasMessages: session.messages.length > 0,
            messageCount: session.messages.length,
            hasApiSessionId: !!session.apiSessionId,
            alreadyLoaded: loadedSessionIds.has(sessionId)
        });

        // Log analytics event for session switch
        logAnalyticsEvent('chat_session_switched', {
            session_id: sessionId,
            has_messages: session.messages.length > 0,
            message_count: session.messages.length
        });

        // Reset auto-send flag when switching sessions
        autoSendTriggeredRef.current = false;

        // Set active session immediately for UI responsiveness
        setActiveSessionId(sessionId);

        // If messages already loaded or session is new (no messages), skip loading
        if (loadedSessionIds.has(sessionId) || session.messages.length > 0) {
            console.log('[switchToSession] Skipping message load (already loaded or has messages)');
            return;
        }

        // Load messages for this session
        if (session.apiSessionId) {
            console.log('[switchToSession] Loading messages for session:', sessionId, 'apiSessionId:', session.apiSessionId);
            setLoadingMessages(true);
            try {
                const messages = await apiHelpers.loadSessionMessages(sessionId, session.apiSessionId);
                console.log('[switchToSession] Loaded messages:', messages.length);

                // Update the session with loaded messages
                setSessions(prev => prev.map(s =>
                    s.id === sessionId ? { ...s, messages } : s
                ));

                // Mark session as loaded
                setLoadedSessionIds(prev => new Set(prev).add(sessionId));
            } catch (error) {
                console.error('[switchToSession] Failed to load messages:', error);
            } finally {
                setLoadingMessages(false);
            }
        } else {
            console.warn('[switchToSession] No apiSessionId for session:', sessionId);
        }
    };

    const createNewChat = async () => {
        // Return existing promise if session creation is already in progress
        if (createSessionPromiseRef.current) {
            console.log('[createNewChat] Session creation already in progress, returning existing promise');
            return createSessionPromiseRef.current;
        }

        // Check if there's already a new/empty chat session
        const existingNewChat = sessions.find(session =>
            session.messages.length === 0 &&
            session.title === 'Untitled Chat'
        );

        if (existingNewChat) {
            // If there's already a new chat, just switch to it
            autoSendTriggeredRef.current = false; // Reset auto-send flag for new chat
            switchToSession(existingNewChat.id);
            return existingNewChat;
        }

        // Create promise for session creation with optimistic UI
        const createPromise = (async () => {
            // Atomic check-and-set
            const wasCreating = creatingSessionRef.current;
            creatingSessionRef.current = true;

            if (wasCreating) {
                console.log('[createNewChat] Race condition detected, another creation in progress');
                return null;
            }

            // Create optimistic session for immediate UI feedback (instead of 1-2s wait)
            const tempSessionId = `local-${Date.now()}`;
            const optimisticSession: ChatSession = {
                id: tempSessionId,
                title: 'Untitled Chat',
                startTime: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                userId: 'current-user',
                messages: []
            };

            try {
                // Show session immediately (perceived speed improvement: 1-2s → instant)
                setActiveSessionId(tempSessionId);
                setSessions(prev => [optimisticSession, ...prev]);
                autoSendTriggeredRef.current = false; // Reset auto-send flag for new chat

                console.log('[Chat] Optimistic session created, now confirming with backend...');

                // Create session in backend asynchronously
                const realSession = await apiHelpers.createChatSession('Untitled Chat', selectedModel?.value);

                console.log('[Chat] Backend session confirmed, updating with real data');

                // Log analytics event for new chat creation
                logAnalyticsEvent('chat_session_created', {
                    session_id: realSession.id,
                    model: selectedModel?.value
                });

                // Replace optimistic session with real session
                setSessions(prev => 
                    prev.map(session => 
                        session.id === tempSessionId ? realSession : session
                    )
                );
                setActiveSessionId(realSession.id);

                return realSession;
            } catch (error) {
                console.error('[Chat] Failed to create session:', error);
                
                // Rollback optimistic session on error
                setSessions(prev => prev.filter(session => session.id !== tempSessionId));
                setActiveSessionId(null);

                toast({
                    title: "Error",
                    description: `Failed to create new chat session: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    variant: 'destructive'
                });
                return null;
            } finally {
                creatingSessionRef.current = false;
                createSessionPromiseRef.current = null;
            }
        })();

        createSessionPromiseRef.current = createPromise;
        return createPromise;
    };

    const handleExamplePromptClick = (promptText: string) => {
        // Set the message input to the clicked prompt
        setMessage(promptText);
        setUserHasTyped(true);
        userHasTypedRef.current = true;
        // Focus on the input
        setTimeout(() => {
            messageInputRef.current?.focus();
        }, 100);
    }

    const handleDeleteSession = async (sessionId: string) => {
        try {
            // Delete from API
            await apiHelpers.deleteChatSession(sessionId, sessions);
            
            setSessions(prev => {
                const updatedSessions = prev.filter(session => session.id !== sessionId);
                // If the deleted session was active, switch to the first available session or create a new one
                if (activeSessionId === sessionId) {
                    if (updatedSessions.length > 0) {
                        switchToSession(updatedSessions[0].id);
                    } else {
                        createNewChat();
                    }
                }
                return updatedSessions;
            });
        } catch (error) {
            console.error('Failed to delete chat session:', error);
            toast({
                title: "Error",
                description: "Failed to delete chat session. Please try again.",
                variant: 'destructive'
            });
        }
    }

    // OPTIMIZATION: Debounced session rename with optimistic updates
    const debouncedSessionUpdate = useMemo(
        () => debounce(async (sessionId: string, newTitle: string, oldSession: ChatSession) => {
            try {
                await apiHelpers.updateChatSession(sessionId, { title: newTitle }, sessions);
                console.log('[Optimization] Session rename synced to backend');
            } catch (error) {
                console.error('Failed to rename chat session:', error);
                // Rollback on failure
                setSessions(prev => prev.map(session =>
                    session.id === sessionId ? oldSession : session
                ));
                toast({
                    title: "Error",
                    description: "Failed to rename chat session. Changes reverted.",
                    variant: 'destructive'
                });
            }
        }, 500), // Wait 500ms after user stops typing
        [sessions]
    );

    const handleRenameSession = (sessionId: string, newTitle: string) => {
        const oldSession = sessions.find(s => s.id === sessionId);
        if (!oldSession) return;

        // OPTIMIZATION: Update UI immediately (optimistic)
        setSessions(prev => prev.map(session =>
            session.id === sessionId
                ? { ...session, title: newTitle, updatedAt: new Date() }
                : session
        ));

        // OPTIMIZATION: Sync to backend (debounced)
        debouncedSessionUpdate(sessionId, newTitle, oldSession);
    }

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast({
                title: "Invalid file type",
                description: "Please select an image file.",
                variant: 'destructive'
            });
            return;
        }

        // Validate file size (max 10MB before compression)
        if (file.size > 10 * 1024 * 1024) {
            toast({
                title: "File too large",
                description: "Please select an image smaller than 10MB.",
                variant: 'destructive'
            });
            return;
        }

        try {
            // Optimize image: resize and convert to WebP for better compression
            const optimizedImage = await optimizeImage(file);
            setSelectedImage(optimizedImage);

            toast({
                title: "Image uploaded",
                description: "Your image has been optimized and is ready to send.",
            });
        } catch (error) {
            toast({
                title: "Error processing image",
                description: "Failed to process the image file.",
                variant: 'destructive'
            });
        }
    };

    // Optimize image by resizing and converting to WebP
    const optimizeImage = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    // Create canvas for image processing
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Failed to get canvas context'));
                        return;
                    }

                    // Calculate optimal dimensions (max 1920x1080 for better performance)
                    const MAX_WIDTH = 1920;
                    const MAX_HEIGHT = 1080;
                    let width = img.width;
                    let height = img.height;

                    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
                        width = Math.floor(width * ratio);
                        height = Math.floor(height * ratio);
                    }

                    // Set canvas dimensions
                    canvas.width = width;
                    canvas.height = height;

                    // Draw image with high quality
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to WebP with compression (0.85 quality for good balance)
                    // Fallback to JPEG if WebP not supported
                    const supportsWebP = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
                    const format = supportsWebP ? 'image/webp' : 'image/jpeg';
                    const quality = 0.85;

                    const optimizedBase64 = canvas.toDataURL(format, quality);

                    // Log compression stats
                    const originalSize = file.size;
                    const optimizedSize = Math.round((optimizedBase64.length * 3) / 4);
                    const savings = Math.round((1 - optimizedSize / originalSize) * 100);
                    console.log(`Image optimized: ${(originalSize / 1024).toFixed(1)}KB → ${(optimizedSize / 1024).toFixed(1)}KB (${savings}% reduction)`);

                    resolve(optimizedBase64);
                }
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = event.target?.result as string;
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    };

    const handleRemoveImage = () => {
        setSelectedImage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('video/')) {
            toast({
                title: "Invalid file type",
                description: "Please select a video file.",
                variant: 'destructive'
            });
            return;
        }

        // Validate file size (max 100MB for video)
        const maxSize = 100 * 1024 * 1024;
        if (file.size > maxSize) {
            toast({
                title: "File too large",
                description: "Please select a video smaller than 100MB.",
                variant: 'destructive'
            });
            return;
        }

        try {
            // Convert video to base64
            const videoBase64 = await fileToBase64(file);
            setSelectedVideo(videoBase64);

            toast({
                title: "Video uploaded",
                description: `${file.name} is ready to send.`,
            });
        } catch (error) {
            toast({
                title: "Error processing video",
                description: "Failed to process the video file.",
                variant: 'destructive'
            });
        }
    };

    const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('audio/')) {
            toast({
                title: "Invalid file type",
                description: "Please select an audio file.",
                variant: 'destructive'
            });
            return;
        }

        // Validate file size (max 50MB for audio)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            toast({
                title: "File too large",
                description: "Please select an audio file smaller than 50MB.",
                variant: 'destructive'
            });
            return;
        }

        try {
            // Convert audio to base64
            const audioBase64 = await fileToBase64(file);
            setSelectedAudio(audioBase64);

            toast({
                title: "Audio uploaded",
                description: `${file.name} is ready to send.`,
            });
        } catch (error) {
            toast({
                title: "Error processing audio",
                description: "Failed to process the audio file.",
                variant: 'destructive'
            });
        }
    };

    // Helper function to convert file to base64
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve(reader.result as string);
            };
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            reader.readAsDataURL(file);
        });
    };

    const handleRemoveVideo = () => {
        setSelectedVideo(null);
        if (videoInputRef.current) {
            videoInputRef.current.value = '';
        }
    };

    const handleRemoveAudio = () => {
        setSelectedAudio(null);
        if (audioInputRef.current) {
            audioInputRef.current.value = '';
        }
    };

    const handleRegenerate = async () => {
        if (!activeSessionId || messages.length === 0) return;
        
        // Get the last user message
        const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
        if (!lastUserMessage) return;
        
        // Remove the last assistant message
        const updatedMessages = messages.slice(0, -1);
        const updatedSessions = sessions.map(session => {
            if (session.id === activeSessionId) {
                return {
                    ...session,
                    messages: updatedMessages,
                    updatedAt: new Date()
                };
            }
            return session;
        });
        setSessions(updatedSessions);
        
        // Set the message to the last user message and send it again
        setMessage(lastUserMessage.content);
        setLoading(true);
        
        // Trigger the send message after a short delay
        setTimeout(() => {
            handleSendMessage();
        }, 100);
    };

    const handleModelSelect = (model: ModelOption | null) => {
        if (model) {
            logAnalyticsEvent('model_selected', {
                model_id: model.value,
                model_name: model.label,
                category: model.category,
                gateway: model.sourceGateway
            });
            // Track model as recently used for instant access next time
            addRecentModel(model);
        }
        setSelectedModel(model);

        // Clear selected media if switching to a model that doesn't support those modalities
        if (model) {
            if (!model.modalities?.includes('Image') && selectedImage) {
                handleRemoveImage();
            }
            if (!model.modalities?.includes('Video') && selectedVideo) {
                handleRemoveVideo();
            }
            if (!model.modalities?.includes('Audio') && selectedAudio) {
                handleRemoveAudio();
            }
        }
    };

    const handleSendMessage = async (retryCount = 0) => {
        // Check if there's actually a message to send
        if (!message.trim()) {
            return;
        }

        if (isStreamingResponse) {
            toast({
                title: "Please wait",
                description: "We're still finishing the previous response. Try again in a moment.",
                variant: 'default'
            });
            return;
        }

        // Check authentication first
        let apiKey = getApiKey();
        let userData = getUserData();

        if (apiKey && userData) {
            const upgradedKey = await upgradeTempKeyIfNeeded(apiKey, userData);
            if (upgradedKey !== apiKey) {
                apiKey = upgradedKey;
                userData = { ...userData, api_key: upgradedKey };
            }
        }

        // Only require API key for sending messages - Privy user data is optional for history
        if (!apiKey) {
            console.log('[Auth] No API key - queuing message and triggering login');

            // Queue the message to be sent after authentication
            setPendingMessage({
                message: message.trim(),
                model: selectedModel,
                image: selectedImage,
                video: selectedVideo,
                audio: selectedAudio
            });

            // Show toast that we're logging them in
            toast({
                title: "Logging you in...",
                description: "Your message will be sent after you log in.",
                variant: 'default'
            });

            // Auto-trigger login only if not already authenticated via Privy
            if (!isAuthenticated) {
                login();
            }
            return;
        }

        if (!message.trim() || !selectedModel) {
            toast({
                title: "Cannot send message",
                description: !selectedModel ? "Please select a model first." : "Please enter a message.",
                variant: 'destructive'
            });
            return;
        }

        // Check if session exists - if not, auto-create silently
        const trimmedMessage = message.trim();
        let currentSessionId = activeSessionId;
        if (!currentSessionId) {
            console.log('[Session] No active session - creating and queuing send');

            // Queue the message to be sent after session is ready
            setPendingMessage({
                message: trimmedMessage,
                model: selectedModel,
                image: selectedImage,
                video: selectedVideo,
                audio: selectedAudio
            });

            // Create new session silently (no toast)
            if (!creatingSessionRef.current) {
                try {
                    const newSession = await createNewChat();
                    if (newSession) {
                        console.log('[Session] Chat session created successfully:', newSession.id);
                        // Session will trigger pendingMessage effect automatically
                    }
                } catch (error) {
                    console.error('[Session] Failed to create chat session:', error);
                    toast({
                        title: "Error",
                        description: "Failed to create chat session. Please try again.",
                        variant: 'destructive'
                    });
                }
            }
            return;
        }

        const isFirstMessage = messages.length === 0;
        const userMessage = message;
        const userImage = selectedImage;
        const userVideo = selectedVideo;
        const userAudio = selectedAudio;

        // Check if this exact message already exists in history to prevent duplicate user messages
        const isDuplicateMessage = messages.some(msg =>
            msg.role === 'user' &&
            msg.content === userMessage &&
            msg.image === (userImage || undefined) &&
            msg.video === (userVideo || undefined) &&
            msg.audio === (userAudio || undefined)
        );

        if (isDuplicateMessage) {
            console.warn('[MessageDedup] Attempted to add duplicate message, aborting send:', { content: userMessage.substring(0, 50) });
            toast({
                title: "Duplicate message",
                description: "This message was already sent.",
                variant: 'default'
            });
            return;
        }

        // Set loading state to prevent double-clicks on send button
        setLoading(true);

        const updatedMessages: Message[] = [...messages, {
            role: 'user' as const,
            content: userMessage,
            image: userImage || undefined,
            video: userVideo || undefined,
            audio: userAudio || undefined
        }];

        // Generate title if this is the first message
        let newTitle = isFirstMessage ? generateChatTitle(userMessage) : undefined;

        // OPTIMIZATION: Optimistic UI - add assistant message immediately with streaming flag
        // This makes the UI feel more responsive by showing typing indicator right away
        const optimisticAssistantMessage: Message = {
            role: 'assistant',
            content: '',
            reasoning: '',
            isStreaming: true,
            model: selectedModel.value
        };

        const updatedSessions = sessions.map(session => {
            if (session.id === currentSessionId) {
                return {
                    ...session,
                    title: isFirstMessage && newTitle ? newTitle : session.title,
                    messages: [...updatedMessages, optimisticAssistantMessage],
                    updatedAt: new Date()
                };
            }
            return session;
        });
        setSessions(updatedSessions);

        setMessage('');
        setSelectedImage(null);
        setSelectedVideo(null);
        setSelectedAudio(null);
        setUserHasTyped(false); // Reset the flag so unsent messages don't get re-sent
        userHasTypedRef.current = false;
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        if (videoInputRef.current) {
            videoInputRef.current.value = '';
        }
        if (audioInputRef.current) {
            audioInputRef.current.value = '';
        }
        setIsStreamingResponse(true); // Set streaming state immediately

        // Use ChatStreamHandler to manage streaming state and prevent scope issues
        // Declare outside try-catch so it's accessible in both blocks
        const streamHandler = new ChatStreamHandler();

        // Safety timeout: Reset loading state after 45 seconds if streaming hasn't completed
        // This ensures the send button is never permanently disabled due to stream timeout
        const loadingTimeout = setTimeout(() => {
            if (isStreamingResponse) {
                console.warn('[Chat] Streaming took over 45 seconds, resetting loading state to unblock UI');
                setLoading(false);
                setIsStreamingResponse(false);
            }
        }, 45000);

        try {
            console.log('🚀 Starting handleSendMessage - Core auth check:', {
                hasApiKey: !!apiKey,
                hasUserData: !!userData,
                hasPrivyUserId: !!userData?.privy_user_id,
                userDataKeys: userData ? Object.keys(userData) : []
            });

            // Auth is already checked at the beginning of handleSendMessage
            const privyUserId = userData?.privy_user_id;

            // Call backend API directly with privy_user_id and session_id query parameters
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

            console.log('🔧 API Configuration:', {
                apiBaseUrl,
                privyUserId: privyUserId ? `${privyUserId.substring(0, 20)}...` : 'NO_ID',
                activeSessionId: currentSessionId
            });

            // Get current session to find API session ID
            const currentSession = sessions.find(s => s.id === currentSessionId);
            console.log('📋 Current session found:', {
                hasSession: !!currentSession,
                sessionId: currentSession?.id,
                apiSessionId: currentSession?.apiSessionId,
                messagesCount: currentSession?.messages?.length || 0
            });

            // OPTIMIZATION: Save the user message to the backend asynchronously
            // Don't block the streaming request - send both in parallel
            // The message is already in the UI optimistically
            if (currentSession?.apiSessionId && userData) {
                const saveUserMessage = async () => {
                    try {
                        devLog('🔄 Attempting to save user message to backend:', {
                            sessionId: currentSession.apiSessionId,
                            content: userMessage.substring(0, 100) + '...',
                            model: selectedModel.value,
                            hasImage: !!userImage,
                            apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'NO_API_KEY',
                            privyUserId: userData.privy_user_id
                        });

                        const chatAPI = new ChatHistoryAPI(apiKey, undefined, userData.privy_user_id);
                        if (currentSession.apiSessionId) {
                            const result = await chatAPI.saveMessage(
                                currentSession.apiSessionId,
                                'user',
                                userMessage,
                                selectedModel.value,
                                undefined // Token count not calculated yet
                            );
                            devLog('✅ User message saved to backend successfully:', result);
                        }
                    } catch (error) {
                        devError('❌ Failed to save user message to backend:', error);
                        devError('Error details:', {
                            message: error instanceof Error ? error.message : String(error),
                            stack: error instanceof Error ? error.stack : undefined,
                            sessionId: currentSession.apiSessionId,
                            hasApiKey: !!apiKey,
                            hasPrivyUserId: !!userData?.privy_user_id
                        });
                        // Don't throw - the message is already in the UI optimistically
                    }
                };
                // Start saving in background - don't await
                saveUserMessage();
            } else {
                devWarn('⚠️ Cannot save user message - no API session ID:', {
                    currentSession,
                    sessionId: currentSession?.apiSessionId,
                    currentSessionId
                });
            }

            // Build URL with session_id query parameter (gateway goes in request body)
            const sessionIdParam = currentSession?.apiSessionId ? `?session_id=${currentSession.apiSessionId}` : '';
            const url = `/api/chat/completions${sessionIdParam}`;

            console.log('Sending chat request to:', url);
            console.log('API Key:', apiKey.substring(0, 10) + '...');
            console.log('Model:', selectedModel.value);
            console.log('Gateway:', selectedModel.sourceGateway);
            console.log('Session ID:', currentSession?.apiSessionId || 'none');

            // Prepare message content with image, video, and audio if present
            let messageContent: any = userMessage;
            if (userImage || userVideo || userAudio) {
                const contentArray: any[] = [
                    { type: 'text', text: userMessage }
                ];

                if (userImage) {
                    contentArray.push({
                        type: 'image_url',
                        image_url: { url: userImage }
                    });
                }

                if (userVideo) {
                    contentArray.push({
                        type: 'video_url',
                        video_url: { url: userVideo }
                    });
                }

                if (userAudio) {
                    contentArray.push({
                        type: 'audio_url',
                        audio_url: { url: userAudio }
                    });
                }

                messageContent = contentArray;
            }

            // Note: Assistant message already added optimistically above, no need to add again

            try {
                // Use streaming API
                const modelValue = selectedModel.value === 'gpt-4o mini' ? 'deepseek/deepseek-v3.1' : selectedModel.value;

                // Detect the Portkey provider based on model characteristics
                // Only set portkey_provider for Portkey gateway models
                let portkeyProvider: string | undefined = undefined;

                if (selectedModel.sourceGateway === 'portkey') {
                    // DeepInfra models: typically community fine-tunes like airoboros, wizardlm, etc.
                    const deepInfraPatterns = ['airoboros', 'wizardlm', 'jondurbin', 'undi95', 'gryphe', 'alpindale'];
                    const isDeepInfra = deepInfraPatterns.some(pattern =>
                        modelValue?.toLowerCase().includes(pattern)
                    );

                    // OpenAI models
                    const openAIPatterns = ['gpt-', 'o1-', 'o3-'];
                    const isOpenAI = openAIPatterns.some(pattern =>
                        modelValue?.toLowerCase().includes(pattern)
                    );

                    // Anthropic models
                    const isAnthropic = modelValue?.toLowerCase().includes('claude');

                    if (isDeepInfra) {
                        portkeyProvider = 'deepinfra';
                    } else if (isOpenAI) {
                        portkeyProvider = 'openai';
                    } else if (isAnthropic) {
                        portkeyProvider = 'anthropic';
                    }
                    // If none match, leave undefined and let backend handle default routing
                }

                console.log('Model:', modelValue);
                console.log('Source Gateway:', selectedModel.sourceGateway);
                console.log('Portkey Provider:', portkeyProvider);
                console.log('Message content:', messageContent);
                console.log('Current messages:', messages);

                // Build conversation history for the API request
                const conversationHistory = [];
                
                // Add all previous messages from the conversation
                for (const msg of messages) {
                    if (msg.role === 'user') {
                        // Handle user messages with potential images, videos, or audio
                        if (msg.image || msg.video || msg.audio) {
                            const contentArray: any[] = [
                                { type: 'text', text: msg.content }
                            ];

                            if (msg.image) {
                                contentArray.push({
                                    type: 'image_url',
                                    image_url: { url: msg.image }
                                });
                            }

                            if (msg.video) {
                                contentArray.push({
                                    type: 'video_url',
                                    video_url: { url: msg.video }
                                });
                            }

                            if (msg.audio) {
                                contentArray.push({
                                    type: 'audio_url',
                                    audio_url: { url: msg.audio }
                                });
                            }

                            conversationHistory.push({
                                role: 'user',
                                content: contentArray
                            });
                        } else {
                            // Plain text message - use string content for chat/completions endpoint
                            conversationHistory.push({
                                role: 'user',
                                content: msg.content
                            });
                        }
                    } else if (msg.role === 'assistant') {
                        // Handle assistant messages (text only) - use plain string
                        conversationHistory.push({
                            role: 'assistant',
                            content: msg.content
                        });
                    }
                }

                // Add the current user message
                // messageContent is already in the correct format (string or OpenAI multimodal array)
                conversationHistory.push({
                    role: 'user',
                    content: messageContent
                });

                console.log('📝 Conversation history for API:', {
                    messagesCount: conversationHistory.length,
                    hasImages: conversationHistory.some(msg =>
                        Array.isArray(msg.content) && msg.content.some((c: any) => c.type === 'image_url')
                    ),
                    sample: conversationHistory.map((msg: any) => ({
                        role: msg.role,
                        contentLength: typeof msg.content === 'string'
                            ? msg.content.length
                            : Array.isArray(msg.content)
                                ? msg.content.map((c: any) => c.type).join(', ')
                                : 'unknown'
                    }))
                });

                const requestBody: any = {
                    model: modelValue,
                    messages: conversationHistory,
                    stream: true,
                    max_tokens: 8000  // Increased for reasoning models like DeepSeek
                };

                if (portkeyProvider) {
                    requestBody.portkey_provider = portkeyProvider;
                }

                // Add gateway parameter if specified (important for models like NEAR, Cerebras, etc.)
                if (selectedModel.sourceGateway) {
                    requestBody.gateway = selectedModel.sourceGateway;
                }

                // Session ID is already in the URL query parameter, no need to add it to the body

                console.log('📨 Request body prepared:', {
                    model: requestBody.model,
                    gateway: requestBody.gateway,
                    hasPortkeyProvider: !!requestBody.portkey_provider,
                    stream: requestBody.stream,
                    messagesLength: requestBody.messages?.length || 0,
                    url: url
                });

                // Reset the existing streamHandler (declared at top of try block)
                streamHandler.reset();

                console.log('🌊 Starting to stream response...');

                // Log analytics event for message sent
                logAnalyticsEvent('chat_message_sent', {
                    model: modelValue,
                    gateway: selectedModel.sourceGateway,
                    has_image: !!selectedImage,
                    has_video: !!selectedVideo,
                    has_audio: !!selectedAudio,
                    message_length: messageContent.length,
                    session_id: currentSessionId
                });

                // OPTIMIZATION: Batch UI updates to reduce re-renders
                // Only update UI every 16ms (60fps) for smooth streaming experience
                let lastUpdateTime = Date.now();
                let pendingUpdate = false;
                const UPDATE_INTERVAL_MS = 16; // ~60fps for smoother perceived performance

                const performUIUpdate = () => {
                    pendingUpdate = false;
                    setSessions(prev => prev.map(session => {
                        if (session.id === currentSessionId) {
                            const messages = [...session.messages];
                            const lastMessage = messages[messages.length - 1];

                            if (lastMessage && lastMessage.role === 'assistant') {
                                lastMessage.content = streamHandler.state.accumulatedContent;
                                lastMessage.reasoning = streamHandler.state.accumulatedReasoning;
                                lastMessage.isStreaming = true;
                            }

                            return {
                                ...session,
                                messages,
                                updatedAt: new Date()
                            };
                        }
                        return session;
                    }));
                };

                for await (const chunk of streamChatResponse(
                    url,
                    apiKey,
                    requestBody
                )) {
                    devLog('📥 Received chunk:', {
                        hasContent: !!chunk.content,
                        contentLength: chunk.content?.length || 0,
                        hasReasoning: !!chunk.reasoning,
                        reasoningLength: chunk.reasoning?.length || 0,
                        isDone: chunk.done,
                        status: chunk.status
                    });
                    if (chunk.status === 'rate_limit_retry') {
                        const waitSeconds = Math.max(1, Math.ceil((chunk.retryAfterMs ?? 0) / 1000));
                        setRateLimitCountdown(waitSeconds);
                        devLog(`Rate limit reached. Retrying in ${waitSeconds} seconds...`);
                        continue;
                    }

                    // Process content with thinking tag extraction
                    if (chunk.content) {
                        const content = String(chunk.content);

                        // Debug: Log content to see what we're receiving
                        if (content.includes('<thinking') || content.includes('</thinking') || content.includes('[THINKING') || content.includes('<think') || content.includes('</think')) {
                            devLog('[THINKING DEBUG]', { content, inThinking: streamHandler.state.inThinking, length: content.length });
                        }

                        // Use handler to process content with thinking tags
                        streamHandler.processContentWithThinking(content);
                        streamHandler.incrementChunkCount();
                    }

                    // Also accumulate any reasoning sent explicitly from the API
                    if (chunk.reasoning) {
                        devLog('[REASONING] Received explicit reasoning chunk:', chunk.reasoning.length, 'chars');
                        streamHandler.addReasoning(String(chunk.reasoning));
                    }

                    // OPTIMIZATION: Batch UI updates - only update every 50ms
                    const now = Date.now();
                    const timeSinceLastUpdate = now - lastUpdateTime;

                    if (chunk.done) {
                        // Always update immediately when done
                        performUIUpdate();
                        // Final update to mark as not streaming
                        setSessions(prev => prev.map(session => {
                            if (session.id === currentSessionId) {
                                const messages = [...session.messages];
                                const lastMessage = messages[messages.length - 1];

                                if (lastMessage && lastMessage.role === 'assistant') {
                                    lastMessage.isStreaming = false;
                                }

                                return {
                                    ...session,
                                    messages,
                                    updatedAt: new Date()
                                };
                            }
                            return session;
                        }));
                    } else if (timeSinceLastUpdate >= UPDATE_INTERVAL_MS) {
                        // Update if enough time has passed
                        performUIUpdate();
                        lastUpdateTime = now;
                    } else if (!pendingUpdate) {
                        // Schedule an update for later
                        pendingUpdate = true;
                        const timeoutId = setTimeout(() => {
                            if (pendingUpdate) {
                                performUIUpdate();
                                lastUpdateTime = Date.now();
                            }
                        }, UPDATE_INTERVAL_MS - timeSinceLastUpdate);
                        // Register timeout so it can be cleaned up if error occurs
                        streamHandler.registerTimeout(timeoutId);
                    }
                }

                // Mark streaming as complete and get final content
                streamHandler.complete();
                setIsStreamingResponse(false);
                setLoading(false);
                clearTimeout(loadingTimeout); // Clear the safety timeout

                const finalContent = streamHandler.getFinalContent();
                const finalReasoning = streamHandler.getFinalReasoning();
                devLog({finalContent, finalReasoning, chunkCount: streamHandler.state.chunkCount});

                // OPTIMIZATION: Save the assistant's response to the backend asynchronously
                // This allows the UI to be responsive immediately after streaming completes
                if (currentSession?.apiSessionId && finalContent && userData) {
                    // Fire and forget - save in background
                    const saveAssistantMessage = async () => {
                        try {
                            devLog('🔄 Attempting to save assistant message to backend:', {
                                sessionId: currentSession.apiSessionId,
                                content: finalContent.substring(0, 100) + '...',
                                model: modelValue,
                                apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'NO_API_KEY',
                                privyUserId: userData.privy_user_id
                            });

                            const chatAPI = new ChatHistoryAPI(apiKey, undefined, userData.privy_user_id);
                            if (currentSession.apiSessionId) {
                                const result = await chatAPI.saveMessage(
                                    currentSession.apiSessionId,
                                    'assistant',
                                    finalContent,
                                    modelValue,
                                    undefined // Token count not available from streaming
                                );
                                devLog('✅ Assistant message saved to backend successfully:', result);
                            }

                            // Log analytics event for successful message completion
                            logAnalyticsEvent('chat_message_completed', {
                                model: modelValue,
                                gateway: selectedModel.sourceGateway,
                                response_length: finalContent.length,
                                has_reasoning: !!finalReasoning,
                                reasoning_length: finalReasoning?.length || 0,
                                session_id: currentSessionId
                            });
                        } catch (error) {
                            devError('❌ Failed to save assistant message to backend:', error);
                            devError('Error details:', {
                                message: error instanceof Error ? error.message : String(error),
                                stack: error instanceof Error ? error.stack : undefined,
                                sessionId: currentSession.apiSessionId,
                                hasApiKey: !!apiKey,
                                hasPrivyUserId: !!userData?.privy_user_id
                            });
                        }
                    };
                    // Start saving in background - don't await
                    saveAssistantMessage();
                } else {
                    devWarn('⚠️ Cannot save assistant message:', {
                        hasSessionId: !!currentSession?.apiSessionId,
                        hasContent: !!finalContent,
                        currentSession,
                        finalContentLength: finalContent?.length || 0
                    });
                }

                // Update session title in API if this is the first message
                // Note: Messages are automatically saved by the backend when session_id is passed
                // The title was already updated locally in updatedSessions (line 1326)
                if (isFirstMessage && currentSession?.apiSessionId && newTitle && userData) {
                    try {
                        if (apiKey) {
                            const chatAPI = new ChatHistoryAPI(apiKey, undefined, userData?.privy_user_id);
                            console.log('Updating session title in API:', { oldTitle: 'Untitled Chat', newTitle, sessionId: currentSession.apiSessionId });
                            await chatAPI.updateSession(currentSession.apiSessionId, newTitle);
                        }
                    } catch (error) {
                        console.error('Failed to update session title in API:', error);
                    }

                    // Mark chat task as complete in onboarding
                    try {
                        if (typeof window !== 'undefined') {
                        const savedTasks = localStorage.getItem('gatewayz_onboarding_tasks');
                        if (savedTasks) {
                            const taskState = JSON.parse(savedTasks);
                            if (!taskState.chat) {
                                taskState.chat = true;
                                localStorage.setItem('gatewayz_onboarding_tasks', JSON.stringify(taskState));
                                console.log('Onboarding - Chat task marked as complete');
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Failed to update onboarding task:', error);
                    }
                }

            } catch (streamError) {
                // Clean up any pending timeouts to prevent ReferenceErrors
                if (streamHandler) {
                    streamHandler.cleanup();
                    streamHandler.complete(); // Complete stops streaming
                }

                setIsStreamingResponse(false);
                setLoading(false);
                clearTimeout(loadingTimeout); // Clear the safety timeout
                if (streamHandler) {
                    streamHandler.addError(streamError instanceof Error ? streamError : new Error(String(streamError)));
                }

                console.error('❌ Streaming error occurred:', streamError);
                console.error('Full error object:', {
                    name: streamError instanceof Error ? streamError.name : 'unknown',
                    message: streamError instanceof Error ? streamError.message : String(streamError),
                    stack: streamError instanceof Error ? streamError.stack : undefined,
                    type: typeof streamError,
                    keys: Object.keys(streamError instanceof Error ? streamError : {}),
                    partialContent: streamHandler.getFinalContent(), // ✅ Always accessible via streamHandler
                    chunkCount: streamHandler.state.chunkCount
                });

                const errorMessage = streamError instanceof Error ? streamError.message : 'Failed to get response';
                console.error('Error message for analysis:', errorMessage);
                console.error('Stream state at error:', streamHandler.getErrorSummary());

                // Log error context with accumulated content (already added above, this is redundant but kept for context)
                if (streamHandler) {
                    const errorSummary = streamHandler.getErrorSummary();
                    console.error('Error summary:', errorSummary);
                    console.error('Stream handler error summary:', streamHandler.getErrorSummary());
                }

                // Log analytics event for streaming error
                logAnalyticsEvent('chat_message_failed', {
                    model: selectedModel?.value || 'unknown',
                    gateway: selectedModel?.sourceGateway || 'unknown',
                    error_type: 'streaming_error',
                    error_message: errorMessage,
                    session_id: currentSessionId,
                    has_image: !!selectedImage
                });

                // Check if this is a 500 error or 404 error (model unavailable) and attempt fallback
                // IMPORTANT: Don't treat timeout or rate limit errors as fallback candidates
                const isTimeoutError = errorMessage.includes('timed out') || errorMessage.includes('timeout') || errorMessage.includes('Request timed out');
                const isRateLimitError = errorMessage.includes('Rate limit') || errorMessage.includes('429') || errorMessage.includes('Too Many Requests');
                const is500Error = !isTimeoutError && !isRateLimitError && (errorMessage.includes('500') || errorMessage.includes('Internal server error') || errorMessage.includes('Server error'));
                const is404Error = !isTimeoutError && !isRateLimitError && (errorMessage.includes('404') || errorMessage.includes('not found'));
                const canFallback = (is500Error || is404Error) && !isTimeoutError && !isRateLimitError;

                console.log('Error analysis:', {
                    isTimeoutError,
                    isRateLimitError,
                    is500Error,
                    is404Error,
                    canFallback,
                    selectedModelValue: selectedModel.value
                });

                // Prevent infinite fallback loops - only allow one fallback attempt per message send
                let shouldAttemptFallback = false;
                if (canFallback && selectedModel) {
                    const currentMessageId = `${currentSessionId}-${userMessage.substring(0, 20)}`;
                    
                    // Check if we've already attempted fallback for this message
                    if (fallbackAttemptRef.current?.messageId === currentMessageId && fallbackAttemptRef.current.attempts >= 1) {
                        console.log('Fallback already attempted for this message, skipping to prevent infinite loop');
                    } else {
                        // Track fallback attempt
                        fallbackAttemptRef.current = {
                            messageId: currentMessageId,
                            attempts: (fallbackAttemptRef.current?.messageId === currentMessageId ? fallbackAttemptRef.current.attempts : 0) + 1
                        };
                        shouldAttemptFallback = true;
                    }
                }

                if (shouldAttemptFallback && selectedModel) {
                    // Define fallback models in order of preference (using truly free models):
                    // 1. DeepSeek V3.1 Free (default)
                    // 2. Mistral Small Free
                    // 3. Google Gemma 3n Free
                    // 4. NVIDIA Nemotron Free
                    // 5. Qwen3 Coder Free
                    const fallbackModels: ModelOption[] = [
                        { value: 'deepseek/deepseek-chat-v3.1:free', label: 'DeepSeek V3.1 (Free)', category: 'Free' },
                        { value: 'mistralai/mistral-small-3.2-24b-instruct:free', label: 'Mistral Small (Free)', category: 'Free' },
                        { value: 'google/gemma-3n-e2b-it:free', label: 'Google Gemma 3n (Free)', category: 'Free' },
                        { value: 'nvidia/nemotron-nano-9b-v2:free', label: 'NVIDIA Nemotron (Free)', category: 'Free' },
                        { value: 'qwen/qwen3-coder:free', label: 'Qwen3 Coder (Free)', category: 'Free' }
                    ];

                    // Find the first fallback model that isn't the current model
                    const fallbackModel = fallbackModels.find(fm => fm.value !== selectedModel.value);

                    if (fallbackModel) {
                        console.log(`Model ${selectedModel.value} failed with error, attempting fallback to ${fallbackModel.value}`);

                        // Show a toast notification about the fallback
                        toast({
                            title: "Model Unavailable",
                            description: `${selectedModel.label} is temporarily unavailable. Switched to ${fallbackModel.label}.`,
                            variant: 'default'
                        });

                        // Update the selected model
                        setSelectedModel(fallbackModel);

                        // Remove the streaming message
                        setSessions(prev => prev.map(session => {
                            if (session.id === currentSessionId) {
                                return {
                                    ...session,
                                    messages: updatedMessages,
                                    updatedAt: new Date()
                                };
                            }
                            return session;
                        }));

                        // Retry the request with the fallback model by recursively calling handleSendMessage
                        // Wait a short moment before retrying
                        setTimeout(() => {
                            // Re-populate the message field with the original user message
                            setMessage(userMessage);
                            setUserHasTyped(true);
                            userHasTypedRef.current = true;
                            // Trigger send
                            handleSendMessage();
                        }, 500);

                        return; // Exit early to prevent showing error message
                    }
                }

                // Remove streaming message and show error
                setSessions(prev => prev.map(session => {
                    if (session.id === currentSessionId) {
                        return {
                            ...session,
                            messages: [...updatedMessages, {
                                role: 'assistant' as const,
                                content: 'Sorry, there was an error processing your request. Please try again.',
                                model: selectedModel.value
                            }],
                            updatedAt: new Date()
                        };
                    }
                    return session;
                }));

                // Determine error type and provide helpful message
                let toastTitle = "Error";
                let toastDescription = errorMessage;

                // Check rate limit FIRST - it may contain "API key" in the message
                // Handle rate limit errors (429)
                if (errorMessage.includes('Rate limit') || errorMessage.includes('429') || errorMessage.includes('Burst limit')) {
                    toastTitle = "Rate Limit Reached";
                    toastDescription = "You've exceeded the limit of 100 requests per minute (burst of 20). Please wait a moment before trying again.";
                    setRateLimitCountdown(60); // Start 60 second countdown
                }
                // Handle API key validation errors (401/403) - but NOT if it's a rate limit error
                else if (
                    (errorMessage.includes('Unauthorized') || 
                     errorMessage.includes('401') ||
                     errorMessage.includes('Invalid') ||
                     (errorMessage.includes('API key') && !errorMessage.includes('rate limit'))) ||
                    errorMessage.includes('403')
                ) {
                    toastTitle = "Session Expired";
                    toastDescription = "Your session has expired. Please refresh the page and log in again.";
                }

                toast({
                    title: toastTitle,
                    description: toastDescription,
                    variant: 'destructive'
                });
            }
        } catch (error) {
            setIsStreamingResponse(false);
            setLoading(false);
            clearTimeout(loadingTimeout); // Clear the safety timeout
            console.error('Send message error:', error);

            // Log analytics event for general error
            logAnalyticsEvent('chat_message_failed', {
                model: selectedModel?.value || 'unknown',
                gateway: selectedModel?.sourceGateway || 'unknown',
                error_type: 'general_error',
                error_message: error instanceof Error ? error.message : 'Unknown error',
                session_id: currentSessionId || 'none',
                has_image: !!selectedImage
            });

            toast({
                title: "Error",
                description: `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
                variant: 'destructive'
            });

            // Revert message update on error
            setSessions(prev => prev.map(session => {
                if (session.id === currentSessionId) {
                    return { ...session, messages };
                }
                return session;
            }));
        }
    };

    // Update the ref whenever handleSendMessage changes (for use in effects that can't list it as dependency)
    useEffect(() => {
        handleSendMessageRef.current = handleSendMessage;
    }, [handleSendMessage]);

  // Show login screen if not authenticated
  if (authLoading) {
    return (
      <div className="flex h-[calc(100dvh-130px)] bg-background items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }

  // Check if user is authenticated via Privy OR has a valid API key in localStorage
  if (!isAuthenticated && !hasApiKey) {
    return (
      <div className="flex h-[calc(100dvh-130px)] bg-background items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-md text-center p-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Welcome to Gatewayz Chat</h2>
            <p className="text-muted-foreground">Please log in to start chatting with AI models</p>
          </div>
          <Button
            onClick={() => login()}
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Log In to Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <FreeModelsBanner />
      <div data-chat-container className="flex h-[calc(100vh-130px)] has-onboarding-banner:h-[calc(100vh-192px)] bg-background overflow-hidden">
        {/* Left Sidebar - Desktop Only */}
        <div className="hidden lg:flex w-56 xl:w-72 border-r flex-shrink-0 overflow-hidden">
          <ChatSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            switchToSession={switchToSession}
            createNewChat={createNewChat}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
          />
        </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden min-w-0">
        {/* Background Logo - Hidden on mobile for better performance */}
      <img
        src="/logo_transparent.svg"
          alt="Background"
        className="absolute top-8 left-1/2 transform -translate-x-1/2 w-[75vh] h-[75vh] pointer-events-none opacity-50 hidden lg:block dark:hidden"
      />
      <img
        src="/logo_black.svg"
          alt="Background"
        className="absolute top-8 left-1/2 transform -translate-x-1/2 w-[75vh] h-[75vh] pointer-events-none opacity-50 hidden dark:lg:block"
      />

        {/* Mobile Header - Compact and Touch-Friendly */}
        <header className="sticky top-0 z-[50] w-full bg-background/95 border-b border-border/50 lg:relative lg:border-none lg:bg-transparent">
          {/* Mobile Layout - Single Row on Mobile */}
          <div className="flex lg:hidden items-center gap-2 p-3 w-full">
            {/* Menu Button */}
            <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0 pt-12 overflow-hidden">
                <SheetHeader className="sr-only">
                  <SheetTitle>Chat Sidebar</SheetTitle>
                </SheetHeader>
                <ChatSidebar
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  switchToSession={switchToSession}
                  createNewChat={createNewChat}
                  onDeleteSession={handleDeleteSession}
                  onRenameSession={handleRenameSession}
                  onClose={() => setMobileSidebarOpen(false)}
                />
              </SheetContent>
            </Sheet>

            {/* Title - Hidden on very small screens, shown on sm and up */}
            <div className="min-w-0 flex-1">
              {isEditingTitle ? (
                <Input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={() => {
                    if (editedTitle.trim() && editedTitle !== activeSession?.title && activeSessionId) {
                      handleRenameSession(activeSessionId, editedTitle.trim());
                    }
                    setIsEditingTitle(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (editedTitle.trim() && editedTitle !== activeSession?.title && activeSessionId) {
                        handleRenameSession(activeSessionId, editedTitle.trim());
                      }
                      setIsEditingTitle(false);
                    } else if (e.key === 'Escape') {
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                  className="text-sm font-semibold h-auto px-2 py-1 min-w-0"
                />
              ) : (
                <h1 className="text-sm font-semibold truncate">{activeSession?.title || 'Untitled Chat'}</h1>
              )}
            </div>

            {/* Edit Title Button */}
            {!isEditingTitle && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={() => {
                  setEditedTitle(activeSession?.title || '');
                  setIsEditingTitle(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}

            {/* Model Selector */}
            <div className="flex-shrink-0">
              <ModelSelect selectedModel={selectedModel} onSelectModel={handleModelSelect} />
            </div>
          </div>

          {/* Desktop Layout - Side by side */}
          <div className="hidden lg:flex items-center justify-between gap-4 p-6 max-w-7xl mx-auto">
              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                {isEditingTitle ? (
                  <Input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onBlur={() => {
                      if (editedTitle.trim() && editedTitle !== activeSession?.title && activeSessionId) {
                        handleRenameSession(activeSessionId, editedTitle.trim());
                      }
                      setIsEditingTitle(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (editedTitle.trim() && editedTitle !== activeSession?.title && activeSessionId) {
                          handleRenameSession(activeSessionId, editedTitle.trim());
                        }
                        setIsEditingTitle(false);
                      } else if (e.key === 'Escape') {
                        setIsEditingTitle(false);
                      }
                    }}
                    autoFocus
                  className="text-2xl font-semibold h-auto px-2 py-1 min-w-0 flex-1"
                  />
                ) : (
                <>
                  <h1 className="text-2xl font-semibold truncate min-w-0 flex-1 max-w-full">{activeSession?.title || 'Untitled Chat'}</h1>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={() => {
                      setEditedTitle(activeSession?.title || '');
                      setIsEditingTitle(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </>
                )}
              </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ModelSelect selectedModel={selectedModel} onSelectModel={handleModelSelect} />
            </div>
          </div>
        </header>

        {/* Main content area */}
        <div className="relative z-10 w-full flex-1 flex flex-col overflow-hidden">
          {/* Chat messages area */}
          {loadingMessages && messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Loading messages...</p>
              </div>
            </div>
          )}
          {messages.length > 0 && (
            <VirtualizedMessageList
              messages={messages}
              loading={loading}
              chatContainerRef={chatContainerRef}
              handleRegenerate={handleRegenerate}
            />
          )}

          {/* Welcome screen when no messages */}
          {messages.length === 0 && !loading && (
            <div className="flex-1 flex flex-col items-center justify-start text-center p-3 sm:p-4 lg:p-6 w-full overflow-y-auto">
              <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0">
                <h1 className="text-xl sm:text-2xl lg:text-4xl font-bold mb-4 sm:mb-6 lg:mb-8 px-4">What's On Your Mind?</h1>

                {/* Suggested prompts - Optimized for mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8 w-full max-w-4xl px-4">
                  <ExamplePrompt
                    title="What model is better for coding?"
                    subtitle="Compare different AI models for programming tasks"
                    onClick={() => handleExamplePromptClick("What model is better for coding?")}
                  />
                  <ExamplePrompt
                    title="How long would it take to walk to the moon?"
                    subtitle="Calculate travel time and distance to the moon"
                    onClick={() => handleExamplePromptClick("How long would it take to walk to the moon?")}
                  />
                  <ExamplePrompt
                    title="When did England last win the world cup?"
                    subtitle="Get the latest football world cup information"
                    onClick={() => handleExamplePromptClick("When did England last win the world cup?")}
                  />
                  <ExamplePrompt
                    title="Which athlete has won the most gold medals?"
                    subtitle="Find Olympic and sports statistics"
                    onClick={() => handleExamplePromptClick("Which athlete has won the most gold medals?")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Message input area - Mobile optimized */}
          <div className="w-full p-3 sm:p-4 lg:p-6 max-w-4xl mx-auto flex-shrink-0 bg-background/95 border-t border-border/50 lg:border-none lg:bg-transparent">
            <div className="w-full">
              <div className="relative">
                {/* Image preview - Mobile responsive */}
                {selectedImage && (
                  <div className="mb-2 relative inline-block">
                    <img
                      src={selectedImage}
                      alt="Selected image"
                      className="max-w-[150px] sm:max-w-[200px] lg:max-w-xs max-h-20 sm:max-h-24 lg:max-h-32 rounded-lg border"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full touch-manipulation"
                      onClick={handleRemoveImage}
                      title="Remove image"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {/* Video preview */}
                {selectedVideo && (
                  <div className="mb-3 relative inline-block">
                    <div className="relative group">
                      <video
                        src={selectedVideo}
                        className="max-w-[280px] lg:max-w-md max-h-32 lg:max-h-48 rounded-lg border-2 border-border shadow-md object-contain"
                      />
                      <div className="absolute inset-0 bg-black/5 dark:bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-7 w-7 rounded-full shadow-lg"
                      onClick={handleRemoveVideo}
                      title="Remove video"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {/* Audio preview */}
                {selectedAudio && (
                  <div className="mb-3">
                    <div className="relative inline-block">
                      <audio
                        src={selectedAudio}
                        controls
                        className="rounded-lg border-2 border-border shadow-md"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-7 w-7 rounded-full shadow-lg"
                        onClick={handleRemoveAudio}
                        title="Remove audio"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                {rateLimitCountdown > 0 && (
                  <div className="mb-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-center">
                    <p className="text-xs sm:text-sm text-yellow-600 dark:text-yellow-400">
                      Rate limit reached. Retrying in <span className="font-bold">{rateLimitCountdown}</span> second{rateLimitCountdown !== 1 ? 's' : ''}...
                    </p>
                  </div>
                )}
                {/* Input container - Touch-friendly */}
                <div className="flex items-center gap-1 px-2 py-2 bg-muted/20 dark:bg-muted/40 rounded-lg border border-border">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoSelect}
                    className="hidden"
                  />
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioSelect}
                    className="hidden"
                  />
                  {/* Only show image button for models that support image input */}
                  {selectedModel?.modalities?.includes('Image') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg touch-manipulation"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={authLoading || (!isAuthenticated && !hasApiKey)}
                      title="Upload an image"
                    >
                      <ImageIcon className="h-5 w-5" />
                    </Button>
                  )}
                  {/* Only show video button for models that support video input */}
                  {selectedModel?.modalities?.includes('Video') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => videoInputRef.current?.click()}
                      disabled={authLoading || (!isAuthenticated && !hasApiKey)}
                      title="Upload a video"
                    >
                      <VideoIcon className="h-5 w-5" />
                    </Button>
                  )}
                  {/* Only show audio button for models that support audio input */}
                  {selectedModel?.modalities?.includes('Audio') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => audioInputRef.current?.click()}
                      disabled={authLoading || (!isAuthenticated && !hasApiKey)}
                      title="Upload audio"
                    >
                      <AudioIcon className="h-5 w-5" />
                    </Button>
                  )}
                  <Input
                    ref={messageInputRef}
                    placeholder={authLoading ? "Authenticating..." : (!isAuthenticated && !hasApiKey) ? "Please log in..." : getPlaceholderText()}
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      // Only mark as typed if there's actual content
                      if (e.target.value.trim()) {
                        setUserHasTyped(true);
                        userHasTypedRef.current = true;
                        // Reset auto-send flag when user manually types
                        autoSendTriggeredRef.current = false;
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        // Only send if user has actually typed something
                        if (userHasTyped && message.trim() && !isStreamingResponse) {
                          handleSendMessage();
                        }
                      }
                    }}
                    onInput={() => {
                      // Mark as typed on any input event (actual typing)
                      setUserHasTyped(true);
                      userHasTypedRef.current = true;
                    }}
                    disabled={authLoading || (!isAuthenticated && !hasApiKey)}
                    autoComplete="off"
                    className="border-0 bg-transparent focus-visible:ring-0 text-sm sm:text-base text-foreground flex-1 min-w-0"
                  />
                  <div className="flex items-center gap-1">
                    {(authLoading || (!isAuthenticated && !hasApiKey) || isStreamingResponse) && (
                      <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleSendMessage()}
                      disabled={loading || isStreamingResponse || !message.trim() || (!isAuthenticated && !hasApiKey)}
                      className="h-8 w-8 sm:h-7 sm:w-7 bg-primary hover:bg-primary/90 text-primary-foreground touch-manipulation flex-shrink-0"
                      title={authLoading
                        ? "Waiting for authentication..."
                        : (!isAuthenticated && !hasApiKey)
                          ? "Please log in"
                          : isStreamingResponse
                            ? "Please wait for the current response to finish"
                            : "Send message"}
                    >
                       <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
    </>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex h-[calc(100dvh-130px)] items-center justify-center">Loading...</div>}>
      <ChatPageContent />
    </Suspense>
  );
}
