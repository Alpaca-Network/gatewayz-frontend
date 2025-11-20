from typing import List, Literal, Optional

from pydantic import BaseModel


class ImageGenerationRequest(BaseModel):
    """Request model for image generation"""

    prompt: str
    model: str = "stabilityai/sd3.5"
    size: str = "1024x1024"
    n: int = 1
    quality: Optional[Literal["standard", "hd"]] = "standard"
    style: Optional[Literal["natural", "vivid"]] = "natural"
    provider: Optional[str] = (
        "deepinfra"  # Provider selection: "deepinfra" or "google-vertex"
    )
    google_project_id: Optional[str] = None  # Google Cloud project ID for Vertex AI
    google_location: Optional[str] = None  # Google Cloud region for Vertex AI
    google_endpoint_id: Optional[str] = None  # Vertex AI endpoint ID

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
