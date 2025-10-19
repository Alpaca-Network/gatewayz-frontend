from pydantic import BaseModel, EmailStr
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from enum import Enum


class Message(BaseModel):
    role: str
    content: str


class ProxyRequest(BaseModel):
    model: str
    messages: List[Message]
    max_tokens: Optional[int] = 950
    temperature: Optional[float] = 1.0
    top_p: Optional[float] = 1.0
    frequency_penalty: Optional[float] = 0.0
    presence_penalty: Optional[float] = 0.0
    stream: Optional[bool] = False
    provider: Optional[str] = None  # Provider selection: "openrouter" or "portkey"
    portkey_provider: Optional[str] = "openai"  # Sub-provider for Portkey
    portkey_virtual_key: Optional[str] = None  # Virtual key for Portkey

    class Config:
        extra = "allow"


class ResponseFormatType(str, Enum):
    text = "text"
    json_object = "json_object"
    json_schema = "json_schema"


class ResponseFormat(BaseModel):
    type: ResponseFormatType = ResponseFormatType.text
    json_schema: Optional[Dict[str, Any]] = None


class InputMessage(BaseModel):
    """
    Unified input message for v1/responses endpoint.
    Supports multimodal input (text, images, etc.)
    """
    role: str
    content: Union[str, List[Dict[str, Any]]]  # String or multimodal content array


class ResponseRequest(BaseModel):
    """
    Unified API request schema for v1/responses endpoint.
    This is the newer, more flexible alternative to v1/chat/completions.
    """
    model: str
    input: List[InputMessage]  # Replaces 'messages' in chat/completions
    max_tokens: Optional[int] = 950
    temperature: Optional[float] = 1.0
    top_p: Optional[float] = 1.0
    frequency_penalty: Optional[float] = 0.0
    presence_penalty: Optional[float] = 0.0
    stream: Optional[bool] = False
    response_format: Optional[ResponseFormat] = None
    provider: Optional[str] = None
    portkey_provider: Optional[str] = "openai"
    portkey_virtual_key: Optional[str] = None

    class Config:
        extra = "allow"


# ============================================================================
# Anthropic Messages API Schemas
# ============================================================================

class ContentBlock(BaseModel):
    """Content block for Anthropic Messages API"""
    type: str  # "text", "image", etc.
    text: Optional[str] = None
    source: Optional[Dict[str, Any]] = None  # For image blocks

    class Config:
        extra = "allow"


class AnthropicMessage(BaseModel):
    """Message format for Anthropic Messages API"""
    role: str  # "user" or "assistant"
    content: Union[str, List[ContentBlock]]  # String or content blocks


class MessagesRequest(BaseModel):
    """
    Anthropic Messages API request schema (Claude API compatible).
    Endpoint: POST /v1/messages

    Key differences from OpenAI:
    - Uses 'messages' array (like OpenAI) but 'system' is separate parameter
    - 'max_tokens' is REQUIRED (not optional)
    - Content can be string or array of content blocks
    - No frequency_penalty or presence_penalty
    """
    model: str  # e.g., "claude-sonnet-4-5-20250929"
    messages: List[AnthropicMessage]
    max_tokens: int  # REQUIRED for Anthropic API
    system: Optional[str] = None  # System prompt (separate from messages)
    temperature: Optional[float] = 1.0
    top_p: Optional[float] = None
    top_k: Optional[int] = None  # Anthropic-specific
    stop_sequences: Optional[List[str]] = None
    stream: Optional[bool] = False
    metadata: Optional[Dict[str, Any]] = None

    # Gateway-specific fields (not part of Anthropic API)
    provider: Optional[str] = None
    portkey_provider: Optional[str] = "openai"
    portkey_virtual_key: Optional[str] = None

    class Config:
        extra = "allow"
