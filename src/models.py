from pydantic import BaseModel
from typing import List, Optional, Literal


class ImageGenerationRequest(BaseModel):
    """Request model for image generation"""
    prompt: str
    model: str = "stabilityai/sd3.5"
    size: str = "1024x1024"
    n: int = 1
    quality: Optional[Literal["standard", "hd"]] = "standard"
    style: Optional[Literal["natural", "vivid"]] = "natural"
    provider: Optional[str] = "deepinfra"  # Provider selection: "deepinfra" or "portkey"
    portkey_provider: Optional[str] = "stability-ai"  # Sub-provider for Portkey
    portkey_virtual_key: Optional[str] = None  # Virtual key for Portkey

    class Config:
        extra = "allow"


class ImageData(BaseModel):
    """Individual image data in response"""
    url: str
    b64_json: Optional[str] = None


class ImageGenerationResponse(BaseModel):
    """Response model for image generation"""
    created: int
    data: List[ImageData]
    provider: Optional[str] = None
    model: Optional[str] = None
