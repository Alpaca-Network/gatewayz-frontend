from pydantic import BaseModel, EmailStr, field_validator
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from enum import Enum


ALLOWED_CHAT_ROLES = {"system", "user", "assistant"}


class Message(BaseModel):
    role: str
    content: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, role: str) -> str:
        if role not in ALLOWED_CHAT_ROLES:
            raise ValueError(
                f"Invalid message role '{role}'. "
                f"Supported roles are: {', '.join(sorted(ALLOWED_CHAT_ROLES))}."
            )
        return role

    @field_validator("content")
    @classmethod
    def validate_content(cls, content: str) -> str:
        if not isinstance(content, str) or not content.strip():
            raise ValueError("Message content must be a non-empty string.")
        return content


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

    @field_validator("messages")
    @classmethod
    def validate_messages(cls, messages: List[Message]) -> List[Message]:
        if not messages:
            raise ValueError("messages must contain at least one message.")
        return messages


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

    @field_validator("input")
    @classmethod
    def validate_input(cls, messages: List[InputMessage]) -> List[InputMessage]:
        if not messages:
            raise ValueError("input must contain at least one message.")
        return messages


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

    @field_validator("role")
    @classmethod
    def validate_role(cls, role: str) -> str:
        allowed_roles = {"user", "assistant"}
        if role not in allowed_roles:
            raise ValueError(
                f"Invalid Anthropic message role '{role}'. "
                f"Supported roles are: {', '.join(sorted(allowed_roles))}."
            )
        return role

    @field_validator("content")
    @classmethod
    def validate_content(cls, content: Union[str, List[ContentBlock]]) -> Union[str, List[ContentBlock]]:
        if isinstance(content, str):
            if not content.strip():
                raise ValueError("Message content must be a non-empty string.")
        elif isinstance(content, list):
            if len(content) == 0:
                raise ValueError("Message content blocks cannot be empty.")
        else:
            raise ValueError("Message content must be a string or list of content blocks.")
        return content


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

    @field_validator("messages")
    @classmethod
    def validate_messages(cls, messages: List[AnthropicMessage]) -> List[AnthropicMessage]:
        if not messages:
            raise ValueError("messages must contain at least one message.")
        return messages

    @field_validator("max_tokens")
    @classmethod
    def validate_max_tokens(cls, max_tokens: int) -> int:
        if max_tokens <= 0:
            raise ValueError("max_tokens must be a positive integer.")
        return max_tokens
