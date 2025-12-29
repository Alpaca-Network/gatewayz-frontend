"use client";

import { useMemo, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { Plus, Search, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { useChatSessions, useCreateSession, useDeleteSession, useUpdateSession } from "@/lib/hooks/use-chat-queries";
import { useChatUIStore } from "@/lib/store/chat-ui-store";
import { ChatSession } from "@/lib/chat-history";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function ChatSidebar({ className, onClose }: { className?: string; onClose?: () => void }) {
  const { data: sessions = [], isLoading } = useChatSessions();
  const { activeSessionId, setActiveSessionId, selectedModel } = useChatUIStore();
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();
  const updateSession = useUpdateSession();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [sessionToDelete, setSessionToDelete] = useState<number | null>(null);
  const [sessionToRename, setSessionToRename] = useState<ChatSession | null>(null);
  const [newName, setNewName] = useState("");

  const filteredSessions = useMemo(() => {
    if (!searchQuery) return sessions;
    return sessions.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [sessions, searchQuery]);

  const groupedSessions = useMemo(() => {
    return filteredSessions.reduce((groups, session) => {
      const date = new Date(session.updated_at || session.created_at); // Use updated_at for grouping
      let groupName = format(date, 'MMMM d, yyyy');
      if (isToday(date)) groupName = 'Today';
      else if (isYesterday(date)) groupName = 'Yesterday';

      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(session);
      return groups;
    }, {} as Record<string, ChatSession[]>);
  }, [filteredSessions]);

  const handleCreateNew = async () => {
      try {
          const newSession = await createSession.mutateAsync({ 
              title: "Untitled Chat",
              model: selectedModel?.value 
          });
          setActiveSessionId(newSession.id);
          onClose?.();
      } catch (e) {
          console.error("Failed to create session", e);
          toast({
            title: "Unable to start a new chat",
            description: "Please try again in a moment.",
            variant: "destructive",
          });
      }
  };

  const handleDelete = async () => {
      if (sessionToDelete) {
          try {
              await deleteSession.mutateAsync(sessionToDelete);
              if (activeSessionId === sessionToDelete) {
                  setActiveSessionId(null);
              }
          } catch (e) {
              console.error("Failed to delete session", e);
              toast({
                  title: "Failed to delete chat",
                  description: "Please try again in a moment.",
                  variant: "destructive",
              });
          } finally {
              setSessionToDelete(null);
          }
      }
  };

  const handleRename = async () => {
      if (sessionToRename && newName.trim()) {
          try {
              await updateSession.mutateAsync({
                  sessionId: sessionToRename.id,
                  title: newName.trim()
              });
              setSessionToRename(null);
          } catch (e) {
              console.error("Failed to rename session", e);
              toast({
                  title: "Failed to rename chat",
                  description: "Please try again in a moment.",
                  variant: "destructive",
              });
              // Don't close the dialog on error so user can retry
          }
      }
  };

  // Handle session selection with proper sequencing to avoid race condition
  const handleSessionSelect = (sessionId: number) => {
      setActiveSessionId(sessionId);
      // Use setTimeout to ensure state update completes before closing sidebar
      setTimeout(() => {
          onClose?.();
      }, 50);
  };

  return (
    <div className={cn("flex flex-col h-full bg-background border-r", className)}>
      <div className="p-4 border-b space-y-4">
        <Button 
            className="w-full justify-start gap-2" 
            onClick={handleCreateNew}
            disabled={createSession.isPending}
        >
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search chats..." 
            className="pl-8" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
            <div className="flex justify-center p-4 text-muted-foreground text-sm">Loading...</div>
        ) : (
            Object.entries(groupedSessions).map(([group, groupSessions]) => (
            <div key={group} className="mb-4">
                <h3 className="text-xs font-semibold text-muted-foreground px-2 mb-2 uppercase">{group}</h3>
                <div className="space-y-1">
                {groupSessions.map(session => (
                    <div 
                        key={session.id}
                        className={cn(
                            "group flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer text-sm",
                            activeSessionId === session.id && "bg-accent"
                        )}
                        onClick={() => handleSessionSelect(session.id)}
                    >
                        <div className="truncate flex-1 pr-2">
                            <div className="font-medium truncate">{session.title}</div>
                            <div className="text-xs text-muted-foreground truncate">
                                {format(new Date(session.created_at), 'h:mm a')}
                            </div>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <MoreHorizontal className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    setSessionToRename(session);
                                    setNewName(session.title);
                                }}>
                                    <Pencil className="mr-2 h-4 w-4" /> Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                    className="text-destructive focus:text-destructive"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSessionToDelete(session.id);
                                    }}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ))}
                </div>
            </div>
            ))
        )}
        {!isLoading && filteredSessions.length === 0 && (
            <div className="text-center p-4 text-muted-foreground text-sm">
                No chats found
            </div>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={!!sessionToDelete} onOpenChange={(open) => !open && setSessionToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Delete Chat?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <Dialog open={!!sessionToRename} onOpenChange={(open) => !open && setSessionToRename(null)}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Rename Chat</DialogTitle>
                  <DialogDescription>
                      Enter a new name for this chat session.
                  </DialogDescription>
              </DialogHeader>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              />
              <DialogFooter>
                  <Button variant="outline" onClick={() => setSessionToRename(null)}>Cancel</Button>
                  <Button onClick={handleRename}>Save</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
