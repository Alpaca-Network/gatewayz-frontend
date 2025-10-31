"""Test script to debug DeepSeek R1 thinking tags in streaming"""
import asyncio
import json
from unittest.mock import Mock, AsyncMock, patch

def test_thinking_tags_in_stream():
    """Test that thinking tags are properly passed through in streaming responses"""

    # Create a mock stream with thinking tags
    def mock_stream_with_thinking():
        """Mock streaming response that includes thinking tags"""
        chunks = [
            # First chunk with thinking tag
            Mock(
                id="chatcmpl-1",
                object="text_completion.chunk",
                created=1234567890,
                model="deepseek-r1-distill-qwen-7b",
                choices=[
                    Mock(
                        index=0,
                        delta=Mock(role="assistant", content="<thinking>\n"),
                        finish_reason=None
                    )
                ],
                usage=None
            ),
            # Middle chunk with thinking content
            Mock(
                id="chatcmpl-1",
                object="text_completion.chunk",
                created=1234567890,
                model="deepseek-r1-distill-qwen-7b",
                choices=[
                    Mock(
                        index=0,
                        delta=Mock(role=None, content="The capital of France is Paris.\n"),
                        finish_reason=None
                    )
                ],
                usage=None
            ),
            # Thinking close tag
            Mock(
                id="chatcmpl-1",
                object="text_completion.chunk",
                created=1234567890,
                model="deepseek-r1-distill-qwen-7b",
                choices=[
                    Mock(
                        index=0,
                        delta=Mock(role=None, content="</thinking>\n"),
                        finish_reason=None
                    )
                ],
                usage=None
            ),
            # Final chunk with usage
            Mock(
                id="chatcmpl-1",
                object="text_completion.chunk",
                created=1234567890,
                model="deepseek-r1-distill-qwen-7b",
                choices=[
                    Mock(
                        index=0,
                        delta=Mock(role=None, content=None),
                        finish_reason="stop"
                    )
                ],
                usage=Mock(
                    prompt_tokens=15,
                    completion_tokens=50,
                    total_tokens=65
                )
            )
        ]
        for chunk in chunks:
            yield chunk

    # Test the stream generator
    from src.routes.chat import stream_generator

    user = {"id": 1, "credits": 100.0, "environment_tag": "live"}
    api_key = "test_key"
    model = "deepseek-r1-distill-qwen-7b"
    trial = {"is_trial": False, "is_expired": False}

    stream_output = []
    async def collect_stream():
        async for chunk in stream_generator(
            mock_stream_with_thinking(),
            user,
            api_key,
            model,
            trial,
            "live",
            None,
            [{"role": "user", "content": "What is the capital of France?"}],
            None,
            "openrouter"
        ):
            stream_output.append(chunk)

    # Run async function
    asyncio.run(collect_stream())

    # Analyze output
    print("Stream output analysis:")
    print("=" * 80)

    thinking_found = False
    for i, line in enumerate(stream_output):
        if line.startswith("data: "):
            try:
                data = json.loads(line[6:].strip())
                if "choices" in data:
                    for choice in data["choices"]:
                        if "delta" in choice and choice["delta"].get("content"):
                            content = choice["delta"]["content"]
                            if "<thinking>" in content or "</thinking>" in content or "thinking" in content.lower():
                                thinking_found = True
                                print(f"[CHUNK {i}] FOUND THINKING TAG:")
                                print(f"  Content: {repr(content[:100])}")
                            else:
                                print(f"[CHUNK {i}] Regular content: {repr(content[:50])}")
            except json.JSONDecodeError:
                pass

    print("=" * 80)
    print(f"Thinking tags found in stream: {thinking_found}")

    if thinking_found:
        print("SUCCESS: Thinking tags are being passed through!")
    else:
        print("WARNING: Thinking tags not found in stream output")
        print("\nFull stream output for inspection:")
        for i, chunk in enumerate(stream_output):
            print(f"Chunk {i}: {chunk[:100]}")


if __name__ == "__main__":
    test_thinking_tags_in_stream()
