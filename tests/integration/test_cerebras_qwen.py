#!/usr/bin/env python
"""Test Cerebras API with Qwen models"""

import os
import sys
import pytest
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class TestCerebrasQwen:
    """Test suite for Cerebras Qwen model integration"""

    @pytest.fixture(scope="class")
    def cerebras_api_key(self):
        """Get Cerebras API key from environment"""
        api_key = os.getenv("CEREBRAS_API_KEY")
        if not api_key:
            pytest.skip("CEREBRAS_API_KEY not found in environment")
        return api_key

    @pytest.fixture(scope="class")
    def cerebras_client(self, cerebras_api_key):
        """Create Cerebras client using OpenAI-compatible interface"""
        return OpenAI(
            base_url="https://api.cerebras.ai/v1",
            api_key=cerebras_api_key,
            timeout=120.0  # Extended timeout for inference
        )

    def test_cerebras_qwen_basic(self, cerebras_client):
        """Test basic Qwen model inference"""
        response = cerebras_client.chat.completions.create(
            model="qwen-7b",
            messages=[
                {"role": "user", "content": "Say hello and tell me what model you are."}
            ],
            max_tokens=100,
            temperature=0.7
        )

        assert response is not None
        assert response.choices
        assert len(response.choices) > 0
        assert response.choices[0].message.content
        assert "hello" in response.choices[0].message.content.lower()
        print(f"✓ Basic test passed")
        print(f"  Content: {response.choices[0].message.content[:100]}...")

    def test_cerebras_qwen_streaming(self, cerebras_client):
        """Test streaming Qwen model inference"""
        stream = cerebras_client.chat.completions.create(
            model="qwen-7b",
            messages=[
                {"role": "user", "content": "Count to 5"}
            ],
            max_tokens=50,
            temperature=0.7,
            stream=True
        )

        full_content = ""
        chunk_count = 0

        for chunk in stream:
            chunk_count += 1
            if chunk.choices and chunk.choices[0].delta.content:
                full_content += chunk.choices[0].delta.content

        assert chunk_count > 0
        assert len(full_content) > 0
        print(f"✓ Streaming test passed")
        print(f"  Chunks received: {chunk_count}")
        print(f"  Total content length: {len(full_content)}")

    def test_cerebras_qwen_system_prompt(self, cerebras_client):
        """Test Qwen model with system prompt"""
        response = cerebras_client.chat.completions.create(
            model="qwen-7b",
            messages=[
                {"role": "system", "content": "You are a helpful assistant. Always respond in exactly 2 sentences."},
                {"role": "user", "content": "What is Python?"}
            ],
            max_tokens=100,
            temperature=0.5
        )

        assert response.choices
        content = response.choices[0].message.content
        assert content
        assert len(content) > 0
        print(f"✓ System prompt test passed")
        print(f"  Response: {content}")

    def test_cerebras_qwen_multi_turn(self, cerebras_client):
        """Test multi-turn conversation with Qwen model"""
        response = cerebras_client.chat.completions.create(
            model="qwen-7b",
            messages=[
                {"role": "user", "content": "What is 2+2?"},
                {"role": "assistant", "content": "2+2 equals 4."},
                {"role": "user", "content": "What is 4+4?"}
            ],
            max_tokens=50,
            temperature=0.7
        )

        assert response.choices
        content = response.choices[0].message.content
        assert content
        assert "8" in content or "eight" in content.lower()
        print(f"✓ Multi-turn test passed")
        print(f"  Response: {content}")

    def test_cerebras_qwen_temperature_variation(self, cerebras_client):
        """Test Qwen model with different temperature settings"""
        for temp in [0.1, 0.7, 1.5]:
            response = cerebras_client.chat.completions.create(
                model="qwen-7b",
                messages=[
                    {"role": "user", "content": "Say a sentence."}
                ],
                max_tokens=50,
                temperature=temp
            )

            assert response.choices
            assert response.choices[0].message.content
            print(f"✓ Temperature {temp} test passed")

    def test_cerebras_qwen_max_tokens(self, cerebras_client):
        """Test Qwen model with different max_tokens settings"""
        response_short = cerebras_client.chat.completions.create(
            model="qwen-7b",
            messages=[
                {"role": "user", "content": "Tell me a long story"}
            ],
            max_tokens=20,
            temperature=0.7
        )

        response_long = cerebras_client.chat.completions.create(
            model="qwen-7b",
            messages=[
                {"role": "user", "content": "Tell me a long story"}
            ],
            max_tokens=100,
            temperature=0.7
        )

        short_len = len(response_short.choices[0].message.content)
        long_len = len(response_long.choices[0].message.content)

        assert short_len > 0
        assert long_len > 0
        assert long_len >= short_len  # Longer max_tokens should allow longer response
        print(f"✓ Max tokens test passed")
        print(f"  Short (20 tokens): {short_len} chars")
        print(f"  Long (100 tokens): {long_len} chars")

    def test_cerebras_qwen_response_format(self, cerebras_client):
        """Test response format from Qwen model"""
        response = cerebras_client.chat.completions.create(
            model="qwen-7b",
            messages=[
                {"role": "user", "content": "Hello"}
            ],
            max_tokens=50,
            temperature=0.7
        )

        # Verify response structure
        assert hasattr(response, "id")
        assert hasattr(response, "object")
        assert response.object == "chat.completion"
        assert hasattr(response, "created")
        assert hasattr(response, "model")
        assert hasattr(response, "choices")
        assert hasattr(response, "usage")

        # Verify choice structure
        choice = response.choices[0]
        assert hasattr(choice, "message")
        assert hasattr(choice.message, "role")
        assert choice.message.role == "assistant"
        assert hasattr(choice.message, "content")
        assert hasattr(choice, "finish_reason")

        print(f"✓ Response format test passed")
        print(f"  Response ID: {response.id}")
        print(f"  Model: {response.model}")
        print(f"  Tokens used: {response.usage.total_tokens}")


def test_cerebras_qwen_api_direct():
    """Direct test without pytest fixtures - useful for manual testing"""
    api_key = os.getenv("CEREBRAS_API_KEY")
    if not api_key:
        print("ERROR: CEREBRAS_API_KEY not found in environment")
        print("Please set CEREBRAS_API_KEY in your .env file")
        return

    print(f"Using Cerebras API Key: ...{api_key[-8:]}")

    client = OpenAI(
        base_url="https://api.cerebras.ai/v1",
        api_key=api_key,
        timeout=120.0
    )

    model = "qwen-7b"
    print(f"\nTesting model: {model}")
    print("-" * 50)

    try:
        print("Sending request...")
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "user", "content": "Say hello and tell me what model you are."}
            ],
            max_tokens=100,
            temperature=0.7
        )

        print("\n✓ SUCCESS!")
        print(f"Response ID: {response.id}")
        print(f"Model: {response.model}")
        print(f"Content: {response.choices[0].message.content}")
        if response.usage:
            print(f"Usage: {response.usage}")
        else:
            print("Usage: Not available")

    except Exception as e:
        print(f"\n✗ ERROR: {type(e).__name__}")
        print(f"Message: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    # Run direct test when executed as script
    test_cerebras_qwen_api_direct()

    # Run pytest tests
    pytest.main([__file__, "-v", "-s"])
