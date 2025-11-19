"""
Debug endpoints for Alibaba Cloud integration testing

These endpoints help diagnose issues with the Alibaba Cloud / Qwen integration.
Usage: Call these endpoints with your API key to verify the integration is working.
"""

from fastapi import APIRouter, Depends
from src.security.deps import get_api_key
from src.services.alibaba_cloud_client import (
    get_alibaba_cloud_client,
    make_alibaba_cloud_request_openai,
    process_alibaba_cloud_response,
    make_alibaba_cloud_request_openai_stream,
    validate_stream_chunk,
)
import logging

router = APIRouter(prefix="/debug/alibaba", tags=["Debug - Alibaba"])
logger = logging.getLogger(__name__)


@router.get("/status")
async def alibaba_status():
    """Check Alibaba Cloud integration status"""
    try:
        client = get_alibaba_cloud_client()
        return {
            "status": "ok",
            "message": "Alibaba Cloud client initialized successfully",
            "base_url": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
            "available": True,
        }
    except Exception as e:
        logger.error(f"Alibaba status check failed: {e}")
        return {
            "status": "error",
            "message": str(e),
            "error_type": type(e).__name__,
            "available": False,
        }


@router.post("/test-chat")
async def test_alibaba_chat(api_key: str = Depends(get_api_key)):
    """Test a simple Alibaba Cloud chat request (non-streaming)

    Example response:
    {
        "status": "ok",
        "model": "qwen-flash",
        "response": {
            "id": "...",
            "choices": [{"message": {"content": "..."}}]
        }
    }
    """
    try:
        logger.info("Testing Alibaba Cloud non-streaming request")
        response = make_alibaba_cloud_request_openai(
            messages=[{"role": "user", "content": "Hello, what is 2+2?"}],
            model="qwen-flash",
        )
        processed = process_alibaba_cloud_response(response)
        logger.info(f"Non-streaming test successful")
        return {
            "status": "ok",
            "model": "qwen-flash",
            "response": processed,
        }
    except Exception as e:
        logger.error(f"Alibaba test chat failed: {e}", exc_info=True)
        return {
            "status": "error",
            "message": str(e),
            "error_type": type(e).__name__,
        }


@router.post("/test-stream")
async def test_alibaba_stream(api_key: str = Depends(get_api_key)):
    """Test Alibaba Cloud streaming

    Example response:
    {
        "status": "ok",
        "total_chunks_sampled": 5,
        "chunks": [
            {"chunk_num": 1, "valid": true, "has_choices": true, ...}
        ]
    }
    """
    try:
        logger.info("Testing Alibaba Cloud streaming request")
        stream = make_alibaba_cloud_request_openai_stream(
            messages=[{"role": "user", "content": "Say 'hello' in 3 different languages"}],
            model="qwen-flash",
        )

        chunks = []
        chunk_count = 0
        for chunk in stream:
            chunk_count += 1
            is_valid = validate_stream_chunk(chunk)
            chunks.append(
                {
                    "chunk_num": chunk_count,
                    "valid": is_valid,
                    "has_choices": hasattr(chunk, "choices"),
                    "choices_count": len(chunk.choices) if hasattr(chunk, "choices") else 0,
                }
            )

            if chunk_count >= 5:  # Limit to first 5 chunks for testing
                break

        logger.info(f"Streaming test successful: {chunk_count} chunks sampled")
        return {
            "status": "ok",
            "total_chunks_sampled": chunk_count,
            "chunks": chunks,
        }
    except Exception as e:
        logger.error(f"Alibaba stream test failed: {e}", exc_info=True)
        return {
            "status": "error",
            "message": str(e),
            "error_type": type(e).__name__,
        }


@router.get("/models")
async def alibaba_models():
    """List supported Alibaba/Qwen models"""
    return {
        "provider": "alibaba-cloud",
        "models": {
            "commercial": {
                "qwen-flash": {"context": "1M", "pricing_per_1m": "$0.001/$0.003"},
                "qwen-plus": {"context": "1M", "pricing_per_1m": "$0.005/$0.015"},
                "qwen-max": {"context": "262K", "pricing_per_1m": "$0.012/$0.036"},
                "qwen-coder": {"context": "262K", "pricing_per_1m": "$0.008/$0.024"},
                "qwen-long": {"context": "10M", "pricing_per_1m": "$0.001/$0.003"},
            },
            "reasoning": {
                "qwq-plus": {"context": "262K", "pricing_per_1m": "$0.020/$0.060"},
                "qwq-32b-preview": {"context": "262K", "pricing_per_1m": "custom"},
            },
            "specialized": {
                "qwen-omni": {"type": "multimodal"},
                "qwen-vl": {"type": "vision"},
                "qwen-math": {"type": "mathematics"},
                "qwen-mt": {"type": "translation"},
            },
        },
    }
