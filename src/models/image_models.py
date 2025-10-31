"""
Image generation models
"""

from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Literal, Dict, Any

class ImageGenerationRequest(BaseModel):
    """Request model for image generation"""
    model_config = ConfigDict(
        protected_namespaces=(),
        extra="allow"
    )
    
    prompt: str
    model: str = "stabilityai/sd3.5"
    size: str = "1024x1024"
    n: int = 1
    quality: Optional[Literal["standard", "hd"]] = "standard"
    style: Optional[Literal["natural", "vivid"]] = "natural"
    provider: Optional[str] = "deepinfra"  # Provider selection: "deepinfra", "portkey", or "google-vertex"
    portkey_provider: Optional[str] = "stability-ai"  # Sub-provider for Portkey
    portkey_virtual_key: Optional[str] = None  # Virtual key for Portkey
    google_project_id: Optional[str] = None  # Google Cloud project ID for Vertex AI
    google_location: Optional[str] = None  # Google Cloud region for Vertex AI
    google_endpoint_id: Optional[str] = None  # Vertex AI endpoint ID

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
    gateway_usage: Optional[Dict[str, Any]] = None
