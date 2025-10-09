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
    provider: Optional[str] = "openrouter"  # Provider selection: "openrouter" or "portkey"
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
    provider: Optional[str] = "openrouter"
    portkey_provider: Optional[str] = "openai"
    portkey_virtual_key: Optional[str] = None

    class Config:
        extra = "allow"