"""
Braintrust integration for LLM tracing and observability.

This module provides utilities for tracing LLM calls using Braintrust.
Learn more at https://www.braintrust.dev/docs
"""

from braintrust import current_span, init_logger, start_span, traced

# Initialize logger with your project name
logger = init_logger(project="Gatewayz Backend")


def call_my_llm(input: str, params: dict) -> dict:
    """
    Replace this with your custom LLM implementation.

    This is a placeholder that should be replaced with actual LLM calls
    to your inference endpoints.
    """
    return {
        "completion": "Hello, world!",
        "metrics": {
            "prompt_tokens": len(input),
            "completion_tokens": 10,
        },
    }


# notrace_io=True prevents logging the function arguments as input,
# and lets us log a more specific input format.
@traced(type="llm", name="Custom LLM", notrace_io=True)
def invoke_custom_llm(llm_input: str, params: dict):
    """
    Invoke a custom LLM with Braintrust tracing.

    Args:
        llm_input: The input prompt for the LLM
        params: Additional parameters for the LLM call (e.g., temperature, max_tokens)

    Returns:
        The completion content from the LLM
    """
    result = call_my_llm(llm_input, params)
    content = result["completion"]

    # Log detailed span information
    current_span().log(
        input=[{"role": "user", "content": llm_input}],
        output=content,
        metrics={
            "prompt_tokens": result["metrics"]["prompt_tokens"],
            "completion_tokens": result["metrics"]["completion_tokens"],
            "tokens": result["metrics"]["prompt_tokens"] + result["metrics"]["completion_tokens"],
        },
        metadata=params,
    )

    return content


def my_route_handler(req):
    """
    Example route handler with Braintrust tracing.

    This demonstrates how to trace an entire request/response cycle,
    including nested LLM calls.

    Args:
        req: The incoming request object

    Returns:
        The LLM response
    """
    with start_span() as span:
        result = invoke_custom_llm(
            llm_input=req.body,
            params={"temperature": 0.1},
        )

        # Log the overall request/response
        span.log(input=req.body, output=result)

        return result


# Example usage for FastAPI integration
@traced(name="chat_completion_endpoint")
async def traced_chat_completion(messages: list, model: str, **kwargs):
    """
    Example traced endpoint for chat completions.

    This can be integrated into your existing FastAPI routes.
    """
    with start_span(name=f"chat_completion_{model}") as span:
        # Log the input
        span.log(
            input={"messages": messages, "model": model, "params": kwargs},
        )

        # Make your LLM call here
        # result = await your_llm_service.chat_completion(messages, model, **kwargs)

        # For demonstration purposes
        result = {
            "id": "chatcmpl-123",
            "object": "chat.completion",
            "created": 1234567890,
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": "This is a traced response",
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 20,
                "total_tokens": 30,
            },
        }

        # Log the output and metrics
        span.log(
            output=result,
            metrics={
                "prompt_tokens": result["usage"]["prompt_tokens"],
                "completion_tokens": result["usage"]["completion_tokens"],
                "total_tokens": result["usage"]["total_tokens"],
            },
        )

        return result
