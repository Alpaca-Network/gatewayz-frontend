
"use client"

import React, { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
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
  X,
  Sparkles
} from 'lucide-react';
import { ModelSelect, type ModelOption } from '@/components/chat/model-select';
import './chat.css';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { getApiKey, getUserData } from '@/lib/api';
import { ChatHistoryAPI, ChatSession as ApiChatSession, ChatMessage as ApiChatMessage, handleApiError } from '@/lib/chat-history';
import { Copy, Share2, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { usePrivy } from '@privy-io/react-auth';
import { streamChatResponse } from '@/lib/streaming';
import { ReasoningDisplay } from '@/components/chat/reasoning-display';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type Message = {
    role: 'user' | 'assistant';
    content: string;
    reasoning?: string;
    image?: string; // Base64 image data
    isStreaming?: boolean; // Track if message is currently streaming
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
    // Load chat sessions from API (without messages for faster initial load)
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
            console.log('Chat sessions - Making API request to getSessions');
            const apiSessions = await chatAPI.getSessions(50, 0);

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
                image: undefined
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

    // Create new chat session in API
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
            console.log('Create session - Making API request to createSession');
            const apiSession = await chatAPI.createSession(title, model);
            
            // Use helper function to safely parse dates
            const createdAt = parseBackendDate(apiSession.created_at, 'created_at', apiSession.id);
            const updatedAt = parseBackendDate(apiSession.updated_at, 'updated_at', apiSession.id);
            
            return {
                id: `api-${apiSession.id}`,
                title: apiSession.title,
                startTime: createdAt, // Use created_at as startTime for consistency
                createdAt: createdAt,
                updatedAt: updatedAt,
                userId: 'user-1',
                apiSessionId: apiSession.id,
                messages: []
            };
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

const ModelSuggestionCard = ({ title, icon: Icon }: { title: string, icon: React.ElementType }) => (
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

const ExamplePrompt = ({ title, subtitle, onClick }: { title: string, subtitle: string, onClick?: () => void }) => (
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
                className={`flex items-start justify-between gap-2 w-full px-2 py-1.5 rounded-lg transition-colors ${
                    activeSessionId === session.id 
                        ? 'bg-secondary' 
                        : 'hover:bg-accent'
                }`}
                onContextMenu={(e) => {
                    e.preventDefault();
                    setMenuOpen(true);
                }}
                >
                   <button
                        className="flex-1 min-w-0 justify-start items-start text-left flex flex-col h-auto"
                        onClick={() => switchToSession(session.id)}
                    >
                        <span className="font-medium text-sm leading-tight block truncate w-full">
                            {session.title}
                        </span>
                        <span className="text-xs text-muted-foreground truncate leading-tight mt-0.5 block w-full">
                            {formatDistanceToNow(session.startTime, { addSuffix: true })}
                        </span>
                    </button>

                    {/* Three dots menu stays visible and aligned */}
                    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-muted rounded-md shrink-0 self-start opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpen(true);
                                }}
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={handleRenameClick}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={handleDeleteClick}
                                className="text-destructive focus:text-destructive"
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

const ChatSidebar = ({ sessions, activeSessionId, switchToSession, createNewChat, onDeleteSession, onRenameSession }: {
    sessions: ChatSession[],
    activeSessionId: string | null,
    switchToSession: (id: string) => void,
    createNewChat: () => void,
    onDeleteSession: (sessionId: string) => void,
    onRenameSession: (sessionId: string, newTitle: string) => void
}) => {

    const groupChatsByDate = (chatSessions: ChatSession[]) => {
        // Filter out untitled chats that haven't been started yet
        const startedChats = chatSessions.filter(session =>
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
    };

    const groupedSessions = groupChatsByDate(sessions);

    return (
    <aside className="flex flex-col gap-4 p-4 h-full w-full overflow-hidden">
        <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">Chat</h2>
        </div>

        <Button
            onClick={createNewChat}
            className="w-full bg-foreground text-background hover:bg-foreground/90 h-10 font-medium flex justify-between items-center gap-2 text-left text-sm"
        >
            <span>New Chat</span>
            <img src="/uil_plus.svg" alt="Plus" width={20} height={20} />
        </Button>

        <div className="relative">
            <Input placeholder="Search Chats" className="pl-3 rounded-lg h-9 text-sm" />
            <img src="/material-symbols_search.svg" alt="Search" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" style={{ width: "20px", height: "20px" }} />

        </div>

        <div className="flex-grow overflow-y-auto pb-4">
            {Object.keys(groupedSessions).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                    <p className="text-sm text-muted-foreground">No conversations yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Start a new chat to begin</p>
                </div>
            ) : (
                Object.entries(groupedSessions).map(([groupName, chatSessions]) => (
                    <div key={groupName} className="min-w-0">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase my-1.5 px-2">{groupName}</h3>
                        <ul className="space-y-0.5 min-w-0">
                            {chatSessions.map(session => (
                                <SessionListItem
                                    key={session.id}
                                    session={session}
                                    activeSessionId={activeSessionId}
                                    switchToSession={switchToSession}
                                    onRenameSession={onRenameSession}
                                    onDeleteSession={onDeleteSession}
                                />
                            ))}
                        </ul>
                    </div>
                ))
            )}
        </div>
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

// Exciting loading component for when AI is thinking
const ThinkingLoader = ({ modelName }: { modelName: string | undefined }) => {
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

const ChatMessage = ({ message, modelName }: { message: Message, modelName: string | undefined}) => {
    const isUser = message.role === 'user';
    const processedContent = fixLatexSyntax(message.content);

    // Show exciting loader when AI is thinking (streaming but no content yet)
    if (!isUser && message.isStreaming && !message.content) {
        return <ThinkingLoader modelName={modelName} />;
    }

    return (
        <div className={`flex items-start gap-3 ${isUser ? 'justify-end' : ''}`}>
             {/* {!isUser && <Avatar className="w-8 h-8"><AvatarFallback><Bot/></AvatarFallback></Avatar>} */}
            <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'} max-w-[85%]`}>
                {!isUser && message.reasoning && (
                    <ReasoningDisplay reasoning={message.reasoning} className="w-full" />
                )}
                <div className={`rounded-lg p-3 ${isUser ? 'bg-blue-600 text-white' : 'bg-muted/30 dark:bg-muted/20 border border-border'} ${message.isStreaming ? 'streaming-message' : ''}`}>
                     {!isUser && <p className="text-xs font-semibold mb-1">{modelName}</p>}
                    <div className={`text-sm prose prose-sm max-w-none ${isUser ? 'text-white prose-invert' : 'dark:prose-invert'}`}>
                        {isUser ? (
                            <div className="whitespace-pre-wrap text-white">{processedContent}</div>
                        ) : (
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{
                                    code: ({ node, inline, className, children, ...props }: any) => {
                                        const match = /language-(\w+)/.exec(className || '');
                                        return !inline ? (
                                            <pre className="bg-muted p-3 rounded-md overflow-x-auto">
                                                <code className={className} {...props}>
                                                    {children}
                                                </code>
                                            </pre>
                                        ) : (
                                            <code className="bg-muted px-1.5 py-0.5 rounded text-sm" {...props}>
                                                {children}
                                            </code>
                                        );
                                    },
                                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                    ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                                    li: ({ children }) => <li className="mb-1">{children}</li>,
                                }}
                            >
                                {processedContent}
                            </ReactMarkdown>
                        )}
                    </div>
                    {!isUser && (
                        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border">
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Box className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                                </svg>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                </svg>
                            </Button>
                        </div>
                    )}
                </div>
            </div>
             {/* {isUser && <Avatar className="w-8 h-8"><AvatarFallback><User/></AvatarFallback></Avatar>} */}
        </div>
    )
}

const ChatSkeleton = () => (
  <div className="flex items-start gap-3">
    <Avatar className="w-8 h-8"><AvatarFallback><Bot/></AvatarFallback></Avatar>
    <div className="flex flex-col gap-2 w-full max-w-md">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
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

function ChatPageContent() {
    const searchParams = useSearchParams();
    const { login, authenticated, ready } = usePrivy();
    const [message, setMessage] = useState('');
    const [userHasTyped, setUserHasTyped] = useState(false);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isStreamingResponse, setIsStreamingResponse] = useState(false);
    const [rateLimitCountdown, setRateLimitCountdown] = useState<number>(0);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState('');
    const [selectedModel, setSelectedModel] = useState<ModelOption | null>({
        value: 'openrouter/auto',
        label: 'Auto Router',
        category: 'Free'
    });
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const { toast } = useToast();
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const messageInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Track which sessions have loaded their messages
    const [loadedSessionIds, setLoadedSessionIds] = useState<Set<string>>(new Set());
    const [loadingMessages, setLoadingMessages] = useState(false);

    // Track if we should auto-send the message from URL
    const [shouldAutoSend, setShouldAutoSend] = useState(false);

    // Track if we're currently creating a session to prevent race conditions
    const creatingSessionRef = useRef(false);

    // Trigger for forcing session reload after API key becomes available
    const [authReady, setAuthReady] = useState(false);

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

    // Handle model and message from URL parameters
    useEffect(() => {
        if (!searchParams) return;

        const modelParam = searchParams.get('model');
        const messageParam = searchParams.get('message');

        if (modelParam) {
            console.log('URL model parameter detected:', modelParam);
            // Fetch the model details from all gateways
            Promise.all([
                fetch(`/api/models?gateway=openrouter`).then(res => res.json()),
                fetch(`/api/models?gateway=portkey`).then(res => res.json()),
                fetch(`/api/models?gateway=featherless`).then(res => res.json())
            ])
                .then(([openrouterData, portkeyData, featherlessData]) => {
                    const allModels = [
                        ...(openrouterData.data || []),
                        ...(portkeyData.data || []),
                        ...(featherlessData.data || [])
                    ];
                    const foundModel = allModels.find((m: any) => m.id === modelParam);
                    if (foundModel) {
                        console.log('Found model from URL:', foundModel.name, foundModel.id);
                        setSelectedModel({
                            value: foundModel.id,
                            label: foundModel.name,
                            category: foundModel.pricing?.prompt ? 'Paid' : 'Free'
                        });
                    } else {
                        console.warn('Model not found in API:', modelParam);
                    }
                })
                .catch(err => console.log('Failed to fetch model:', err));
        }

        // Set the message from URL parameter and flag for auto-send
        if (messageParam) {
            setMessage(decodeURIComponent(messageParam));
            setUserHasTyped(true); // Allow auto-send from URL
            setShouldAutoSend(true);
        }
    }, [searchParams]);

     const activeSession = useMemo(() => {
        return sessions.find(s => s.id === activeSessionId) || null;
    }, [sessions, activeSessionId]);

    const messages = activeSession?.messages || [];

    // Auto-send message from URL parameter when session is ready
    useEffect(() => {
        if (
            shouldAutoSend &&
            activeSessionId &&
            message.trim() &&
            selectedModel &&
            !loading &&
            !creatingSessionRef.current &&
            !isStreamingResponse
        ) {
            setShouldAutoSend(false); // Reset flag to prevent re-sending
            handleSendMessage();
        }
    }, [shouldAutoSend, activeSessionId, message, selectedModel, loading, isStreamingResponse]);

    // Check for referral bonus notification flag
    useEffect(() => {
        if (!ready || !authenticated) return;

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
    }, [ready, authenticated, toast]);

    useEffect(() => {
        // Load sessions from API when authenticated and API key is available
        if (!ready) {
            console.log('Session loading - Privy not ready yet');
            return;
        }

        if (!authenticated) {
            console.log('Session loading - User not authenticated');
            return;
        }

        // Wait for API key to be saved to localStorage after authentication
        const apiKey = getApiKey();
        const userData = getUserData();
        if (!apiKey || !userData?.privy_user_id) {
            console.log('Session loading - Waiting for API key and user data...');
            // Retry with increasing intervals until we have the API key
            const checkInterval = setInterval(() => {
                const key = getApiKey();
                const data = getUserData();
                if (key && data?.privy_user_id) {
                    console.log('Session loading - API key and user data now available!');
                    clearInterval(checkInterval);
                    // Trigger auth ready state to force effect to re-run
                    setAuthReady(true);
                }
            }, 100);

            // Clean up after 10 seconds
            setTimeout(() => clearInterval(checkInterval), 10000);
            return () => clearInterval(checkInterval);
        }

        console.log('Session loading - Starting to load sessions...');

        const loadSessions = async () => {
            try {
                const sessionsData = await apiHelpers.loadChatSessions('user-1');
                console.log('Session loading - Loaded sessions:', sessionsData.length);
                console.log('Session loading - Sessions data:', sessionsData);

                setSessions(sessionsData);

                // Check if there's already a new/empty chat, if not create one
                const hasNewChat = sessionsData.some(session =>
                    session.messages.length === 0 &&
                    session.title === 'Untitled Chat'
                );

                console.log('Session loading - Has new chat:', hasNewChat);

                if (!hasNewChat) {
                    console.log('Session loading - Creating new chat');
                    createNewChat();
                } else {
                    // Set the first new chat as active - use local data instead of state
                    const firstNewChat = sessionsData.find(session =>
                        session.messages.length === 0 &&
                        session.title === 'Untitled Chat'
                    );
                    if (firstNewChat) {
                        console.log('Session loading - Setting active session:', firstNewChat.id);
                        // Clear any stale message from the input field for new empty chats
                        setMessage('');
                        setUserHasTyped(false); // Reset typing flag
                        // Directly set active session ID instead of calling switchToSession
                        // since setSessions hasn't completed yet
                        setActiveSessionId(firstNewChat.id);
                    }
                }
            } catch (error) {
                console.error('Session loading - Failed to load chat sessions:', error);
                // Fallback to creating a new chat
                createNewChat();
            }
        };

        loadSessions();
        
        // Test backend connectivity after loading sessions
        setTimeout(() => {
            testBackendConnectivity();
        }, 1000);
        
        // Make test function available globally for manual testing
        (window as any).testChatBackend = testBackendConnectivity;
        
        // Add a test date parsing function
        (window as any).testDateParsing = () => {
            const testDates = [
                '2024-01-01T12:00:00Z',
                '2024-01-01T12:00:00.000Z',
                '2024-01-01T12:00:00+00:00',
                'invalid-date',
                '',
                null,
                undefined
            ];
            
            console.log('🧪 Testing date parsing...');
            testDates.forEach((dateStr, index) => {
                const result = parseBackendDate(dateStr as string, 'test_field', index);
                console.log(`Test ${index}: "${dateStr}" → ${result.toISOString()}`);
            });
        };
        
        // Add a test message saving function
        (window as any).testMessageSaving = async () => {
            const apiKey = getApiKey();
            const userData = getUserData();
            const currentSession = sessions.find(s => s.id === activeSessionId);
            
            if (!apiKey || !userData?.privy_user_id || !currentSession?.apiSessionId) {
                console.error('❌ Cannot test message saving - missing requirements:', {
                    hasApiKey: !!apiKey,
                    hasUserData: !!userData?.privy_user_id,
                    hasSessionId: !!currentSession?.apiSessionId,
                    activeSessionId,
                    sessions: sessions.length
                });
                return false;
            }
            
            try {
                console.log('🧪 Testing message saving...');
                const chatAPI = new ChatHistoryAPI(apiKey, undefined, userData.privy_user_id);
                
                // Try to save a test message
                const result = await chatAPI.saveMessage(
                    currentSession.apiSessionId,
                    'user',
                    'Test message from console',
                    'openai/gpt-3.5-turbo',
                    undefined
                );
                
                console.log('✅ Test message saved successfully:', result);
                return true;
            } catch (error) {
                console.error('❌ Test message saving failed:', error);
                return false;
            }
        };
    }, [ready, authenticated, authReady]);

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

     useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // Lazy load messages when switching to a session
    const switchToSession = async (sessionId: string) => {
        console.log('switchToSession called for:', sessionId);
        const session = sessions.find(s => s.id === sessionId);
        if (!session) {
            console.log('Session not found:', sessionId);
            return;
        }

        console.log('Session found:', session);
        console.log('Session has messages:', session.messages.length);
        console.log('Already loaded:', loadedSessionIds.has(sessionId));

        // Set active session immediately for UI responsiveness
        setActiveSessionId(sessionId);

        // If messages already loaded or session is new (no messages), skip loading
        if (loadedSessionIds.has(sessionId) || session.messages.length > 0) {
            console.log('Skipping message load - already loaded or has messages');
            return;
        }

        // Load messages for this session
        if (session.apiSessionId) {
            console.log('Loading messages for session:', sessionId, 'API ID:', session.apiSessionId);
            setLoadingMessages(true);
            try {
                const messages = await apiHelpers.loadSessionMessages(sessionId, session.apiSessionId);
                console.log('Loaded messages:', messages.length);

                // Update the session with loaded messages
                setSessions(prev => prev.map(s =>
                    s.id === sessionId ? { ...s, messages } : s
                ));

                // Mark session as loaded
                setLoadedSessionIds(prev => new Set(prev).add(sessionId));
            } catch (error) {
                console.error(`Failed to load messages for session ${sessionId}:`, error);
            } finally {
                setLoadingMessages(false);
            }
        } else {
            console.log('No API session ID for session:', sessionId);
        }
    };

    const createNewChat = async () => {
        // Prevent duplicate session creation
        if (creatingSessionRef.current) {
            console.log('Session creation already in progress');
            return;
        }

        // Check if there's already a new/empty chat session
        const existingNewChat = sessions.find(session =>
            session.messages.length === 0 &&
            session.title === 'Untitled Chat'
        );

        if (existingNewChat) {
            // If there's already a new chat, just switch to it
            switchToSession(existingNewChat.id);
            return;
        }

        try {
            creatingSessionRef.current = true;
            // Create new session using API helper
            const newSession = await apiHelpers.createChatSession('Untitled Chat', selectedModel?.value);

            // FIX: Set active session immediately with the created session object
            // Don't rely on setSessions completing before switchToSession is called
            setActiveSessionId(newSession.id);

            // Then update the sessions list
            setSessions(prev => [newSession, ...prev]);

            creatingSessionRef.current = false;
        } catch (error) {
            creatingSessionRef.current = false;
            console.error('Failed to create new chat session:', error);
            toast({
                title: "Error",
                description: `Failed to create new chat session: ${error instanceof Error ? error.message : 'Unknown error'}`,
                variant: 'destructive'
            });
        }
    }

    const handleExamplePromptClick = (promptText: string) => {
        // Set the message input to the clicked prompt
        setMessage(promptText);
        setUserHasTyped(true);
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

    const handleRenameSession = async (sessionId: string, newTitle: string) => {
        try {
            // Update in API
            await apiHelpers.updateChatSession(sessionId, { title: newTitle }, sessions);
            
            setSessions(prev => prev.map(session =>
                session.id === sessionId
                    ? { ...session, title: newTitle, updatedAt: new Date() }
                    : session
            ));
        } catch (error) {
            console.error('Failed to rename chat session:', error);
            toast({
                title: "Error",
                description: "Failed to rename chat session. Please try again.",
                variant: 'destructive'
            });
        }
    }

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast({
                title: "File too large",
                description: "Please select an image smaller than 5MB.",
                variant: 'destructive'
            });
            return;
        }

        // Convert to base64
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setSelectedImage(base64);
        };
        reader.onerror = () => {
            toast({
                title: "Error reading file",
                description: "Failed to read the image file.",
                variant: 'destructive'
            });
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = () => {
        setSelectedImage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
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

    const handleSendMessage = async () => {
        // Prevent sending if user hasn't actually typed anything
        if (!userHasTyped) {
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
        const apiKey = getApiKey();
        const userData = getUserData();

        if (!apiKey || !userData || typeof userData.privy_user_id !== 'string') {
            toast({
                title: "Authentication required",
                description: "Please wait for authentication to complete or log in.",
                variant: 'destructive',
                action: (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => login()}
                    >
                        Log In
                    </Button>
                ),
            });
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

        // Check if session exists - if not, don't auto-create, just show error
        let currentSessionId = activeSessionId;
        if (!currentSessionId) {
            console.log('No active session - user needs to wait for session creation to complete');
            toast({
                title: "Please wait",
                description: "Your chat session is being created...",
                variant: 'default'
            });
            return;
        }

        const isFirstMessage = messages.length === 0;
        const userMessage = message;
        const userImage = selectedImage;

        const updatedMessages: Message[] = [...messages, {
            role: 'user' as const,
            content: userMessage,
            image: userImage || undefined
        }];

        // Generate title if this is the first message
        let newTitle = isFirstMessage ? generateChatTitle(userMessage) : undefined;

        const updatedSessions = sessions.map(session => {
            if (session.id === currentSessionId) {
                return {
                    ...session,
                    title: isFirstMessage && newTitle ? newTitle : session.title,
                    messages: updatedMessages,
                    updatedAt: new Date()
                };
            }
            return session;
        });
        setSessions(updatedSessions);

        setMessage('');
        setSelectedImage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setLoading(true);

        try {
            console.log('🚀 Starting handleSendMessage - Core auth check:', {
                hasApiKey: !!apiKey,
                hasUserData: !!userData,
                hasPrivyUserId: !!userData?.privy_user_id,
                userDataKeys: userData ? Object.keys(userData) : []
            });

            // Auth is already checked at the beginning of handleSendMessage
            const privyUserId = userData.privy_user_id;

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

            // Save the user message to the backend first
            if (currentSession?.apiSessionId) {
                try {
                    console.log('🔄 Attempting to save user message to backend:', {
                        sessionId: currentSession.apiSessionId,
                        content: userMessage.substring(0, 100) + '...',
                        model: selectedModel.value,
                        hasImage: !!userImage,
                        apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'NO_API_KEY',
                        privyUserId: userData.privy_user_id
                    });
                    
                    const chatAPI = new ChatHistoryAPI(apiKey, undefined, userData.privy_user_id);
                    const result = await chatAPI.saveMessage(
                        currentSession.apiSessionId,
                        'user',
                        userMessage,
                        selectedModel.value,
                        undefined // Token count not calculated yet
                    );
                    console.log('✅ User message saved to backend successfully:', result);
                } catch (error) {
                    console.error('❌ Failed to save user message to backend:', error);
                    console.error('Error details:', {
                        message: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined,
                        sessionId: currentSession.apiSessionId,
                        hasApiKey: !!apiKey,
                        hasPrivyUserId: !!userData.privy_user_id
                    });
                    // Continue with the request even if saving fails
                }
            } else {
                console.warn('⚠️ Cannot save user message - no API session ID:', {
                    currentSession,
                    sessionId: currentSession?.apiSessionId,
                    currentSessionId
                });
            }

            const sessionIdParam = currentSession?.apiSessionId ? `&session_id=${currentSession.apiSessionId}` : '';
            const url = `${apiBaseUrl}/v1/responses?privy_user_id=${encodeURIComponent(privyUserId)}${sessionIdParam}`;

            console.log('Sending chat request to:', url);
            console.log('API Key:', apiKey.substring(0, 10) + '...');
            console.log('Model:', selectedModel.value);
            console.log('Session ID:', currentSession?.apiSessionId || 'none');

            // Prepare message content with image if present
            let messageContent: any = userMessage;
            if (userImage) {
                messageContent = [
                    { type: 'text', text: userMessage },
                    { type: 'image_url', image_url: { url: userImage } }
                ];
            }

            const mapToResponsesContent = (content: any): any[] => {
                if (typeof content === 'string') {
                    return [{ type: 'input_text', text: content }];
                }

                if (Array.isArray(content)) {
                    return content.map(item => {
                        if (!item || typeof item !== 'object') {
                            return { type: 'input_text', text: String(item ?? '') };
                        }
                        if (item.type === 'text' || item.type === 'input_text') {
                            return { type: 'input_text', text: item.text ?? '' };
                        }
                        if (item.type === 'image_url' || item.type === 'input_image_url') {
                            return {
                                type: 'input_image_url',
                                image_url: item.image_url,
                            };
                        }
                        if (item.type === 'input_audio') {
                            return item;
                        }
                        if (typeof item.content === 'string') {
                            return { type: 'input_text', text: item.content };
                        }
                        return { type: 'input_text', text: JSON.stringify(item) };
                    });
                }

                if (content && typeof content === 'object' && 'text' in content) {
                    return [{ type: 'input_text', text: (content as { text: string }).text }];
                }

                return [{ type: 'input_text', text: String(content ?? '') }];
            };

            // Initialize assistant message with streaming flag
            const assistantMessage: Message = {
                role: 'assistant',
                content: '',
                reasoning: '',
                isStreaming: true
            };

            // Add streaming message to UI
            // Use updatedSessions to preserve the title update from line 1051
            const streamingSessions = updatedSessions.map(session => {
                if (session.id === currentSessionId) {
                    return {
                        ...session,
                        messages: [...updatedMessages, assistantMessage],
                        updatedAt: new Date()
                    };
                }
                return session;
            });
            setSessions(streamingSessions);
            setIsStreamingResponse(true);
            setLoading(false); // Stop loading spinner, but message is still streaming

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
                        // Handle user messages with potential images
                        if (msg.image) {
                            conversationHistory.push({
                                role: 'user',
                                content: [
                                    { type: 'text', text: msg.content },
                                    { type: 'image_url', image_url: { url: msg.image } }
                                ]
                            });
                        } else {
                            conversationHistory.push({
                                role: 'user',
                                content: [{ type: 'text', text: msg.content }]
                            });
                        }
                    } else if (msg.role === 'assistant') {
                        // Handle assistant messages (text only)
                        conversationHistory.push({
                            role: 'assistant',
                            content: [{ type: 'text', text: msg.content }]
                        });
                    }
                }
                
                // Add the current user message
                conversationHistory.push({
                    role: 'user',
                    content: mapToResponsesContent(messageContent)
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
                    input: conversationHistory,
                    stream: true
                };

                if (portkeyProvider) {
                    requestBody.portkey_provider = portkeyProvider;
                }

                if (currentSession?.apiSessionId) {
                    requestBody.metadata = {
                        ...(requestBody.metadata || {}),
                        session_id: currentSession.apiSessionId
                    };
                }

                console.log('📨 Request body prepared:', {
                    model: requestBody.model,
                    hasPortkeyProvider: !!requestBody.portkey_provider,
                    hasMetadata: !!requestBody.metadata,
                    stream: requestBody.stream,
                    inputLength: requestBody.input?.length || 0,
                    url: url
                });

                // Accumulate content locally to avoid state closure issues
                let accumulatedContent = '';
                let accumulatedReasoning = '';

                console.log('🌊 Starting to stream response...');
                for await (const chunk of streamChatResponse(
                    url,
                    apiKey,
                    requestBody
                )) {
                    console.log('📥 Received chunk:', {
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
                        console.log(`Rate limit reached. Retrying in ${waitSeconds} seconds...`);
                        continue;
                    }

                    const hasContent = !!chunk.content;
                    const hasReasoning = !!chunk.reasoning;

                    if (!hasContent && !hasReasoning) {
                        continue;
                    }

                    // Accumulate content locally
                    accumulatedContent += chunk.content || '';
                    accumulatedReasoning += chunk.reasoning || '';

                    // Update the assistant message with streamed content
                    setSessions(prev => prev.map(session => {
                        if (session.id === currentSessionId) {
                            const messages = [...session.messages];
                            const lastMessage = messages[messages.length - 1];

                            if (lastMessage.role === 'assistant') {
                                lastMessage.content = accumulatedContent;
                                lastMessage.reasoning = accumulatedReasoning;
                                lastMessage.isStreaming = !chunk.done;
                            }

                            return {
                                ...session,
                                messages,
                                updatedAt: new Date()
                            };
                        }
                        return session;
                    }));
                }

                // Use the accumulated content instead of reading from stale state
                setIsStreamingResponse(false);

                const finalContent = accumulatedContent;
                console.log({finalContent});

                // Save the assistant's response to the backend
                if (currentSession?.apiSessionId && finalContent) {
                    try {
                        console.log('🔄 Attempting to save assistant message to backend:', {
                            sessionId: currentSession.apiSessionId,
                            content: finalContent.substring(0, 100) + '...',
                            model: modelValue,
                            apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'NO_API_KEY',
                            privyUserId: userData.privy_user_id
                        });
                        
                        const chatAPI = new ChatHistoryAPI(apiKey, undefined, userData.privy_user_id);
                        const result = await chatAPI.saveMessage(
                            currentSession.apiSessionId,
                            'assistant',
                            finalContent,
                            modelValue,
                            undefined // Token count not available from streaming
                        );
                        console.log('✅ Assistant message saved to backend successfully:', result);
                    } catch (error) {
                        console.error('❌ Failed to save assistant message to backend:', error);
                        console.error('Error details:', {
                            message: error instanceof Error ? error.message : String(error),
                            stack: error instanceof Error ? error.stack : undefined,
                            sessionId: currentSession.apiSessionId,
                            hasApiKey: !!apiKey,
                            hasPrivyUserId: !!userData.privy_user_id
                        });
                    }
                } else {
                    console.warn('⚠️ Cannot save assistant message:', {
                        hasSessionId: !!currentSession?.apiSessionId,
                        hasContent: !!finalContent,
                        currentSession,
                        finalContentLength: finalContent?.length || 0
                    });
                }

                // Update session title in API if this is the first message
                // Note: Messages are automatically saved by the backend when session_id is passed
                // The title was already updated locally in updatedSessions (line 1326)
                if (isFirstMessage && currentSession?.apiSessionId && newTitle) {
                    try {
                        if (apiKey) {
                            const chatAPI = new ChatHistoryAPI(apiKey, undefined, userData.privy_user_id);
                            console.log('Updating session title in API:', { oldTitle: 'Untitled Chat', newTitle, sessionId: currentSession.apiSessionId });
                            await chatAPI.updateSession(currentSession.apiSessionId, newTitle);
                        }
                    } catch (error) {
                        console.error('Failed to update session title in API:', error);
                    }

                    // Mark chat task as complete in onboarding
                    try {
                        const savedTasks = localStorage.getItem('gatewayz_onboarding_tasks');
                        if (savedTasks) {
                            const taskState = JSON.parse(savedTasks);
                            if (!taskState.chat) {
                                taskState.chat = true;
                                localStorage.setItem('gatewayz_onboarding_tasks', JSON.stringify(taskState));
                                console.log('Onboarding - Chat task marked as complete');
                            }
                        }
                    } catch (error) {
                        console.error('Failed to update onboarding task:', error);
                    }
                }

            } catch (streamError) {
                setIsStreamingResponse(false);
                console.error('❌ Streaming error occurred:', streamError);
                console.error('Full error object:', {
                    name: streamError instanceof Error ? streamError.name : 'unknown',
                    message: streamError instanceof Error ? streamError.message : String(streamError),
                    stack: streamError instanceof Error ? streamError.stack : undefined,
                    type: typeof streamError,
                    keys: Object.keys(streamError instanceof Error ? streamError : {})
                });

                const errorMessage = streamError instanceof Error ? streamError.message : 'Failed to get response';
                console.error('Error message for analysis:', errorMessage);

                // Check if this is a 500 error or 404 error (model unavailable) and attempt fallback
                const is500Error = errorMessage.includes('500') || errorMessage.includes('Internal server error') || errorMessage.includes('Server error');
                const is404Error = errorMessage.includes('404') || errorMessage.includes('not found') || errorMessage.includes('unavailable');
                const shouldFallback = is500Error || is404Error;

                console.log('Error analysis:', {
                    is500Error,
                    is404Error,
                    shouldFallback,
                    selectedModelValue: selectedModel.value
                });

                if (shouldFallback && selectedModel) {
                    // Define fallback models in order of preference (using top-ranked models):
                    // 1. Auto router (default)
                    // 2. Claude Sonnet 4 (Rank #2)
                    // 3. Claude Sonnet 4.5 (Rank #6)
                    // 4. DeepSeek V3.1 (Rank #5)
                    // 5. Gemini 2.5 Flash (Rank #4)
                    const fallbackModels: ModelOption[] = [
                        { value: 'openrouter/auto', label: 'Auto Router', category: 'Free' },
                        { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', category: 'Paid' },
                        { value: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5', category: 'Paid' },
                        { value: 'deepseek/deepseek-v3.1', label: 'DeepSeek V3.1', category: 'Free' },
                        { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', category: 'Free' }
                    ];

                    // Find the first fallback model that isn't the current model
                    const fallbackModel = fallbackModels.find(fm => fm.value !== selectedModel.value);

                    if (fallbackModel) {
                        console.log(`Model ${selectedModel.value} failed with 500 error, attempting fallback to ${fallbackModel.value}`);

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
                            }],
                            updatedAt: new Date()
                        };
                    }
                    return session;
                }));

                // Determine error type and provide helpful message
                let toastTitle = "Error";
                let toastDescription = errorMessage;

                // Handle API key validation errors (403)
                if (errorMessage.includes('API key') || errorMessage.includes('403')) {
                    toastTitle = "Session Expired";
                    toastDescription = "Your session has expired. Please refresh the page and log in again.";
                }
                // Handle rate limit errors (429)
                else if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
                    toastTitle = "Rate Limit Reached";
                    toastDescription = "You've exceeded the limit of 100 requests per minute (burst of 20). Please wait a moment before trying again.";
                }

                toast({
                    title: toastTitle,
                    description: toastDescription,
                    variant: 'destructive'
                });
            }
        } catch (error) {
            setIsStreamingResponse(false);
            console.error('Send message error:', error);

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
            setLoading(false);
        }
    };

  // Show login screen if not authenticated
  if (!ready) {
    return (
      <div className="flex h-[calc(100dvh-130px)] bg-background items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
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
    <div className="flex h-screen max-h-[calc(100dvh-200px)] has-onboarding-banner:max-h-[calc(100dvh-280px)] bg-background overflow-hidden">
      {/* Left Sidebar */}
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
      <img
        src="/logo_transparent.svg"
        alt="Stats"
        className="absolute top-8 left-1/2 transform -translate-x-1/2 w-[75vh] h-[75vh] pointer-events-none opacity-50 hidden lg:block dark:hidden"
      />
      <img
        src="/logo_black.svg"
        alt="Stats"
        className="absolute top-8 left-1/2 transform -translate-x-1/2 w-[75vh] h-[75vh] pointer-events-none opacity-50 hidden dark:lg:block"
      />

       
        
        {/* Header with title and model selector */}
        <header className="relative z-10 w-full p-4 lg:p-6 max-w-7xl mx-auto overflow-hidden">
          {/* Desktop Layout - Side by side */}
          <div className="hidden lg:flex items-center justify-between gap-4">
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
              <ModelSelect selectedModel={selectedModel} onSelectModel={setSelectedModel} />
            </div>
          </div>

          {/* Mobile Layout - Title above, Model below */}
          <div className="flex lg:hidden flex-col gap-3">
            <div className="flex items-center gap-2 w-full">
              <div className="flex-shrink-0">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon"><Menu/></Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[300px] p-0">
                    <ChatSidebar
                      sessions={sessions}
                      activeSessionId={activeSessionId}
                      switchToSession={switchToSession}
                      createNewChat={createNewChat}
                      onDeleteSession={handleDeleteSession}
                      onRenameSession={handleRenameSession}
                    />
                  </SheetContent>
                </Sheet>
              </div>
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
                    className="text-lg font-semibold h-auto px-2 py-1 min-w-0 flex-1"
                  />
                ) : (
                  <h1 className="text-lg font-semibold truncate min-w-0 flex-1">{activeSession?.title || 'Untitled Chat'}</h1>
                )}
              </div>
            </div>
            <div className="w-full">
              <ModelSelect selectedModel={selectedModel} onSelectModel={setSelectedModel} />
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
            <div ref={chatContainerRef} className="flex-1 flex flex-col gap-4 lg:gap-6 overflow-y-auto p-4 lg:p-6 max-w-4xl mx-auto w-full">
              {messages.filter(msg => msg && msg.role).map((msg, index) => {
                // Show thinking loader for streaming messages with no content
                if (msg.role === 'assistant' && msg.isStreaming && !msg.content) {
                  return <ThinkingLoader key={index} modelName={selectedModel?.label} />;
                }

                return (
                <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  <div className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {msg.role === 'user' ? (
                      <div className="rounded-lg p-3 bg-blue-600 dark:bg-blue-600 text-white">
                        {msg.image && (
                          <img
                            src={msg.image}
                            alt="Uploaded image"
                            className="max-w-[200px] lg:max-w-xs rounded-lg mb-2"
                          />
                        )}
                        <div className="text-sm whitespace-pre-wrap text-white">{msg.content}</div>
                      </div>
                    ) : (
                      <div className="rounded-lg p-3 bg-muted/30 dark:bg-muted/20 border border-border">
                        <div className="flex items-center justify-between mb-2">
                          {selectedModel?.label && <p className="text-xs font-semibold">{selectedModel.label}</p>}
                        </div>
                        <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {fixLatexSyntax(msg.content)}
                          </ReactMarkdown>
                        </div>
                        {/* Action Buttons - always visible in bottom right */}
                        <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t border-border">
                          <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(msg.content)} className="h-8 w-8 p-0 hover:bg-muted" title="Copy response">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => navigator.share({ text: msg.content })} className="h-8 w-8 p-0 hover:bg-muted" title="Share response">
                            <Share2 className="h-4 w-4" />
                          </Button>
                          {handleRegenerate && (
                            <Button variant="ghost" size="sm" onClick={handleRegenerate} className="h-8 w-8 p-0 hover:bg-muted" title="Regenerate response">
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
              {loading && <ChatSkeleton />}
            </div>
          )}

          {/* Welcome screen when no messages */}
          {messages.length === 0 && !loading && (
            <div className="flex-1 flex flex-col items-center justify-start text-center p-4 lg:p-6 w-full overflow-y-auto">
              <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0">
                <h1 className="text-2xl lg:text-4xl font-bold mb-6 lg:mb-8">What's On Your Mind?</h1>

                {/* Suggested prompts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 w-full max-w-4xl">
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

          {/* Message input area - fixed at bottom */}
          <div className="w-full p-4 lg:p-6 max-w-4xl mx-auto flex-shrink-0">
            <div className="w-full">
              <div className="relative">
                {/* Image preview */}
                {selectedImage && (
                  <div className="mb-2 relative inline-block">
                    <img
                      src={selectedImage}
                      alt="Selected image"
                      className="max-w-[200px] lg:max-w-xs max-h-24 lg:max-h-32 rounded-lg border"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      onClick={handleRemoveImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {rateLimitCountdown > 0 && (
                  <div className="mb-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-center">
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      Rate limit reached. Retrying in <span className="font-bold">{rateLimitCountdown}</span> second{rateLimitCountdown !== 1 ? 's' : ''}...
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-1 px-2 py-2 bg-muted/20 dark:bg-muted/40 rounded-lg border border-border">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!ready || !authenticated}
                  >
                    <ImageIcon className="h-5 w-5" />
                  </Button>
                  <Input
                    ref={messageInputRef}
                    placeholder={!ready ? "Authenticating..." : !authenticated ? "Please log in..." : "Start A Message"}
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      // Only mark as typed if there's actual content
                      if (e.target.value.trim()) {
                        setUserHasTyped(true);
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
                    }}
                    disabled={!ready || !authenticated}
                    autoComplete="off"
                    className="border-0 bg-transparent focus-visible:ring-0 text-base text-foreground flex-1"
                  />
                  {(!ready || !authenticated || isStreamingResponse) && (
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleSendMessage}
                    disabled={loading || isStreamingResponse || !message.trim() || !ready || !authenticated}
                    className="h-8 w-8 bg-primary hover:bg-primary/90 text-primary-foreground"
                    title={!ready
                      ? "Waiting for authentication..."
                      : !authenticated
                        ? "Please log in"
                        : isStreamingResponse
                          ? "Please wait for the current response to finish"
                          : "Send message"}
                  >
                     <Send className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex h-[calc(100dvh-130px)] items-center justify-center">Loading...</div>}>
      <ChatPageContent />
    </Suspense>
  );
}
