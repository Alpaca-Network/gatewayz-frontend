from pydantic import BaseModel, EmailStr
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum

# Chat History Models
class ChatMessage(BaseModel):
    id: Optional[int] = None
    session_id: int
    role: str  # 'user' or 'assistant'
    content: str
    model: Optional[str] = None
    tokens: Optional[int] = 0
    created_at: Optional[datetime] = None


class ChatSession(BaseModel):
    id: Optional[int] = None
    user_id: int
    title: str
    model: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_active: Optional[bool] = True
    messages: Optional[List[ChatMessage]] = []


class CreateChatSessionRequest(BaseModel):
    title: Optional[str] = None
    model: Optional[str] = None


class UpdateChatSessionRequest(BaseModel):
    title: Optional[str] = None
    model: Optional[str] = None


class ChatSessionResponse(BaseModel):
    success: bool
    data: Optional[ChatSession] = None
    message: Optional[str] = None


class ChatSessionsListResponse(BaseModel):
    success: bool
    data: List[ChatSession]
    count: int
    message: Optional[str] = None


class ChatSessionStatsResponse(BaseModel):
    success: bool
    stats: Dict[str, Any]
    message: Optional[str] = None


class SearchChatSessionsRequest(BaseModel):
    query: str
    limit: Optional[int] = 20