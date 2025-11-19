"""
Anthropic Messages API Transformer
Converts between Anthropic Messages API format and OpenAI Chat Completions format
"""

import json
import time
from typing import Any, Dict, List, Optional, Union


def extract_message_with_tools(choice_message: Any) -> Dict[str, Any]:
    """
    Extract message data including role, content, and any tool calls or function calls.

    This is a shared utility function used by all provider response processors to
    reduce code duplication when extracting message data from OpenAI-compatible responses.

    Handles both object-based messages (with attributes) and dict-based messages.

    Args:
        choice_message: The message object/dict from a choice in the response

    Returns:
        Dictionary with role, content, and optionally tool_calls/function_call
    """
    # Extract basic message data
    if isinstance(choice_message, dict):
        role = choice_message.get("role", "assistant")
        content = choice_message.get("content", "")
        tool_calls = choice_message.get("tool_calls")
        function_call = choice_message.get("function_call")
    else:
        role = choice_message.role
        content = choice_message.content
        tool_calls = getattr(choice_message, "tool_calls", None)
        function_call = getattr(choice_message, "function_call", None)

    # Build message dict with available fields
    msg = {"role": role, "content": content}
    if tool_calls:
        msg["tool_calls"] = tool_calls
    if function_call:
        msg["function_call"] = function_call

    return msg


def transform_anthropic_to_openai(
    messages: List[Dict[str, Any]],
    system: Optional[str] = None,
    max_tokens: int = 950,
    temperature: Optional[float] = None,
    top_p: Optional[float] = None,
    top_k: Optional[int] = None,
    stop_sequences: Optional[List[str]] = None,
    tools: Optional[List[dict]] = None,
    tool_choice: Optional[Any] = None,
) -> tuple:
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
    openai_response: Dict[str, Any],
    model: str,
) -> Dict[str, Any]:
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

    # Build content array for Anthropic response
    content_blocks = []

    # Check for tool_calls first (they take priority when present)
    tool_calls = message.get("tool_calls")
    has_tool_calls = tool_calls and len(tool_calls) > 0

    # Handle tool_calls from OpenAI format (convert to Anthropic tool_use blocks)
    if has_tool_calls:
        for tool_call in tool_calls:
            # Extract tool information
            tool_name = tool_call.get("function", {}).get("name", "tool")
            tool_args = tool_call.get("function", {}).get("arguments", "{}")
            tool_id = tool_call.get("id", f"tool-{int(time.time())}")

            # Parse arguments if they're a string
            if isinstance(tool_args, str):
                try:
                    tool_args = json.loads(tool_args)
                except (json.JSONDecodeError, TypeError):
                    tool_args = {}

            # Add tool_use content block in Anthropic format
            content_blocks.append(
                {
                    "type": "tool_use",
                    "id": tool_id,
                    "name": tool_name,
                    "input": tool_args,
                }
            )

    # Add text content if present and non-empty (only if no tool_calls or in addition to them)
    # When tool_calls are present, content is typically None/empty, but we still check
    if content and isinstance(content, str) and content.strip():
        content_blocks.append({"type": "text", "text": content})

    # If no content blocks were created, add empty text block
    if not content_blocks:
        content_blocks.append({"type": "text", "text": ""})

    # Build Anthropic-style response
    anthropic_response = {
        "id": openai_response.get("id", f"msg-{int(time.time())}"),
        "type": "message",
        "role": "assistant",
        "content": content_blocks,
        "model": openai_response.get("model", model),
        "stop_reason": stop_reason,
        "stop_sequence": None,  # Would be populated if stopped by stop sequence
        "usage": {"input_tokens": prompt_tokens, "output_tokens": completion_tokens},
    }

    # Preserve gateway usage if present
    if "gateway_usage" in openai_response:
        anthropic_response["gateway_usage"] = openai_response["gateway_usage"]

    return anthropic_response


def extract_text_from_content(content: Union[str, List[Dict[str, Any]]]) -> str:
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
