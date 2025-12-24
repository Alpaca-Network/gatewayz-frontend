"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, RefreshCw, Brain, Info } from "lucide-react";
import { getApiKey } from "@/lib/api";
import {
  MemoryAPI,
  UserMemory,
  MemoryCategory,
  MEMORY_CATEGORY_LABELS,
  MEMORY_CATEGORY_COLORS,
} from "@/lib/memory-api";

export default function MemoryPage() {
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [stats, setStats] = useState<{
    total_memories: number;
    by_category: Record<string, number>;
  } | null>(null);

  const fetchMemories = useCallback(async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setError("Please sign in to view your AI memory");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const api = new MemoryAPI(apiKey);

      const [memoriesResponse, statsResponse] = await Promise.all([
        api.getMemories(undefined, 100),
        api.getStats(),
      ]);

      if (memoriesResponse.success) {
        setMemories(memoriesResponse.data);
      }

      if (statsResponse.success) {
        setStats(statsResponse.stats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const handleDeleteMemory = async (memoryId: number) => {
    const apiKey = getApiKey();
    if (!apiKey) return;

    try {
      setDeletingId(memoryId);
      const api = new MemoryAPI(apiKey);
      const response = await api.deleteMemory(memoryId);

      if (response.success) {
        setMemories((prev) => prev.filter((m) => m.id !== memoryId));
        if (stats) {
          setStats({
            ...stats,
            total_memories: stats.total_memories - 1,
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete memory");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAllMemories = async () => {
    const apiKey = getApiKey();
    if (!apiKey) return;

    try {
      setDeletingAll(true);
      const api = new MemoryAPI(apiKey);
      const response = await api.deleteAllMemories();

      if (response.success) {
        setMemories([]);
        setStats({
          total_memories: 0,
          by_category: {},
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete memories");
    } finally {
      setDeletingAll(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getCategoryBadge = (category: MemoryCategory) => {
    return (
      <Badge
        variant="secondary"
        className={`${MEMORY_CATEGORY_COLORS[category]} text-xs`}
      >
        {MEMORY_CATEGORY_LABELS[category]}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold">AI Memory</h1>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading memories...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold">AI Memory</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">{error}</p>
            <Button onClick={fetchMemories} variant="outline" className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" />
            AI Memory
          </h1>
          {stats && (
            <p className="text-sm text-muted-foreground mt-1">
              {stats.total_memories} {stats.total_memories === 1 ? "memory" : "memories"} stored
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchMemories} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {memories.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={deletingAll}>
                  {deletingAll ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Clear All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all memories?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all {memories.length} memories. The AI will no longer
                    remember information from your previous conversations. This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAllMemories}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p>
                The AI automatically remembers key facts from your conversations to provide
                more personalized responses. These memories are private to you and help the
                AI understand your preferences, context, and instructions across sessions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {memories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No memories yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              As you chat with the AI, it will automatically remember important information
              like your preferences, instructions, and context. These memories will appear
              here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {memories.map((memory) => (
            <Card key={memory.id} className="group">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getCategoryBadge(memory.category)}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(memory.created_at)}
                      </span>
                      {memory.access_count > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Used {memory.access_count}x
                        </span>
                      )}
                    </div>
                    <p className="text-sm">{memory.content}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeleteMemory(memory.id)}
                    disabled={deletingId === memory.id}
                  >
                    {deletingId === memory.id ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {stats && Object.keys(stats.by_category).length > 0 && (
        <div className="pt-4 border-t">
          <h3 className="text-sm font-medium mb-3">Memories by Category</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.by_category).map(([category, count]) => (
              <div key={category} className="flex items-center gap-1.5">
                {getCategoryBadge(category as MemoryCategory)}
                <span className="text-xs text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
