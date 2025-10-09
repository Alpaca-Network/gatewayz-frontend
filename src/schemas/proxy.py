from pydantic import BaseModel, EmailStr
from typing import List, Dict, Any, Optional
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