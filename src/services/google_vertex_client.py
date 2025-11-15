"""Google Vertex AI API client for chat completions

This module provides integration with Google Vertex AI generative models
using the Vertex AI SDK with Application Default Credentials (ADC).

Authentication uses Google Application Default Credentials (ADC):
- Automatically discovers credentials from environment (GOOGLE_APPLICATION_CREDENTIALS)
- No manual JWT exchange required
- Supports service account JSON files
- Works in serverless environments (Vercel, Railway)
- Recommended by Google for production use

The library will automatically find credentials from:
1. GOOGLE_APPLICATION_CREDENTIALS environment variable (path to JSON file)
2. GOOGLE_VERTEX_CREDENTIALS_JSON environment variable (raw JSON, written to temp file)
3. Application Default Credentials (gcloud auth, GCE metadata server, etc.)

Deployment Note: This implementation was updated to use ADC in PR #252.
"""

import json
import logging
import os
import tempfile
import time
from collections.abc import Iterator
from typing import Any, Optional

from src.config import Config

# Initialize logging
logger = logging.getLogger(__name__)

# Lazy imports for Google Vertex AI SDK to prevent import errors in environments
# where libstdc++.so.6 is not available. These will be imported only when needed.
_vertexai = None
_GenerativeModel = None
_MessageToDict = None

def _ensure_vertex_imports():
    """Ensure Vertex AI SDK is imported. Raises ImportError if SDK not available."""
    global _vertexai, _GenerativeModel
    if _vertexai is None:
        try:
            import vertexai
            from vertexai.generative_models import GenerativeModel
            _vertexai = vertexai
            _GenerativeModel = GenerativeModel
            logger.debug("Successfully imported Vertex AI SDK")
        except ImportError as e:
            raise ImportError(
                f"Google Vertex AI SDK is not available: {e}. "
                "This is typically due to missing system dependencies (libstdc++.so.6). "
                "Ensure the environment has the required C++ runtime libraries."
            ) from e
    return _vertexai, _GenerativeModel


def _ensure_protobuf_imports():
    """Ensure protobuf utilities are imported. Raises ImportError if not available."""
    global _MessageToDict
    if _MessageToDict is None:
        try:
            from google.protobuf.json_format import MessageToDict
            _MessageToDict = MessageToDict
            logger.debug("Successfully imported MessageToDict from protobuf")
        except ImportError as e:
            raise ImportError(
                f"protobuf utilities are not available: {e}. "
                "This is typically due to missing system dependencies."
            ) from e
    return _MessageToDict


def initialize_vertex_ai():
    """Initialize Vertex AI using Application Default Credentials (ADC)

    This function initializes Vertex AI with your project and location.
    It does NOT pass explicit credentials - the library will automatically
    discover them from the environment.

    The library finds credentials in this order:
    1. GOOGLE_APPLICATION_CREDENTIALS environment variable (path to JSON)
    2. Application Default Credentials (ADC) from gcloud, metadata server, etc.
    3. If GOOGLE_VERTEX_CREDENTIALS_JSON is set (raw JSON), we'll write it to a temp file
       and set GOOGLE_APPLICATION_CREDENTIALS to point to it

    Raises:
        ValueError: If project_id or location is not configured
    """
    try:
        logger.info("Initializing Vertex AI with Application Default Credentials")

        # Validate configuration
        if not Config.GOOGLE_PROJECT_ID:
            raise ValueError(
                "GOOGLE_PROJECT_ID is not configured. Set this environment variable to your GCP project ID. "
                "For example: GOOGLE_PROJECT_ID=my-project-123"
            )

        if not Config.GOOGLE_VERTEX_LOCATION:
            raise ValueError(
                "GOOGLE_VERTEX_LOCATION is not configured. Set this to a valid GCP region. "
                "For example: GOOGLE_VERTEX_LOCATION=us-central1"
            )

        # Ensure Vertex AI SDK is available
        vertexai, _ = _ensure_vertex_imports()

        # Handle GOOGLE_VERTEX_CREDENTIALS_JSON if provided (for serverless environments)
        # If raw JSON is provided, write it to a temp file and set GOOGLE_APPLICATION_CREDENTIALS
        if os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON") and not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            logger.info("GOOGLE_VERTEX_CREDENTIALS_JSON detected - writing to temp file for ADC")
            try:
                creds_json = os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")

                # Create a temporary file that persists for the application lifetime
                temp_creds_file = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
                temp_creds_file.write(creds_json)
                temp_creds_file.close()

                # Set GOOGLE_APPLICATION_CREDENTIALS to point to the temp file
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = temp_creds_file.name
                logger.info(f"Wrote credentials to temp file: {temp_creds_file.name}")
            except Exception as e:
                logger.warning(f"Failed to write GOOGLE_VERTEX_CREDENTIALS_JSON to temp file: {e}")

        # Initialize Vertex AI - DO NOT pass credentials parameter
        # The library will automatically find them from the environment
        vertexai.init(
            project=Config.GOOGLE_PROJECT_ID,
            location=Config.GOOGLE_VERTEX_LOCATION
        )

        logger.info(f"✓ Successfully initialized Vertex AI for project: {Config.GOOGLE_PROJECT_ID}")

    except Exception as e:
        error_msg = f"Failed to initialize Vertex AI: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise ValueError(error_msg) from e


def transform_google_vertex_model_id(model_id: str) -> str:
    """Transform model ID to Google Vertex AI format

    For the REST API, we just need the model name (e.g., 'gemini-2.5-flash-lite').
    The full URL path is constructed in the API call functions.

    Args:
        model_id: Model identifier (e.g., 'gemini-2.0-flash', 'gemini-1.5-pro')

    Returns:
        Simple model name (e.g., 'gemini-2.5-flash-lite')
    """
    # If already in full format, extract the model name
    if model_id.startswith("projects/"):
        # Extract model name from projects/.../models/{model}
        return model_id.split("/models/")[-1]

    # Otherwise, return as-is
    return model_id


def make_google_vertex_request_openai(
    messages: list,
    model: str,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
    top_p: Optional[float] = None,
    **kwargs,
) -> dict:
    """Make request to Google Vertex AI using the Vertex AI SDK with ADC

    Converts OpenAI-compatible parameters to Google Vertex AI Gemini format
    and returns a normalized response.

    Args:
        messages: List of message objects in OpenAI format
        model: Model name to use
        max_tokens: Maximum tokens to generate
        temperature: Sampling temperature (0-2)
        top_p: Nucleus sampling parameter
        **kwargs: Additional parameters (ignored for compatibility)

    Returns:
        OpenAI-compatible response object
    """
    try:
        logger.info(f"Making Google Vertex request for model: {model}")

        # Step 1: Initialize Vertex AI (will use ADC)
        try:
            initialize_vertex_ai()
        except Exception as init_error:
            logger.error(f"Failed to initialize Vertex AI: {init_error}", exc_info=True)
            raise

        # Step 2: Transform model ID
        try:
            model_name = transform_google_vertex_model_id(model)
            logger.info(f"Using model name: {model_name}")
        except Exception as transform_error:
            logger.error(f"Failed to transform model ID: {transform_error}", exc_info=True)
            raise

        # Step 3: Create GenerativeModel instance
        try:
            _, GenerativeModel = _ensure_vertex_imports()
            gemini_model = GenerativeModel(model_name)
            logger.info(f"Created GenerativeModel for {model_name}")
        except Exception as model_error:
            logger.error(f"Failed to create GenerativeModel: {model_error}", exc_info=True)
            raise

        # Step 4: Build generation config
        try:
            generation_config = {}
            if max_tokens is not None:
                generation_config["max_output_tokens"] = max_tokens
            if temperature is not None:
                generation_config["temperature"] = temperature
            if top_p is not None:
                generation_config["top_p"] = top_p
            logger.debug(f"Generation config: {generation_config}")
        except Exception as config_error:
            logger.error(f"Failed to build generation config: {config_error}", exc_info=True)
            raise

        # Step 5: Extract tools from kwargs (if provided)
        tools = kwargs.get("tools")
        if tools:
            logger.info(f"Tools parameter detected: {len(tools) if isinstance(tools, list) else 0} tools")
            logger.warning(
                "Google Vertex AI function calling support requires transformation from OpenAI format to Gemini format. "
                "Currently, tools are extracted but not yet transformed. Function calling may not work correctly."
            )
            # TODO: Transform OpenAI tools format to Gemini function calling format
            # Gemini uses a different schema: tools need to be converted to FunctionDeclaration format
            # See: https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini#function_calling

        # Step 6: Convert messages to Vertex AI format
        try:
            # Extract the last user message as the prompt
            # For simplicity, we'll combine all messages into a single prompt
            prompt_parts = []
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "system":
                    prompt_parts.append(f"System: {content}")
                elif role == "user":
                    prompt_parts.append(f"User: {content}")
                elif role == "assistant":
                    prompt_parts.append(f"Assistant: {content}")

            prompt = "\n\n".join(prompt_parts)
            logger.debug(f"Built prompt with {len(messages)} messages")
        except Exception as content_error:
            logger.error(f"Failed to build prompt: {content_error}", exc_info=True)
            raise

        # Step 7: Make the API call
        try:
            logger.info("Calling GenerativeModel.generate_content()")
            response = gemini_model.generate_content(
                prompt,
                generation_config=generation_config if generation_config else None
            )
            logger.info("Received response from Vertex AI")
            logger.debug(f"Response: {response}")
        except Exception as api_error:
            logger.error(f"Vertex AI API call failed: {api_error}", exc_info=True)
            raise

        # Step 8: Process and normalize response
        try:
            processed_response = _process_google_vertex_sdk_response(response, model)
            logger.info("Successfully processed Vertex AI response")
            return processed_response
        except Exception as process_error:
            logger.error(f"Failed to process Vertex AI response: {process_error}", exc_info=True)
            raise

    except Exception as e:
        logger.error(f"Google Vertex AI request failed: {e}", exc_info=True)
        raise


def _process_google_vertex_sdk_response(response: Any, model: str) -> dict:
    """Process Google Vertex AI SDK response to OpenAI-compatible format

    Args:
        response: Response from GenerativeModel.generate_content()
        model: Model name used

    Returns:
        OpenAI-compatible response dictionary
    """
    try:
        logger.debug(f"Processing SDK response: {response}")

        # Extract text from the response
        text_content = response.text if hasattr(response, 'text') else ""
        logger.info(f"Extracted text content length: {len(text_content)} characters")

        # Extract usage metadata if available
        prompt_tokens = 0
        completion_tokens = 0
        if hasattr(response, 'usage_metadata'):
            usage = response.usage_metadata
            prompt_tokens = getattr(usage, 'prompt_token_count', 0)
            completion_tokens = getattr(usage, 'candidates_token_count', 0)

        # Extract finish reason
        finish_reason = "stop"  # Default
        if hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'finish_reason'):
                finish_reason_value = candidate.finish_reason
                # Map Vertex AI finish reasons to OpenAI format
                finish_reason_map = {
                    1: "stop",  # STOP
                    2: "length",  # MAX_TOKENS
                    3: "content_filter",  # SAFETY
                    4: "stop",  # RECITATION
                    0: "unknown",  # FINISH_REASON_UNSPECIFIED
                }
                finish_reason = finish_reason_map.get(finish_reason_value, "stop")

        return {
            "id": f"vertex-{int(time.time() * 1000)}",
            "object": "text_completion",
            "created": int(time.time()),
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": text_content
                    },
                    "finish_reason": finish_reason,
                }
            ],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
        }

    except Exception as e:
        logger.error(f"Failed to process Google Vertex AI SDK response: {e}", exc_info=True)
        raise


def make_google_vertex_request_openai_stream(
    messages: list,
    model: str,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
    top_p: Optional[float] = None,
    **kwargs,
) -> Iterator[str]:
    """Make streaming request to Google Vertex AI

    NOTE: For compatibility, this implementation gets the full response
    and returns it in OpenAI SSE streaming format.

    Args:
        messages: List of message objects in OpenAI format
        model: Model name to use
        max_tokens: Maximum tokens to generate
        temperature: Sampling temperature
        top_p: Nucleus sampling parameter
        **kwargs: Additional parameters

    Yields:
        SSE-formatted stream chunks
    """
    try:
        logger.info(f"Starting streaming request for model {model}")
        # Get non-streaming response
        response = make_google_vertex_request_openai(
            messages=messages,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            **kwargs,
        )

        logger.info(f"Received response: {json.dumps(response, indent=2, default=str)}")

        # Extract content safely
        choices = response.get("choices", [])
        if not choices:
            logger.error(f"No choices in response: {response}")
            raise ValueError("No choices in response")

        content = choices[0].get("message", {}).get("content", "")
        finish_reason = choices[0].get("finish_reason", "stop")

        logger.info(f"Content length: {len(content)}, finish_reason: {finish_reason}")

        # Convert to streaming format by yielding complete response as single chunk
        # This maintains compatibility with streaming clients
        chunk = {
            "id": response.get("id"),
            "object": "text_completion.chunk",
            "created": response.get("created"),
            "model": response.get("model"),
            "choices": [
                {
                    "index": 0,
                    "delta": {"role": "assistant", "content": content},
                    "finish_reason": None,
                }
            ],
        }

        logger.debug(f"Yielding chunk: {json.dumps(chunk, indent=2, default=str)}")
        yield f"data: {json.dumps(chunk)}\n\n"

        # Final chunk with finish_reason
        finish_chunk = {
            "id": response.get("id"),
            "object": "text_completion.chunk",
            "created": response.get("created"),
            "model": response.get("model"),
            "choices": [{"index": 0, "delta": {"content": None}, "finish_reason": finish_reason}],
        }

        logger.debug(f"Yielding finish chunk: {json.dumps(finish_chunk, indent=2, default=str)}")
        yield f"data: {json.dumps(finish_chunk)}\n\n"
        yield "data: [DONE]\n\n"

    except Exception as e:
        logger.error(f"Google Vertex AI streaming request failed: {e}", exc_info=True)
        raise


def _build_vertex_content(messages: list) -> list:
    """Convert OpenAI message format to Google Vertex AI content format

    Args:
        messages: List of OpenAI-format messages

    Returns:
        List of content objects in Vertex AI format
    """
    contents = []

    for message in messages:
        role = message.get("role", "user")
        content = message.get("content", "")

        # Map OpenAI roles to Vertex AI roles
        vertex_role = "user" if role == "user" else "model"

        # Handle content as string or list (for multimodal)
        if isinstance(content, str):
            parts = [{"text": content}]
        elif isinstance(content, list):
            parts = []
            for item in content:
                if item.get("type") == "text":
                    parts.append({"text": item.get("text", "")})
                elif item.get("type") == "image_url":
                    # Vertex AI supports inline base64 or URLs
                    image_url = item.get("image_url", {}).get("url", "")
                    if image_url.startswith("data:"):
                        # Base64 encoded image
                        parts.append(
                            {"inline_data": {"mime_type": "image/jpeg", "data": image_url}}
                        )
                    else:
                        # URL reference
                        parts.append(
                            {"file_data": {"mime_type": "image/jpeg", "file_uri": image_url}}
                        )
        else:
            parts = [{"text": str(content)}]

        contents.append({"role": vertex_role, "parts": parts})

    return contents


def _normalize_vertex_candidate_to_openai(candidate: dict, model: str) -> dict:
    """Convert a Vertex AI candidate to OpenAI-compatible format
    
    This shared helper function normalizes response data from both protobuf 
    and REST API formats to avoid code duplication.
    
    Args:
        candidate: Candidate object from Vertex AI response
        model: Model name used
        
    Returns:
        OpenAI-compatible response dictionary
    """
    logger.debug(f"Normalizing candidate: {json.dumps(candidate, indent=2, default=str)}")
    
    # Extract content from candidate
    content_parts = candidate.get("content", {}).get("parts", [])
    logger.debug(f"Content parts count: {len(content_parts)}")
    
    # Extract text from parts
    text_content = ""
    tool_calls = []
    for part in content_parts:
        if "text" in part:
            text_content += part["text"]
        # Check for tool use in parts (function calling)
        if "functionCall" in part:
            tool_call = part["functionCall"]
            tool_calls.append({
                "id": f"call_{int(time.time() * 1000)}",
                "type": "function",
                "function": {
                    "name": tool_call.get("name", "unknown"),
                    "arguments": json.dumps(tool_call.get("args", {}))
                }
            })

    logger.info(f"Extracted text content length: {len(text_content)} characters")

    # Warn if content is empty
    if not text_content and not tool_calls:
        logger.warning(
            f"Received empty text content from Vertex AI for model {model}. Candidate: {json.dumps(candidate, default=str)}"
        )

    # Extract usage information
    usage_metadata = candidate.get("usageMetadata", {})
    prompt_tokens = int(usage_metadata.get("promptTokenCount", 0))
    completion_tokens = int(usage_metadata.get("candidatesTokenCount", 0))

    finish_reason = candidate.get("finishReason", "STOP")
    finish_reason_map = {
        "STOP": "stop",
        "MAX_TOKENS": "length",
        "SAFETY": "content_filter",
        "RECITATION": "stop",
        "FINISH_REASON_UNSPECIFIED": "unknown",
    }

    # Build message with content and tool_calls if present
    message = {"role": "assistant", "content": text_content}
    if tool_calls:
        message["tool_calls"] = tool_calls

    return {
        "id": f"vertex-{int(time.time() * 1000)}",
        "object": "text_completion",
        "created": int(time.time()),
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": message,
                "finish_reason": finish_reason_map.get(finish_reason, "stop"),
            }
        ],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        },
    }


def _process_google_vertex_response(response: Any, model: str) -> dict:
    """Process Google Vertex AI response to OpenAI-compatible format

    Args:
        response: Raw response from Vertex AI API
        model: Model name used

    Returns:
        OpenAI-compatible response dictionary
    """
    try:
        # Convert protobuf response to dictionary
        MessageToDict = _ensure_protobuf_imports()
        response_dict = MessageToDict(response)
        logger.debug(
            f"Google Vertex response dict: {json.dumps(response_dict, indent=2, default=str)}"
        )

        # Extract predictions
        predictions = response_dict.get("predictions", [])
        logger.debug(f"Predictions count: {len(predictions)}")

        if not predictions:
            logger.error(f"No predictions in Vertex AI response. Full response: {response_dict}")
            raise ValueError("No predictions in Vertex AI response")

        # Get the first prediction
        prediction = predictions[0]
        logger.debug(f"First prediction: {json.dumps(prediction, indent=2, default=str)}")

        # Extract content from candidates
        candidates = prediction.get("candidates", [])
        logger.debug(f"Candidates count: {len(candidates)}")

        if not candidates:
            logger.error(f"No candidates in Vertex AI prediction. Prediction: {prediction}")
            raise ValueError("No candidates in Vertex AI prediction")

        candidate = candidates[0]
        
        # Use shared normalization function
        return _normalize_vertex_candidate_to_openai(candidate, model)

    except Exception as e:
        logger.error(f"Failed to process Google Vertex AI response: {e}", exc_info=True)
        raise


def process_google_vertex_response(response: Any) -> dict:
    """Process Google Vertex AI response - handles both old and new formats

    Args:
        response: Either a protobuf response (old) or already-processed dict (new)

    Returns:
        OpenAI-compatible response dict
    """
    # If response is already a dict with the expected structure, return as-is
    if isinstance(response, dict) and "choices" in response and "usage" in response:
        logger.debug("Response is already in OpenAI format, returning as-is")
        return response

    # Otherwise, try to process as old protobuf format (for backward compatibility)
    logger.debug("Processing response as protobuf format")
    return _process_google_vertex_response(response, "google-vertex")


def _process_google_vertex_rest_response(response_data: dict, model: str) -> dict:
    """Process Google Vertex AI REST API response to OpenAI-compatible format

    Args:
        response_data: Response dictionary from the REST API
        model: Model name used

    Returns:
        OpenAI-compatible response dictionary
    """
    try:
        logger.debug(
            f"Google Vertex REST response: {json.dumps(response_data, indent=2, default=str)}"
        )

        # Extract candidates from REST API response
        candidates = response_data.get("candidates", [])
        logger.debug(f"Candidates count: {len(candidates)}")

        if not candidates:
            logger.error(f"No candidates in Vertex AI response. Full response: {response_data}")
            raise ValueError("No candidates in Vertex AI response")

        # Get the first candidate
        candidate = candidates[0]
        
        # Merge top-level usage metadata into candidate for consistency with shared function
        if "usageMetadata" in response_data and "usageMetadata" not in candidate:
            candidate["usageMetadata"] = response_data["usageMetadata"]
        
        # Use shared normalization function
        return _normalize_vertex_candidate_to_openai(candidate, model)

    except Exception as e:
        logger.error(f"Failed to process Google Vertex AI REST response: {e}", exc_info=True)
        raise


def diagnose_google_vertex_credentials() -> dict:
    """Diagnose Google Vertex AI credentials and return detailed status

    Returns a dictionary with:
    - credentials_available: bool - Whether credentials were found and loaded
    - credential_source: str - Where credentials came from (env_json, file, adc, none)
    - project_id: str or None - Configured GCP project ID
    - location: str or None - Configured GCP region
    - initialization_successful: bool - Whether Vertex AI initialized successfully
    - error: str or None - Error message if any step failed
    - steps: list - Detailed step-by-step diagnostics

    This function is safe to call even if credentials are not configured - it returns
    diagnostic information without raising exceptions.
    """
    result = {
        "credentials_available": False,
        "credential_source": "none",
        "project_id": Config.GOOGLE_PROJECT_ID,
        "location": Config.GOOGLE_VERTEX_LOCATION,
        "initialization_successful": False,
        "error": None,
        "steps": []
    }

    # Step 1: Check configuration
    step1 = {"step": "Configuration check", "passed": False, "details": ""}
    if not Config.GOOGLE_PROJECT_ID:
        step1["details"] = "GOOGLE_PROJECT_ID not set"
        result["steps"].append(step1)
    else:
        step1["passed"] = True
        step1["details"] = f"Project ID: {Config.GOOGLE_PROJECT_ID}"
        result["steps"].append(step1)

    if not Config.GOOGLE_VERTEX_LOCATION:
        step1["details"] += " | GOOGLE_VERTEX_LOCATION not set"
    else:
        step1["details"] += f" | Location: {Config.GOOGLE_VERTEX_LOCATION}"

    # Step 2: Check for credentials
    step2 = {"step": "Credential check", "passed": False, "source": "none", "details": ""}
    try:
        # Check GOOGLE_APPLICATION_CREDENTIALS (file path)
        if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            result["credentials_available"] = True
            step2["passed"] = True
            step2["source"] = "GOOGLE_APPLICATION_CREDENTIALS (file)"
            result["credential_source"] = "file"
            creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
            step2["details"] = f"Credentials file path: {creds_path}"

        # Check GOOGLE_VERTEX_CREDENTIALS_JSON (raw JSON)
        elif os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON"):
            result["credentials_available"] = True
            step2["passed"] = True
            step2["source"] = "GOOGLE_VERTEX_CREDENTIALS_JSON (env)"
            result["credential_source"] = "env_json"

            # Parse to get service account email for logging
            try:
                creds_json = os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")
                creds_dict = json.loads(creds_json)
                service_email = creds_dict.get("client_email", "unknown")
                step2["details"] = f"Raw JSON credentials (service account: {service_email})"
            except Exception:
                step2["details"] = "Raw JSON credentials detected"
        else:
            step2["details"] = "No credentials found in GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_VERTEX_CREDENTIALS_JSON. Will try ADC."
            result["credential_source"] = "adc"
            result["credentials_available"] = True  # ADC might still work
            step2["passed"] = True

    except Exception as e:
        step2["details"] = f"Failed to check credentials: {str(e)[:200]}"
        result["error"] = str(e)

    result["steps"].append(step2)

    # Step 3: Try to initialize Vertex AI
    step3 = {"step": "Vertex AI initialization", "passed": False, "details": ""}
    try:
        initialize_vertex_ai()
        result["initialization_successful"] = True
        step3["passed"] = True
        step3["details"] = "Successfully initialized Vertex AI with ADC"
    except Exception as e:
        step3["details"] = f"Failed to initialize: {str(e)[:200]}"
        result["error"] = str(e)

    result["steps"].append(step3)

    # Step 4: Summary
    is_healthy = (
        result["initialization_successful"]
        and Config.GOOGLE_PROJECT_ID
        and Config.GOOGLE_VERTEX_LOCATION
    )

    result["health_status"] = "healthy" if is_healthy else "unhealthy"

    if not is_healthy:
        issues = []
        if not Config.GOOGLE_PROJECT_ID:
            issues.append("GOOGLE_PROJECT_ID not configured")
        if not Config.GOOGLE_VERTEX_LOCATION:
            issues.append("GOOGLE_VERTEX_LOCATION not configured")
        if not result["initialization_successful"]:
            issues.append("Vertex AI initialization failed")

        result["error"] = "Configuration issues: " + "; ".join(issues)

    return result
