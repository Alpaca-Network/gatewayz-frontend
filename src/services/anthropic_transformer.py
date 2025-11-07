"""
Anthropic Messages API Transformer
Converts between Anthropic Messages API format and OpenAI Chat Completions format
"""

import time
from typing import Any


def transform_anthropic_to_openai(
    messages: list[dict[str, Any]],
    system: str | None = None,
    max_tokens: int = 950,
    temperature: float | None = None,
    top_p: float | None = None,
    top_k: int | None = None,
    stop_sequences: list[str] | None = None,
    tools: list[dict[str, Any]] | None = None,
    tool_choice: str | dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """
    Transform Anthropic Messages API request to OpenAI Chat Completions format.

    Args:
        messages: List of Anthropic message objects
        system: System prompt (Anthropic puts this separately)
        max_tokens: Max tokens to generate (required in Anthropic)
        temperature: Temperature parameter
        top_p: Top-p parameter
        top_k: Top-k parameter (Anthropic-specific, ignored)
        stop_sequences: Stop sequences (maps to 'stop' in OpenAI)
        tools: Tool/function definitions for function calling
        tool_choice: Tool selection strategy ("auto", "required", or specific tool)

    Returns:
        Tuple of (openai_messages, openai_params)
    """
    openai_messages = []

    # Add system message if provided (Anthropic separates this)
    if system:
        openai_messages.append({"role": "system", "content": system})

    # Transform messages
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content")

        openai_msg = {"role": role}

        # Handle content (can be string or array of content blocks)
        if isinstance(content, str):
            openai_msg["content"] = content
        elif isinstance(content, list):
            # Content blocks
            content_parts = []
            for block in content:
                if isinstance(block, dict):
                    block_type = block.get("type")

                    if block_type == "text":
                        content_parts.append({"type": "text", "text": block.get("text", "")})
                    elif block_type == "image":
                        # Transform image block
                        source = block.get("source", {})
                        if source.get("type") == "base64":
                            content_parts.append(
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:{source.get('media_type', 'image/jpeg')};base64,{source.get('data', '')}"
                                    },
                                }
                            )
                        elif source.get("type") == "url":
                            content_parts.append(
                                {"type": "image_url", "image_url": {"url": source.get("url", "")}}
                            )
                    else:
                        # Pass through unknown types
                        content_parts.append(block)

            # Use array if multiple parts, otherwise extract single part
            if len(content_parts) > 1:
                openai_msg["content"] = content_parts
            elif len(content_parts) == 1:
                # For single text block, use string for better compatibility
                if content_parts[0].get("type") == "text":
                    openai_msg["content"] = content_parts[0].get("text", "")
                else:
                    openai_msg["content"] = content_parts
            else:
                openai_msg["content"] = ""
        else:
            openai_msg["content"] = str(content) if content is not None else ""

        openai_messages.append(openai_msg)

    # Build optional parameters
    openai_params = {"max_tokens": max_tokens}

    if temperature is not None:
        openai_params["temperature"] = temperature
    if top_p is not None:
        openai_params["top_p"] = top_p
    if stop_sequences:
        openai_params["stop"] = stop_sequences
    if tools:
        openai_params["tools"] = tools
    if tool_choice:
        openai_params["tool_choice"] = tool_choice

    # Note: top_k is Anthropic-specific and not supported in OpenAI
    # We log it but don't pass it through
    if top_k is not None:
        import logging

        logger = logging.getLogger(__name__)
        logger.debug(f"top_k parameter ({top_k}) is Anthropic-specific and will be ignored")

    return openai_messages, openai_params


def transform_openai_to_anthropic(
    openai_response: dict[str, Any],
    model: str,
) -> dict[str, Any]:
    """
    Transform OpenAI Chat Completions response to Anthropic Messages API format.

    Args:
        openai_response: OpenAI chat completion response
        model: Model name to include in response

    Returns:
        Anthropic Messages API response
    """
    # Extract data from OpenAI response
    choice = openai_response.get("choices", [{}])[0]
    message = choice.get("message", {})
    content = message.get("content", "")
    finish_reason = choice.get("finish_reason", "stop")

    usage = openai_response.get("usage", {})
    prompt_tokens = usage.get("prompt_tokens", 0)
    completion_tokens = usage.get("completion_tokens", 0)

    # Map OpenAI finish_reason to Anthropic stop_reason
    stop_reason_map = {
        "stop": "end_turn",
        "length": "max_tokens",
        "content_filter": "stop_sequence",  # Map content filter to stop_sequence
        "tool_calls": "tool_use",
        "function_call": "tool_use",
    }
    stop_reason = stop_reason_map.get(finish_reason, "end_turn")

    # Build Anthropic-style response
    anthropic_response = {
        "id": openai_response.get("id", f"msg-{int(time.time())}"),
        "type": "message",
        "role": "assistant",
        "content": [{"type": "text", "text": content}],
        "model": openai_response.get("model", model),
        "stop_reason": stop_reason,
        "stop_sequence": None,  # Would be populated if stopped by stop sequence
        "usage": {"input_tokens": prompt_tokens, "output_tokens": completion_tokens},
    }

    # Preserve gateway usage if present
    if "gateway_usage" in openai_response:
        anthropic_response["gateway_usage"] = openai_response["gateway_usage"]

    return anthropic_response


def extract_text_from_content(content: str | list[dict[str, Any]]) -> str:
    """
    Extract plain text from Anthropic content (string or content blocks).

    Args:
        content: Content string or array of content blocks

    Returns:
        Plain text string
    """
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        text_parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                text_parts.append(block.get("text", ""))
        return " ".join(text_parts) if text_parts else "[multimodal content]"

    return str(content) if content is not None else ""
