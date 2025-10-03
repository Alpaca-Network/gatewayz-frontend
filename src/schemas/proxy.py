from pydantic import BaseModel
from typing import List, Optional


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

    class Config:
        extra = "allow"