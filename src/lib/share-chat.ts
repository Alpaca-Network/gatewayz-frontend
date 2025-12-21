/**
 * Utility functions for chat sharing functionality
 */

export interface CreateShareLinkParams {
  sessionId: number;
  expiresAt?: Date;
}

export interface ShareLinkResponse {
  success: boolean;
  data?: {
    id: number;
    session_id: number;
    share_token: string;
    created_by_user_id: number;
    created_at: string;
    expires_at: string | null;
    view_count: number;
    last_viewed_at: string | null;
    is_active: boolean;
  };
  share_url?: string;
  message?: string;
  error?: string;
}

export interface SharedChatPublicView {
  success: boolean;
  data?: {
    session_id: number;
    title: string;
    model: string;
    created_at: string;
    messages: Array<{
      id: number;
      session_id: number;
      role: 'user' | 'assistant';
      content: string;
      model?: string;
      tokens?: number;
      created_at: string;
    }>;
  };
  message?: string;
  error?: string;
}

/**
 * Create a shareable link for a chat session
 */
export async function createShareLink(params: CreateShareLinkParams): Promise<ShareLinkResponse> {
  try {
    const response = await fetch('/api/chat/share', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: params.sessionId,
        expires_at: params.expiresAt?.toISOString(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to create share link');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating share link:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create share link',
    };
  }
}

/**
 * Get a shared chat by its token (public, no auth required)
 */
export async function getSharedChat(token: string): Promise<SharedChatPublicView> {
  try {
    const response = await fetch(`/api/chat/share/${token}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Shared chat not found or has expired');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch shared chat');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching shared chat:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch shared chat',
    };
  }
}

/**
 * Get all share links created by the current user
 */
export async function getUserShareLinks(limit = 50, offset = 0): Promise<ShareLinkResponse[]> {
  try {
    const response = await fetch(`/api/chat/share?limit=${limit}&offset=${offset}`);

    if (!response.ok) {
      throw new Error('Failed to fetch share links');
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching user share links:', error);
    return [];
  }
}

/**
 * Delete a share link by its token
 * @param shareToken - The share token (not the numeric ID)
 */
export async function deleteShareLink(shareToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/chat/share/${shareToken}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to delete share link');
    }

    const data = await response.json();
    return { success: data.success !== false };
  } catch (error) {
    console.error('Error deleting share link:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete share link',
    };
  }
}

/**
 * Copy share URL to clipboard and show a toast notification
 */
export async function copyShareUrlToClipboard(
  shareUrl: string,
  toast?: (options: { title: string; description?: string }) => void
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(shareUrl);

    if (toast) {
      toast({
        title: 'Share link copied!',
        description: 'Anyone with this link can view this conversation.',
      });
    }

    return true;
  } catch (error) {
    console.error('Failed to copy share URL:', error);

    if (toast) {
      toast({
        title: 'Failed to copy link',
        description: 'Please try again or copy manually.',
      });
    }

    return false;
  }
}
