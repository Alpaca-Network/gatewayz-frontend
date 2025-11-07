from enum import Enum
from typing import Any

from pydantic import BaseModel, field_validator

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
    messages: list[Message]
    max_tokens: int | None = 950
    temperature: float | None = 1.0
    top_p: float | None = 1.0
    frequency_penalty: float | None = 0.0
    presence_penalty: float | None = 0.0
    stream: bool | None = False
    tools: list[dict[str, Any]] | None = None  # Function calling tools
    provider: str | None = None  # Provider selection: "openrouter" or "portkey"
    portkey_provider: str | None = "openai"  # Sub-provider for Portkey
    portkey_virtual_key: str | None = None  # Virtual key for Portkey

    class Config:
        extra = "allow"

    @field_validator("messages")
    @classmethod
    def validate_messages(cls, messages: list[Message]) -> list[Message]:
        if not messages:
            raise ValueError("messages must contain at least one message.")
        return messages


class ResponseFormatType(str, Enum):
    text = "text"
    json_object = "json_object"
    json_schema = "json_schema"


class ResponseFormat(BaseModel):
    type: ResponseFormatType = ResponseFormatType.text
    json_schema: dict[str, Any] | None = None


class InputMessage(BaseModel):
    """
    Unified input message for v1/responses endpoint.
    Supports multimodal input (text, images, etc.)
    """

    role: str
    content: str | list[dict[str, Any]]  # String or multimodal content array


class ResponseRequest(BaseModel):
    """
    Unified API request schema for v1/responses endpoint.
    This is the newer, more flexible alternative to v1/chat/completions.
    """

    model: str
    input: list[InputMessage]  # Replaces 'messages' in chat/completions
    max_tokens: int | None = 950
    temperature: float | None = 1.0
    top_p: float | None = 1.0
    frequency_penalty: float | None = 0.0
    presence_penalty: float | None = 0.0
    stream: bool | None = False
    tools: list[dict[str, Any]] | None = None  # Function calling tools
    response_format: ResponseFormat | None = None
    provider: str | None = None
    portkey_provider: str | None = "openai"
    portkey_virtual_key: str | None = None

    class Config:
        extra = "allow"

    @field_validator("input")
    @classmethod
    def validate_input(cls, messages: list[InputMessage]) -> list[InputMessage]:
        if not messages:
            raise ValueError("input must contain at least one message.")
        return messages


# ============================================================================
# Anthropic Messages API Schemas
# ============================================================================


class ContentBlock(BaseModel):
    """Content block for Anthropic Messages API"""

    type: str  # "text", "image", etc.
    text: str | None = None
    source: dict[str, Any] | None = None  # For image blocks

    class Config:
        extra = "allow"


class AnthropicMessage(BaseModel):
    """Message format for Anthropic Messages API"""

    role: str  # "user" or "assistant"
    content: str | list[ContentBlock]  # String or content blocks

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
    def validate_content(cls, content: str | list[ContentBlock]) -> str | list[ContentBlock]:
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
    - Supports tool use (function calling)
    """

    model: str  # e.g., "claude-sonnet-4-5-20250929"
    messages: list[AnthropicMessage]
    max_tokens: int  # REQUIRED for Anthropic API
    system: str | None = None  # System prompt (separate from messages)
    temperature: float | None = 1.0
    top_p: float | None = None
    top_k: int | None = None  # Anthropic-specific
    stop_sequences: list[str] | None = None
    stream: bool | None = False
    metadata: dict[str, Any] | None = None
    tools: list[dict[str, Any]] | None = None  # Tool definitions for function calling
    tool_choice: str | dict[str, Any] | None = None  # Tool selection: "auto", "required", or specific tool

    # Gateway-specific fields (not part of Anthropic API)
    provider: str | None = None
    portkey_provider: str | None = "openai"
    portkey_virtual_key: str | None = None

    class Config:
        extra = "allow"

    @field_validator("messages")
    @classmethod
    def validate_messages(cls, messages: list[AnthropicMessage]) -> list[AnthropicMessage]:
        if not messages:
            raise ValueError("messages must contain at least one message.")
        return messages

    @field_validator("max_tokens")
    @classmethod
    def validate_max_tokens(cls, max_tokens: int) -> int:
        if max_tokens <= 0:
            raise ValueError("max_tokens must be a positive integer.")
        return max_tokens
