"""Google Vertex AI API client for chat completions

This module provides integration with Google Vertex AI generative models
using the REST API for Gemini models (generateContent endpoint).

For Gemini models, we use the REST API directly because:
1. The new google-genai SDK is the recommended approach going forward
2. The old PredictionServiceClient doesn't work reliably with newer Gemini models
3. The REST API is stable and well-documented
"""

import json
import logging
import time
from collections.abc import Iterator
from typing import Any

import google.auth
import httpx
from google.auth.transport.requests import Request
from google.oauth2.service_account import Credentials

from src.config import Config

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_google_vertex_credentials():
    """Get Google Cloud credentials for Vertex AI

    Tries multiple credential sources in order:
    1. GOOGLE_VERTEX_CREDENTIALS_JSON environment variable (for Vercel/serverless)
       - Supports both raw JSON and base64-encoded JSON
    2. GOOGLE_APPLICATION_CREDENTIALS file path (for development)
    3. Application Default Credentials (ADC) from google.auth.default()
    """
    try:
        # First, try to get credentials from JSON environment variable (Vercel/serverless)
        import base64
        import os

        creds_json_env = os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")
        if creds_json_env:
            logger.info(
                "Loading Google Vertex credentials from GOOGLE_VERTEX_CREDENTIALS_JSON environment variable"
            )
            import json as json_module

            try:
                # Try to parse as raw JSON first
                creds_dict = json_module.loads(creds_json_env)
                logger.debug("Credentials parsed as raw JSON")
            except (json_module.JSONDecodeError, ValueError):
                # If that fails, try base64 decoding
                try:
                    logger.debug("Attempting to decode credentials as base64")
                    decoded = base64.b64decode(creds_json_env).decode("utf-8")
                    creds_dict = json_module.loads(decoded)
                    logger.debug("Credentials successfully decoded from base64 and parsed as JSON")
                except Exception as base64_error:
                    logger.warning(
                        f"Failed to decode credentials as base64: {base64_error}. "
                        "Falling back to next credential method.",
                        exc_info=True
                    )
                    # Don't raise - allow fallback to next credential method
                    creds_dict = None

            if creds_dict:
                try:
                    credentials = Credentials.from_service_account_info(creds_dict)
                    logger.debug("Created Credentials object from service account info")
                    credentials.refresh(Request())
                    logger.info(
                        "Successfully loaded and validated Google Vertex credentials from GOOGLE_VERTEX_CREDENTIALS_JSON"
                    )
                    return credentials
                except Exception as e:
                    logger.warning(
                        f"Failed to create/refresh credentials from GOOGLE_VERTEX_CREDENTIALS_JSON: {e}. "
                        "Falling back to next credential method.",
                        exc_info=True
                    )
                    # Don't raise - allow fallback to next credential method

        # Second, try file-based credentials (development)
        if Config.GOOGLE_APPLICATION_CREDENTIALS:
            logger.info(
                f"Loading Google Vertex credentials from file: {Config.GOOGLE_APPLICATION_CREDENTIALS}"
            )
            try:
                credentials = Credentials.from_service_account_file(
                    Config.GOOGLE_APPLICATION_CREDENTIALS
                )
                credentials.refresh(Request())
                logger.info("Successfully loaded Google Vertex credentials from file")
                return credentials
            except Exception as e:
                logger.warning(
                    f"Failed to load/refresh credentials from file: {e}. "
                    "Falling back to next credential method.",
                    exc_info=True
                )
                # Don't raise - allow fallback to next credential method

        # Third, try Application Default Credentials (ADC)
        logger.info("Attempting to use Application Default Credentials (ADC)")
        credentials, _ = google.auth.default()
        if not credentials.valid:
            credentials.refresh(Request())
        logger.info("Successfully loaded Application Default Credentials")
        return credentials
    except Exception as e:
        logger.error(f"Failed to get Google Cloud credentials: {e}", exc_info=True)
        logger.error("Please set one of:")
        logger.error(
            "  1. GOOGLE_VERTEX_CREDENTIALS_JSON (raw JSON or base64-encoded for serverless)"
        )
        logger.error("  2. GOOGLE_APPLICATION_CREDENTIALS (file path for development)")
        logger.error("  3. Configure Application Default Credentials via gcloud")
        raise


def get_google_vertex_access_token():
    """Get Google Vertex AI access token for REST API calls

    Returns an access token that can be used in Authorization headers
    for REST API requests to the Vertex AI Gemini API.
    """
    try:
        logger.info("Getting Google Vertex AI credentials")
        credentials = get_google_vertex_credentials()
        logger.info("Successfully obtained credentials")

        # Ensure credentials are fresh
        if not credentials.valid or credentials.expired:
            logger.info("Refreshing expired or invalid credentials")
            credentials.refresh(Request())

        access_token = credentials.token
        logger.info("Successfully obtained access token")
        return access_token
    except Exception as e:
        logger.error(f"Failed to get Google Vertex access token: {e}")
        raise


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
    max_tokens: int | None = None,
    temperature: float | None = None,
    top_p: float | None = None,
    **kwargs,
) -> dict:
    """Make request to Google Vertex AI generative models using REST API

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

        # Step 1: Get access token
        try:
            access_token = get_google_vertex_access_token()
            logger.info("Successfully obtained access token")
        except Exception as token_error:
            logger.error(f"Failed to get access token: {token_error}", exc_info=True)
            raise

        # Step 2: Transform model ID
        try:
            model_name = transform_google_vertex_model_id(model)
            logger.info(f"Using model name: {model_name}")
        except Exception as transform_error:
            logger.error(f"Failed to transform model ID: {transform_error}", exc_info=True)
            raise

        # Step 3: Build request content
        try:
            contents = _build_vertex_content(messages)
            logger.debug(f"Built contents with {len(contents)} messages")
        except Exception as content_error:
            logger.error(f"Failed to build vertex content: {content_error}", exc_info=True)
            raise

        # Step 4: Build generation config
        try:
            generation_config = {}
            if max_tokens is not None:
                generation_config["maxOutputTokens"] = max_tokens
            if temperature is not None:
                generation_config["temperature"] = temperature
            if top_p is not None:
                generation_config["topP"] = top_p
            logger.debug(f"Generation config: {generation_config}")
        except Exception as config_error:
            logger.error(f"Failed to build generation config: {config_error}", exc_info=True)
            raise

        # Step 5: Prepare the request payload
        try:
            request_body = {
                "contents": contents,
            }

            # Add generation config if provided
            if generation_config:
                request_body["generationConfig"] = generation_config

            logger.debug(f"Request body prepared with keys: {list(request_body.keys())}")
        except Exception as request_error:
            logger.error(f"Failed to create request body: {request_error}", exc_info=True)
            raise

        # Step 6: Make the REST API request
        try:
            # Construct the API endpoint URL
            api_endpoint = f"{Config.GOOGLE_VERTEX_LOCATION}-aiplatform.googleapis.com"
            url = (
                f"https://{api_endpoint}/v1/"
                f"projects/{Config.GOOGLE_PROJECT_ID}/"
                f"locations/{Config.GOOGLE_VERTEX_LOCATION}/"
                f"publishers/google/models/{model_name}:generateContent"
            )

            logger.info(f"Calling Vertex AI REST API: {url}")

            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            }

            # Make the HTTP POST request
            with httpx.Client(timeout=60.0) as client:
                response = client.post(url, headers=headers, json=request_body)
                response.raise_for_status()

            response_data = response.json()
            logger.info("Received response from Vertex AI REST API")
            logger.debug(f"Response data: {json.dumps(response_data, indent=2, default=str)}")

        except httpx.HTTPStatusError as http_error:
            logger.error(
                f"Vertex AI HTTP error {http_error.response.status_code}: {http_error.response.text[:500]}"
            )
            raise
        except Exception as api_error:
            logger.error(f"Vertex AI REST API call failed: {api_error}", exc_info=True)
            raise

        # Step 7: Process and normalize response
        try:
            processed_response = _process_google_vertex_rest_response(response_data, model)
            logger.info("Successfully processed Vertex AI response")
            return processed_response
        except Exception as process_error:
            logger.error(f"Failed to process Vertex AI response: {process_error}", exc_info=True)
            raise

    except Exception as e:
        logger.error(f"Google Vertex AI request failed: {e}", exc_info=True)
        raise


def make_google_vertex_request_openai_stream(
    messages: list,
    model: str,
    max_tokens: int | None = None,
    temperature: float | None = None,
    top_p: float | None = None,
    **kwargs,
) -> Iterator[str]:
    """Make streaming request to Google Vertex AI

    NOTE: For compatibility, this implementation uses the REST API
    and returns a complete response in OpenAI SSE streaming format.
    The Gemini REST API supports streaming via streamGenerateContent,
    but this is not yet implemented here.

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
        # Get non-streaming response using REST API
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
        logger.debug(f"First candidate: {json.dumps(candidate, indent=2, default=str)}")

        content_parts = candidate.get("content", {}).get("parts", [])
        logger.debug(f"Content parts count: {len(content_parts)}")

        # Extract text from parts
        text_content = ""
        for part in content_parts:
            if "text" in part:
                text_content += part["text"]

        logger.info(f"Extracted text content length: {len(text_content)} characters")

        # Warn if content is empty - this might indicate an issue with the model or request
        if not text_content:
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

        return {
            "id": f"vertex-{int(time.time() * 1000)}",
            "object": "text_completion",
            "created": int(time.time()),
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": text_content},
                    "finish_reason": finish_reason_map.get(finish_reason, "stop"),
                }
            ],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
        }

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
        logger.debug(f"First candidate: {json.dumps(candidate, indent=2, default=str)}")

        # Extract content from candidate
        content_parts = candidate.get("content", {}).get("parts", [])
        logger.debug(f"Content parts count: {len(content_parts)}")

        # Extract text from parts
        text_content = ""
        for part in content_parts:
            if "text" in part:
                text_content += part["text"]

        logger.info(f"Extracted text content length: {len(text_content)} characters")

        # Warn if content is empty - this might indicate an issue with the model or request
        if not text_content:
            logger.warning(
                f"Received empty text content from Vertex AI for model {model}. Candidate: {json.dumps(candidate, default=str)}"
            )

        # Extract usage information
        usage_metadata = response_data.get("usageMetadata", {})
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

        return {
            "id": f"vertex-{int(time.time() * 1000)}",
            "object": "text_completion",
            "created": int(time.time()),
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": text_content},
                    "finish_reason": finish_reason_map.get(finish_reason, "stop"),
                }
            ],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
        }

    except Exception as e:
        logger.error(f"Failed to process Google Vertex AI REST response: {e}", exc_info=True)
        raise
