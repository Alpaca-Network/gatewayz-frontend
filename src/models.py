from typing import Literal

from pydantic import BaseModel


class ImageGenerationRequest(BaseModel):
    """Request model for image generation"""

    prompt: str
    model: str = "stabilityai/sd3.5"
    size: str = "1024x1024"
    n: int = 1
    quality: Literal["standard", "hd"] | None = "standard"
    style: Literal["natural", "vivid"] | None = "natural"
    provider: str | None = (
        "deepinfra"  # Provider selection: "deepinfra", "portkey", or "google-vertex"
    )
    portkey_provider: str | None = "stability-ai"  # Sub-provider for Portkey
    portkey_virtual_key: str | None = None  # Virtual key for Portkey
    google_project_id: str | None = None  # Google Cloud project ID for Vertex AI
    google_location: str | None = None  # Google Cloud region for Vertex AI
    google_endpoint_id: str | None = None  # Vertex AI endpoint ID

    class Config:
        extra = "allow"


class ImageData(BaseModel):
    """Individual image data in response"""

    url: str
    b64_json: str | None = None


class ImageGenerationResponse(BaseModel):
    """Response model for image generation"""

    created: int
    data: list[ImageData]
    provider: str | None = None
    model: str | None = None
