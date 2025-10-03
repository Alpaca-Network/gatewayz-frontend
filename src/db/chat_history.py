import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from src.supabase_config import get_supabase_client

logger = logging.getLogger(__name__)


def create_chat_session(user_id: int, title: str = None, model: str = None) -> Dict[str, Any]:
    """Create a new chat session for a user"""
    try:
        client = get_supabase_client()
        
        # Generate title if not provided
        if not title:
            title = f"Chat {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}"
        
        session_data = {
            'user_id': user_id,
            'title': title,
            'model': model or 'openai/gpt-3.5-turbo',
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat(),
            'is_active': True
        }
        
        result = client.table('chat_sessions').insert(session_data).execute()
        
        if not result.data:
            raise ValueError("Failed to create chat session")
        
        session = result.data[0]
        logger.info(f"Created chat session {session['id']} for user {user_id}")
        return session
        
    except Exception as e:
        logger.error(f"Failed to create chat session: {e}")
        raise RuntimeError(f"Failed to create chat session: {e}")


def save_chat_message(session_id: int, role: str, content: str, model: str = None, tokens: int = 0) -> Dict[str, Any]:
    """Save a chat message to a session"""
    try:
        client = get_supabase_client()
        
        message_data = {
            'session_id': session_id,
            'role': role,  # 'user' or 'assistant'
            'content': content,
            'model': model,
            'tokens': tokens,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        result = client.table('chat_messages').insert(message_data).execute()
        
        if not result.data:
            raise ValueError("Failed to save chat message")
        
        message = result.data[0]
        logger.info(f"Saved message {message['id']} to session {session_id}")
        return message
        
    except Exception as e:
        logger.error(f"Failed to save chat message: {e}")
        raise RuntimeError(f"Failed to save chat message: {e}")


def get_user_chat_sessions(user_id: int, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    """Get all chat sessions for a user"""
    try:
        client = get_supabase_client()
        
        result = client.table('chat_sessions').select('*').eq('user_id', user_id).eq('is_active', True).order('updated_at', desc=True).range(offset, offset + limit - 1).execute()
        
        sessions = result.data or []
        logger.info(f"Retrieved {len(sessions)} chat sessions for user {user_id}")
        return sessions
        
    except Exception as e:
        logger.error(f"Failed to get chat sessions: {e}")
        raise RuntimeError(f"Failed to get chat sessions: {e}")


def get_chat_session(session_id: int, user_id: int) -> Optional[Dict[str, Any]]:
    """Get a specific chat session with messages"""
    try:
        client = get_supabase_client()
        
        # Get session
        session_result = client.table('chat_sessions').select('*').eq('id', session_id).eq('user_id', user_id).eq('is_active', True).execute()
        
        if not session_result.data:
            logger.warning(f"Chat session {session_id} not found for user {user_id}")
            return None
        
        session = session_result.data[0]
        
        # Get messages for this session
        messages_result = client.table('chat_messages').select('*').eq('session_id', session_id).order('created_at', desc=False).execute()
        
        session['messages'] = messages_result.data or []
        logger.info(f"Retrieved session {session_id} with {len(session['messages'])} messages")
        return session
        
    except Exception as e:
        logger.error(f"Failed to get chat session: {e}")
        raise RuntimeError(f"Failed to get chat session: {e}")


def update_chat_session(session_id: int, user_id: int, title: str = None, model: str = None) -> bool:
    """Update a chat session"""
    try:
        client = get_supabase_client()
        
        update_data = {
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        
        if title:
            update_data['title'] = title
        if model:
            update_data['model'] = model
        
        result = client.table('chat_sessions').update(update_data).eq('id', session_id).eq('user_id', user_id).execute()
        
        if not result.data:
            logger.warning(f"Failed to update chat session {session_id}")
            return False
        
        logger.info(f"Updated chat session {session_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to update chat session: {e}")
        raise RuntimeError(f"Failed to update chat session: {e}")


def delete_chat_session(session_id: int, user_id: int) -> bool:
    """Delete a chat session (soft delete)"""
    try:
        client = get_supabase_client()
        
        # Soft delete - mark as inactive
        result = client.table('chat_sessions').update({
            'is_active': False,
            'updated_at': datetime.now(timezone.utc).isoformat()
        }).eq('id', session_id).eq('user_id', user_id).execute()
        
        if not result.data:
            logger.warning(f"Failed to delete chat session {session_id}")
            return False
        
        logger.info(f"Deleted chat session {session_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to delete chat session: {e}")
        raise RuntimeError(f"Failed to delete chat session: {e}")


def get_chat_session_stats(user_id: int) -> Dict[str, Any]:
    """Get chat session statistics for a user"""
    try:
        client = get_supabase_client()
        
        # Get total sessions
        sessions_result = client.table('chat_sessions').select('id').eq('user_id', user_id).eq('is_active', True).execute()
        total_sessions = len(sessions_result.data) if sessions_result.data else 0
        
        # Get total messages
        messages_result = client.table('chat_messages').select('id').join('chat_sessions', 'session_id', 'id').eq('chat_sessions.user_id', user_id).eq('chat_sessions.is_active', True).execute()
        total_messages = len(messages_result.data) if messages_result.data else 0
        
        # Get total tokens
        tokens_result = client.table('chat_messages').select('tokens').join('chat_sessions', 'session_id', 'id').eq('chat_sessions.user_id', user_id).eq('chat_sessions.is_active', True).execute()
        total_tokens = sum(msg.get('tokens', 0) for msg in tokens_result.data) if tokens_result.data else 0
        
        stats = {
            'total_sessions': total_sessions,
            'total_messages': total_messages,
            'total_tokens': total_tokens
        }
        
        logger.info(f"Retrieved chat stats for user {user_id}: {stats}")
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get chat session stats: {e}")
        raise RuntimeError(f"Failed to get chat session stats: {e}")


def search_chat_sessions(user_id: int, query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Search chat sessions by title or message content"""
    try:
        client = get_supabase_client()
        
        # Search in session titles
        title_result = client.table('chat_sessions').select('*').eq('user_id', user_id).eq('is_active', True).ilike('title', f'%{query}%').execute()
        
        # Search in message content
        message_result = client.table('chat_messages').select('session_id').ilike('content', f'%{query}%').execute()
        
        session_ids = set()
        if message_result.data:
            session_ids.update(msg['session_id'] for msg in message_result.data)
        
        # Get sessions from message search
        message_sessions = []
        if session_ids:
            message_sessions_result = client.table('chat_sessions').select('*').eq('user_id', user_id).eq('is_active', True).in_('id', list(session_ids)).execute()
            message_sessions = message_sessions_result.data or []
        
        # Combine and deduplicate results
        all_sessions = (title_result.data or []) + message_sessions
        unique_sessions = {session['id']: session for session in all_sessions}.values()
        
        # Sort by updated_at and limit
        sorted_sessions = sorted(unique_sessions, key=lambda x: x['updated_at'], reverse=True)[:limit]
        
        logger.info(f"Found {len(sorted_sessions)} sessions matching query '{query}' for user {user_id}")
        return list(sorted_sessions)
        
    except Exception as e:
        logger.error(f"Failed to search chat sessions: {e}")
        raise RuntimeError(f"Failed to search chat sessions: {e}")
