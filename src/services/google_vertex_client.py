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
from google.protobuf.json_format import MessageToDict
from google.oauth2.service_account import Credentials

from src.config import Config

# Initialize logging
logger = logging.getLogger(__name__)

# Vertex AI OAuth scopes required for authentication
VERTEX_AI_SCOPES = [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/aiplatform",
]


def get_google_vertex_credentials():
    """Get Google Cloud credentials for Vertex AI

    Tries multiple credential sources in order:
    1. GOOGLE_VERTEX_CREDENTIALS_JSON environment variable (for Vercel/serverless)
       - Supports both raw JSON and base64-encoded JSON
       - Explicitly creates service account credentials using from_service_account_info()
       - This ensures proper access token generation (not id_token)
    2. GOOGLE_APPLICATION_CREDENTIALS file path (for development)
    3. Application Default Credentials (ADC) from google.auth.default()
    
    This function is used by all Google Vertex AI services to ensure consistent
    credential handling across the codebase.
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
                creds_json = creds_json_env
                creds_dict = json_module.loads(creds_json)
                logger.debug("Credentials parsed as raw JSON")
            except (json_module.JSONDecodeError, ValueError):
                # If that fails, try base64 decoding
                try:
                    logger.debug("Attempting to decode credentials as base64")
                    creds_json = base64.b64decode(creds_json_env).decode("utf-8")
                    creds_dict = json_module.loads(creds_json)
                    logger.debug("Credentials successfully decoded from base64 and parsed as JSON")
                except Exception as base64_error:
                    logger.warning(
                        f"Failed to decode credentials as base64: {base64_error}. "
                        "Falling back to next credential method.",
                        exc_info=True,
                    )
                    # Don't raise - allow fallback to next credential method
                    creds_dict = None
                    creds_json = None

            if creds_dict and creds_json:
                try:
                    # Explicitly create service account credentials from the JSON
                    # This ensures we get proper service account credentials that can generate access tokens
                    credentials = Credentials.from_service_account_info(
                        creds_dict, scopes=VERTEX_AI_SCOPES
                    )
                    logger.info(
                        f"Successfully loaded Google Vertex credentials from JSON (service account: {creds_dict.get('client_email', 'unknown')})"
                    )
                    return credentials

                except Exception as e:
                    error_str = str(e)
                    logger.warning(
                        f"Failed to load credentials from GOOGLE_VERTEX_CREDENTIALS_JSON: {error_str}. "
                        "Falling back to next credential method.",
                        exc_info=True,
                    )
                    # Don't raise - allow fallback to next credential method

        # Second, try file-based credentials (development)
        if Config.GOOGLE_APPLICATION_CREDENTIALS:
            logger.info(
                f"Loading Google Vertex credentials from file: {Config.GOOGLE_APPLICATION_CREDENTIALS}"
            )
            try:
                credentials = Credentials.from_service_account_file(
                    Config.GOOGLE_APPLICATION_CREDENTIALS, scopes=VERTEX_AI_SCOPES
                )
                # Don't refresh here - credentials are valid upon creation
                # Refresh will happen in get_google_vertex_access_token() when needed
                logger.info("Successfully loaded Google Vertex credentials from file")
                return credentials
            except Exception as e:
                error_str = str(e)
                logger.warning(
                    f"Failed to load credentials from file: {error_str}. "
                    "Falling back to next credential method.",
                    exc_info=True,
                )
                # Don't raise - allow fallback to next credential method

        # Third, try Application Default Credentials (ADC)
        logger.info("Attempting to use Application Default Credentials (ADC)")
        credentials, _ = google.auth.default(scopes=VERTEX_AI_SCOPES)
        if not credentials.valid:
            credentials.refresh(Request())
        logger.info("Successfully loaded Application Default Credentials")
        return credentials
    except Exception as e:
        error_msg = (
            f"Failed to get Google Cloud credentials: {str(e)}. "
            "Please configure credentials for Google Vertex AI. Set one of:\n"
            "  1. GOOGLE_VERTEX_CREDENTIALS_JSON environment variable (raw JSON or base64-encoded)\n"
            "  2. GOOGLE_APPLICATION_CREDENTIALS file path (path to service account JSON)\n"
            "  3. Configure Application Default Credentials via 'gcloud auth application-default login'\n"
            "For serverless deployments, use GOOGLE_VERTEX_CREDENTIALS_JSON."
        )
        logger.error(error_msg)
        # Raise ValueError so it gets mapped to a 400 error instead of 502
        raise ValueError(error_msg) from e


def get_google_vertex_access_token():
    """Get Google Vertex AI access token for REST API calls

    Returns an OAuth2 access token that can be used as a bearer token.

    Supports all credential sources:
    1. GOOGLE_VERTEX_CREDENTIALS_JSON (raw JSON or base64)
    2. GOOGLE_APPLICATION_CREDENTIALS (file path)
    3. Application Default Credentials (ADC)
    """
    try:
        logger.info("Getting credentials for Vertex AI access token")

        # Get credentials using existing function that supports all sources
        credentials = get_google_vertex_credentials()

        # Refresh credentials to get a valid access token
        from google.auth.transport.requests import Request as AuthRequest

        # Ensure credentials are fresh - refresh if not valid or expired
        if not credentials.valid or credentials.expired:
            logger.info("Refreshing expired or invalid credentials")
            credentials.refresh(AuthRequest())
            logger.debug("Credentials refreshed successfully")

        # For service account credentials, ensure we get an access token, not id_token
        # The refresh() method should return an access token when proper scopes are used
        if hasattr(credentials, 'token') and credentials.token:
            logger.info(f"Successfully obtained access token (length: {len(credentials.token)} chars)")
            return credentials.token
        
        # If token is not available, try refreshing again
        logger.warning("Token not available after refresh, attempting refresh again...")
        credentials.refresh(AuthRequest())
        
        if hasattr(credentials, 'token') and credentials.token:
            logger.info(f"Successfully obtained access token after second refresh (length: {len(credentials.token)} chars)")
            return credentials.token
        
        # Check if we got an id_token instead of access_token (common issue)
        if hasattr(credentials, 'id_token') and credentials.id_token:
            error_msg = (
                "Received id_token instead of access_token. This usually happens when:\n"
                "1. The service account credentials are not properly configured\n"
                "2. The scopes are incorrect\n"
                "3. The credentials file is missing required fields\n\n"
                "Please ensure you're using a valid service account JSON key file with:\n"
                "- 'type': 'service_account'\n"
                "- 'private_key' field\n"
                "- 'client_email' field\n"
                "- Proper IAM permissions (roles/aiplatform.user)"
            )
            logger.error(error_msg)
            raise ValueError(f"No access token in response. {error_msg}")
        
        raise ValueError("Failed to obtain access token from credentials after refresh")

        access_token = credentials.token

        # CRITICAL FIX: Validate that token was actually obtained
        if not access_token:
            raise RuntimeError(
                "Failed to obtain access token from credentials. Token is None. \n"
                "This usually means:\n"
                "  1. Service account credentials are invalid or expired\n"
                "  2. Credentials lack required IAM permissions (need 'Vertex AI User' role)\n"
                "  3. Vertex AI API is not enabled in your GCP project\n"
                "  4. Scopes are not properly set during credential initialization\n"
                "Please verify your GCP project configuration and service account permissions."
            )

        logger.info("Successfully obtained access token")
        return access_token
    except Exception as e:
        logger.error(f"Failed to get Google Vertex access token: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to get Vertex AI access token: {e}", exc_info=True)
        # Check if the error contains id_token info
        error_str = str(e)
        if 'id_token' in error_str.lower():
            raise ValueError(
                f"Failed to get Google Vertex access token: {error_str}. "
                "The credentials returned an id_token instead of an access_token. "
                "Please ensure you're using a valid service account JSON key file."
            ) from e
        raise ValueError(f"Failed to get Google Vertex access token: {str(e)}") from e


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

        # Step 0: Validate configuration before making any API calls
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

        logger.info(f"Configuration verified - Project: {Config.GOOGLE_PROJECT_ID}, Location: {Config.GOOGLE_VERTEX_LOCATION}")

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

        # Step 6: Prepare the request payload
        try:
            request_body = {
                "contents": contents,
            }

            # Add generation config if provided
            if generation_config:
                request_body["generationConfig"] = generation_config

            # Add tools if provided (after transformation - currently not implemented)
            # if tools:
            #     request_body["tools"] = transform_openai_tools_to_gemini(tools)

            logger.debug(f"Request body prepared with keys: {list(request_body.keys())}")
        except Exception as request_error:
            logger.error(f"Failed to create request body: {request_error}", exc_info=True)
            raise

        # Step 7: Make the REST API request
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
            status_code = http_error.response.status_code
            response_text = http_error.response.text[:500]

            # Provide detailed error messages based on HTTP status codes
            if status_code == 404:
                error_message = (
                    f"Vertex AI API returned 404 (Not Found). This usually means:\n"
                    f"  1. Vertex AI API is not enabled in GCP project '{Config.GOOGLE_PROJECT_ID}'\n"
                    f"  2. Model '{model}' is not available in region '{Config.GOOGLE_VERTEX_LOCATION}'\n"
                    f"  3. The project ID or region is incorrect\n"
                    f"  4. The model name format is invalid\n"
                    f"\nFull error: {response_text}"
                )
            elif status_code == 401:
                error_message = (
                    f"Vertex AI API returned 401 (Unauthorized). This usually means:\n"
                    f"  1. Service account credentials are invalid or expired\n"
                    f"  2. GOOGLE_VERTEX_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS is not set correctly\n"
                    f"  3. The credentials file/JSON has been corrupted or revoked\n"
                    f"  4. Your credentials have expired and need to be refreshed\n"
                    f"\nFull error: {response_text}"
                )
            elif status_code == 403:
                error_message = (
                    f"Vertex AI API returned 403 (Forbidden/Permission Denied). This usually means:\n"
                    f"  1. Service account lacks required IAM roles:\n"
                    f"     - Need 'roles/aiplatform.user' (Vertex AI User) or\n"
                    f"     - 'roles/aiplatform.serviceAgent' (Vertex AI Service Agent)\n"
                    f"  2. The service account is not authorized for project '{Config.GOOGLE_PROJECT_ID}'\n"
                    f"  3. Vertex AI API is not enabled in your GCP project\n"
                    f"\nHow to fix:\n"
                    f"  1. Go to GCP Console -> IAM & Admin -> Roles\n"
                    f"  2. Find your service account and add 'Vertex AI User' role\n"
                    f"  3. Go to APIs & Services and ensure 'Vertex AI API' is enabled\n"
                    f"\nFull error: {response_text}"
                )
            elif status_code == 429:
                error_message = (
                    f"Vertex AI API returned 429 (Too Many Requests). Rate limit exceeded. "
                    f"Please retry after a delay.\n"
                    f"Full error: {response_text}"
                )
            else:
                error_message = (
                    f"Vertex AI HTTP error {status_code}: {response_text}"
                )

            logger.error(error_message)
            raise Exception(error_message) from http_error
        except Exception as api_error:
            logger.error(f"Vertex AI REST API call failed: {api_error}", exc_info=True)
            raise

        # Step 8: Process and normalize response
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
    - token_available: bool - Whether access token was successfully obtained
    - token_valid: bool - Whether token is valid
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
        "token_available": False,
        "token_valid": False,
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

    # Step 2: Try to load credentials
    step2 = {"step": "Credential loading", "passed": False, "source": "none", "details": ""}
    try:
        credentials = get_google_vertex_credentials()
        result["credentials_available"] = True
        step2["passed"] = True

        # Determine source
        import os
        if os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON"):
            step2["source"] = "GOOGLE_VERTEX_CREDENTIALS_JSON (env)"
            result["credential_source"] = "env_json"
        elif Config.GOOGLE_APPLICATION_CREDENTIALS:
            step2["source"] = f"GOOGLE_APPLICATION_CREDENTIALS (file)"
            result["credential_source"] = "file"
        else:
            step2["source"] = "Application Default Credentials (ADC)"
            result["credential_source"] = "adc"

        step2["details"] = f"Successfully loaded from {step2['source']}"

    except Exception as e:
        step2["details"] = f"Failed to load credentials: {str(e)[:200]}"
        result["error"] = str(e)

    result["steps"].append(step2)

    # Step 3: Try to get access token
    step3 = {"step": "Access token", "passed": False, "details": ""}
    if result["credentials_available"]:
        try:
            access_token = get_google_vertex_access_token()
            if access_token:
                result["token_available"] = True
                result["token_valid"] = True
                step3["passed"] = True
                step3["details"] = f"Token obtained (length: {len(access_token)} chars)"
            else:
                step3["details"] = "Token is None/empty"
        except Exception as e:
            step3["details"] = f"Failed to get token: {str(e)[:200]}"
            result["error"] = str(e)
    else:
        step3["details"] = "Skipped - credentials not available"

    result["steps"].append(step3)

    # Step 4: Summary
    is_healthy = (
        result["credentials_available"]
        and result["token_available"]
        and result["token_valid"]
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
        if not result["credentials_available"]:
            issues.append("Credentials not available")
        if not result["token_available"]:
            issues.append("Access token not available")

        result["error"] = "Configuration issues: " + "; ".join(issues)

    return result
