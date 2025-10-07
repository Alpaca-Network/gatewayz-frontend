import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from src.db.chat_history import (
    create_chat_session, get_user_chat_sessions, get_chat_session,
    update_chat_session, delete_chat_session, get_chat_session_stats,
    search_chat_sessions, save_chat_message
)
from src.schemas.chat import (
    CreateChatSessionRequest, UpdateChatSessionRequest, ChatSessionResponse,
    ChatSessionsListResponse, ChatSessionStatsResponse, SearchChatSessionsRequest,
    SaveChatMessageRequest
)
from src.security.deps import get_api_key
from src.db.users import get_user

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/chat", tags=["chat-history"])


@router.post("/sessions", response_model=ChatSessionResponse)
async def create_session(
    request: CreateChatSessionRequest,
    api_key: str = Depends(get_api_key)
):
    """Create a new chat session"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        session = create_chat_session(
            user_id=user['id'],
            title=request.title,
            model=request.model
        )
        
        logger.info(f"Created chat session {session['id']} for user {user['id']}")
        
        return ChatSessionResponse(
            success=True,
            data=session,
            message="Chat session created successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to create chat session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create chat session: {str(e)}")


@router.get("/sessions", response_model=ChatSessionsListResponse)
async def get_sessions(
    api_key: str = Depends(get_api_key),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get all chat sessions for the authenticated user"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        sessions = get_user_chat_sessions(
            user_id=user['id'],
            limit=limit,
            offset=offset
        )
        
        logger.info(f"Retrieved {len(sessions)} chat sessions for user {user['id']}")
        
        return ChatSessionsListResponse(
            success=True,
            data=sessions,
            count=len(sessions),
            message=f"Retrieved {len(sessions)} chat sessions"
        )
        
    except Exception as e:
        logger.error(f"Failed to get chat sessions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get chat sessions: {str(e)}")


@router.get("/sessions/{session_id}", response_model=ChatSessionResponse)
async def get_session(
    session_id: int,
    api_key: str = Depends(get_api_key)
):
    """Get a specific chat session with messages"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        session = get_chat_session(session_id, user['id'])
        
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        
        logger.info(f"Retrieved chat session {session_id} for user {user['id']}")
        
        return ChatSessionResponse(
            success=True,
            data=session,
            message="Chat session retrieved successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get chat session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get chat session: {str(e)}")


@router.put("/sessions/{session_id}", response_model=ChatSessionResponse)
async def update_session(
    session_id: int,
    request: UpdateChatSessionRequest,
    api_key: str = Depends(get_api_key)
):
    """Update a chat session"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        success = update_chat_session(
            session_id=session_id,
            user_id=user['id'],
            title=request.title,
            model=request.model
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Chat session not found")
        
        # Get updated session
        session = get_chat_session(session_id, user['id'])
        
        logger.info(f"Updated chat session {session_id} for user {user['id']}")
        
        return ChatSessionResponse(
            success=True,
            data=session,
            message="Chat session updated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update chat session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update chat session: {str(e)}")


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    api_key: str = Depends(get_api_key)
):
    """Delete a chat session"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        success = delete_chat_session(session_id, user['id'])
        
        if not success:
            raise HTTPException(status_code=404, detail="Chat session not found")
        
        logger.info(f"Deleted chat session {session_id} for user {user['id']}")
        
        return {
            "success": True,
            "message": "Chat session deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete chat session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete chat session: {str(e)}")


@router.get("/stats", response_model=ChatSessionStatsResponse)
async def get_stats(api_key: str = Depends(get_api_key)):
    """Get chat session statistics for the authenticated user"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        stats = get_chat_session_stats(user['id'])
        
        logger.info(f"Retrieved chat stats for user {user['id']}")
        
        return ChatSessionStatsResponse(
            success=True,
            stats=stats,
            message="Chat statistics retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to get chat stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get chat stats: {str(e)}")


@router.post("/search", response_model=ChatSessionsListResponse)
async def search_sessions(
    request: SearchChatSessionsRequest,
    api_key: str = Depends(get_api_key)
):
    """Search chat sessions by title or message content"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        sessions = search_chat_sessions(
            user_id=user['id'],
            query=request.query,
            limit=request.limit
        )
        
        logger.info(f"Found {len(sessions)} sessions matching '{request.query}' for user {user['id']}")
        
        return ChatSessionsListResponse(
            success=True,
            data=sessions,
            count=len(sessions),
            message=f"Found {len(sessions)} sessions matching '{request.query}'"
        )
        
    except Exception as e:
        logger.error(f"Failed to search chat sessions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to search chat sessions: {str(e)}")


@router.post("/sessions/{session_id}/messages")
async def save_message(
    session_id: int,
    request: SaveChatMessageRequest,
    api_key: str = Depends(get_api_key)
):
    """Save a message to a chat session (accepts JSON body)"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        # Verify session belongs to user
        session = get_chat_session(session_id, user['id'])
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        message = save_chat_message(
            session_id=session_id,
            role=request.role,
            content=request.content,
            model=request.model,
            tokens=request.tokens
        )

        logger.info(f"Saved message {message['id']} to session {session_id}")

        return {
            "success": True,
            "data": message,
            "message": "Message saved successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save message: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save message: {str(e)}")
