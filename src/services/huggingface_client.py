import json
import logging
from types import SimpleNamespace
from typing import Any, Dict, Generator, List

import httpx

from src.config import Config

# Initialize logging
logger = logging.getLogger(__name__)

# Hugging Face Inference Router base URL
HF_INFERENCE_BASE_URL = "https://router.huggingface.co/v1"

ALLOWED_PARAMS = {
    "max_tokens",
    "temperature",
    "top_p",
    "frequency_penalty",
    "presence_penalty",
    "response_format",
}


class HFStreamChoice:
    """Lightweight structure that mimics OpenAI stream choice objects."""

    def __init__(self, data: Dict[str, Any]):
        self.index = data.get("index", 0)
        self.delta = SimpleNamespace(**(data.get("delta") or {}))
        self.message = (
            SimpleNamespace(**data["message"]) if data.get("message") else None
        )
        self.finish_reason = data.get("finish_reason")


class HFStreamChunk:
    """Stream chunk compatible with OpenAI client chunks."""

    def __init__(self, payload: Dict[str, Any]):
        self.id = payload.get("id")
        self.object = payload.get("object")
        self.created = payload.get("created")
        self.model = payload.get("model")
        self.choices = [HFStreamChoice(choice) for choice in payload.get("choices", [])]

        usage = payload.get("usage")
        if usage:
            self.usage = SimpleNamespace(
                prompt_tokens=usage.get("prompt_tokens", 0),
                completion_tokens=usage.get("completion_tokens", 0),
                total_tokens=usage.get("total_tokens", 0),
            )
        else:
            self.usage = None


def get_huggingface_client() -> httpx.Client:
    """Create an HTTPX client for the Hugging Face Router API."""
    if not Config.HUG_API_KEY:
        raise ValueError("Hugging Face API key (HUG_API_KEY) not configured")

    headers = {
        "Authorization": f"Bearer {Config.HUG_API_KEY}",
        "Content-Type": "application/json",
    }

    return httpx.Client(base_url=HF_INFERENCE_BASE_URL, headers=headers, timeout=60.0)


def _prepare_model(model: str) -> str:
    if model.endswith(":hf-inference"):
        return model
    return f"{model}:hf-inference"


def _build_payload(messages: List[Dict[str, Any]], model: str, **kwargs) -> Dict[str, Any]:
    payload = {
        "messages": messages,
        "model": _prepare_model(model),
    }

    for key, value in kwargs.items():
        if key in ALLOWED_PARAMS and value is not None:
            payload[key] = value

    return payload


def make_huggingface_request_openai(messages, model, **kwargs):
    """Make request to Hugging Face Router using OpenAI-compatible schema."""
    client = get_huggingface_client()
    try:
        payload = _build_payload(messages, model, **kwargs)
        logger.info(f"Making Hugging Face request with model: {payload['model']}")
        logger.debug(
            "HF request payload (non-streaming): message_count=%s, payload_keys=%s",
            len(messages),
            list(payload.keys()),
        )

        response = client.post("/chat/completions", json=payload)
        response.raise_for_status()
        logger.info("Hugging Face request successful for model: %s", payload["model"])
        return response.json()
    except Exception as e:
        logger.error("Hugging Face request failed for model '%s': %s", model, e)
        raise
    finally:
        client.close()


def make_huggingface_request_openai_stream(
    messages, model, **kwargs
) -> Generator[HFStreamChunk, None, None]:
    """Stream responses from Hugging Face Router using SSE."""
    client = get_huggingface_client()
    payload = _build_payload(messages, model, **kwargs)
    payload["stream"] = True

    logger.info("Making Hugging Face streaming request with model: %s", payload["model"])
    logger.debug(
        "HF streaming request payload: message_count=%s, payload_keys=%s",
        len(messages),
        list(payload.keys()),
    )

    try:
        with client.stream("POST", "/chat/completions", json=payload) as response:
            response.raise_for_status()
            logger.info(
                "Hugging Face streaming request initiated for model: %s",
                payload["model"],
            )

            for raw_line in response.iter_lines():
                if not raw_line:
                    continue
                if raw_line.startswith("data: "):
                    data = raw_line[6:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk_payload = json.loads(data)
                        yield HFStreamChunk(chunk_payload)
                    except json.JSONDecodeError as err:
                        logger.warning("Failed to decode Hugging Face stream chunk: %s", err)
                        continue
    except Exception as e:
        logger.error(
            "Hugging Face streaming request failed for model '%s': %s", model, e
        )
        raise
    finally:
        client.close()


def process_huggingface_response(response):
    """Process Hugging Face response (dict) to OpenAI-compatible structure."""
    try:
        if not isinstance(response, dict):
            raise TypeError("Hugging Face response must be a dictionary")

        choices = []
        for choice in response.get("choices", []):
            message = choice.get("message") or {}
            choices.append(
                {
                    "index": choice.get("index", 0),
                    "message": {
                        "role": message.get("role", "assistant"),
                        "content": message.get("content", ""),
                    },
                    "finish_reason": choice.get("finish_reason"),
                }
            )

        usage = response.get("usage") or {}
        processed = {
            "id": response.get("id"),
            "object": response.get("object", "chat.completion"),
            "created": response.get("created"),
            "model": response.get("model"),
            "choices": choices,
            "usage": {
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
            },
        }
        return processed
    except Exception as e:
        logger.error("Failed to process Hugging Face response: %s", e)
        raise
