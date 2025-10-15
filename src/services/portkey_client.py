import logging
from typing import Optional

from fastapi import APIRouter
from openai import OpenAI

from src.config import Config


logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

router = APIRouter()

PORTKEY_BASE_URL = "https://api.portkey.ai/v1"


def _resolve_portkey_slug(provider: Optional[str], override: Optional[str]) -> Optional[str]:
    slug = override or Config.get_portkey_virtual_key(provider)
    if slug:
        return slug.lstrip("@")
    if provider:
        return provider.lstrip("@")
    return None


def _format_portkey_model(model: str, slug: Optional[str]) -> str:
    if not model:
        raise ValueError("Model name is required for Portkey requests")

    trimmed = model.strip()
    if not trimmed:
        raise ValueError("Model name is required for Portkey requests")

    # Already namespaced
    if trimmed.startswith("@"):
        return trimmed

    if "/" in trimmed:
        prefix, _ = trimmed.split("/", 1)
        if prefix.startswith("@"):
            return trimmed
        if slug and prefix == slug:
            return f"@{trimmed}"
        # Assume caller supplied provider slug without '@'
        return f"@{trimmed}"

    if slug:
        return f"@{slug}/{trimmed}"

    # Fallback: return raw model, Portkey will attempt to resolve default
    return trimmed


def get_portkey_client(provider: Optional[str] = None, virtual_key: Optional[str] = None) -> OpenAI:
    if not Config.PORTKEY_API_KEY:
        raise ValueError("Portkey API key not configured")

    headers = {
        "x-portkey-api-key": Config.PORTKEY_API_KEY,
    }

    resolved_virtual_key = virtual_key or Config.get_portkey_virtual_key(provider)
    if resolved_virtual_key:
        headers["x-portkey-virtual-key"] = resolved_virtual_key

    if provider:
        headers["x-portkey-provider"] = provider

    return OpenAI(
        base_url=PORTKEY_BASE_URL,
        api_key=Config.PORTKEY_API_KEY,
        default_headers=headers,
    )


def make_portkey_request_openai(messages, model, provider: Optional[str] = None, virtual_key: Optional[str] = None, **kwargs):
    try:
        resolved_slug = _resolve_portkey_slug(provider, virtual_key)
        formatted_model = _format_portkey_model(model, resolved_slug)

        client = get_portkey_client(provider, virtual_key)
        response = client.chat.completions.create(
            model=formatted_model,
            messages=messages,
            **kwargs,
        )
        return response
    except Exception as exc:
        logger.error(f"Portkey request failed: {exc}")
        raise


def make_portkey_request_openai_stream(messages, model, provider: Optional[str] = None, virtual_key: Optional[str] = None, **kwargs):
    try:
        resolved_slug = _resolve_portkey_slug(provider, virtual_key)
        formatted_model = _format_portkey_model(model, resolved_slug)

        client = get_portkey_client(provider, virtual_key)
        stream = client.chat.completions.create(
            model=formatted_model,
            messages=messages,
            stream=True,
            **kwargs,
        )
        return stream
    except Exception as exc:
        logger.error(f"Portkey streaming request failed: {exc}")
        raise


def process_portkey_response(response):
    try:
        return {
            "id": response.id,
            "object": response.object,
            "created": response.created,
            "model": response.model,
            "choices": [
                {
                    "index": choice.index,
                    "message": {
                        "role": choice.message.role,
                        "content": choice.message.content,
                    },
                    "finish_reason": choice.finish_reason,
                }
                for choice in response.choices
            ],
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            }
            if response.usage
            else {},
        }
    except Exception as exc:
        logger.error(f"Failed to process Portkey response: {exc}")
        raise
