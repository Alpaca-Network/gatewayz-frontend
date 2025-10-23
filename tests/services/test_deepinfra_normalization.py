#!/usr/bin/env python3
"""
Tests for DeepInfra model normalization

Tests cover:
- Image generation model normalization (text->image)
- Text generation model normalization (text->text)
- Pricing extraction for time-based models
- Deprecation notice handling
"""

import pytest
from src.services.models import normalize_deepinfra_model


class TestDeepInfraNormalization:
    """Test DeepInfra model normalization"""

    def test_normalize_text_to_image_model(self):
        """Test normalizing an image generation model"""
        # Sample DeepInfra model data for runwayml/stable-diffusion-v1-5
        deepinfra_model = {
            "model_name": "runwayml/stable-diffusion-v1-5",
            "type": "text-to-image",
            "reported_type": "text-to-image",
            "description": "Most widely used version of Stable Diffusion. Trained on 512x512 images",
            "cover_img_url": "https://shared.deepinfra.com/models/runwayml/stable-diffusion-v1-5/cover_image.jpg",
            "tags": [],
            "pricing": {
                "type": "time",
                "cents_per_sec": 0.05
            },
            "max_tokens": None,
            "replaced_by": "stabilityai/sdxl-turbo",
            "deprecated": 1727456682,
            "quantization": None,
            "private": 0
        }

        normalized = normalize_deepinfra_model(deepinfra_model)

        # Verify basic fields
        assert normalized["id"] == "runwayml/stable-diffusion-v1-5"
        assert normalized["slug"] == "runwayml/stable-diffusion-v1-5"
        assert normalized["provider_slug"] == "runwayml"
        assert normalized["source_gateway"] == "deepinfra"

        # Verify modality is set to text->image
        assert normalized["architecture"]["modality"] == "text->image"
        assert normalized["architecture"]["input_modalities"] == ["text"]
        assert normalized["architecture"]["output_modalities"] == ["image"]

        # Verify pricing is extracted for image generation
        # cents_per_sec = 0.05, assume 5 seconds per image -> 0.05 * 5 / 100 = 0.0025
        assert normalized["pricing"]["image"] == "0.0025"

        # Verify deprecation notice is in description
        assert "deprecated" in normalized["description"].lower()
        assert "stabilityai/sdxl-turbo" in normalized["description"]

    def test_normalize_text_generation_model(self):
        """Test normalizing a text generation model"""
        deepinfra_model = {
            "model_name": "meta-llama/Llama-3-8b-Instruct",
            "type": "text-generation",
            "reported_type": "text-generation",
            "description": "Llama 3 8B instruction-tuned model",
            "pricing": {
                "type": "token",
                "input_per_million": 0.06,
                "output_per_million": 0.06
            }
        }

        normalized = normalize_deepinfra_model(deepinfra_model)

        # Verify modality is text->text
        assert normalized["architecture"]["modality"] == "text->text"
        assert normalized["architecture"]["input_modalities"] == ["text"]
        assert normalized["architecture"]["output_modalities"] == ["text"]

    def test_normalize_model_without_type(self):
        """Test normalizing a model without explicit type (defaults to text->text)"""
        deepinfra_model = {
            "model_name": "some-provider/some-model",
            "description": "A test model"
        }

        normalized = normalize_deepinfra_model(deepinfra_model)

        # Should default to text->text
        assert normalized["architecture"]["modality"] == "text->text"
        assert normalized["architecture"]["input_modalities"] == ["text"]
        assert normalized["architecture"]["output_modalities"] == ["text"]

    def test_normalize_model_with_id_field(self):
        """Test normalizing a model that uses 'id' instead of 'model_name'"""
        deepinfra_model = {
            "id": "provider/model",
            "type": "text-to-image",
            "description": "Test model"
        }

        normalized = normalize_deepinfra_model(deepinfra_model)

        assert normalized["id"] == "provider/model"
        assert normalized["architecture"]["modality"] == "text->image"

    def test_normalize_model_without_pricing(self):
        """Test normalizing a model without pricing information"""
        deepinfra_model = {
            "model_name": "test/model",
            "type": "text-to-image",
            "description": "Test model"
        }

        normalized = normalize_deepinfra_model(deepinfra_model)

        # All pricing fields should be None
        assert normalized["pricing"]["prompt"] is None
        assert normalized["pricing"]["completion"] is None
        assert normalized["pricing"]["image"] is None

    def test_normalize_deprecated_model_without_replacement(self):
        """Test normalizing a deprecated model without a replacement"""
        deepinfra_model = {
            "model_name": "old/model",
            "type": "text-generation",
            "description": "An old model",
            "deprecated": 1700000000
        }

        normalized = normalize_deepinfra_model(deepinfra_model)

        # Should include deprecation notice without replacement
        assert "deprecated" in normalized["description"].lower()
        assert "replaced by" not in normalized["description"].lower()

    def test_normalize_model_with_multimodal_type(self):
        """Test normalizing a multimodal model"""
        deepinfra_model = {
            "model_name": "provider/multimodal-model",
            "type": "multimodal",
            "description": "A multimodal model"
        }

        normalized = normalize_deepinfra_model(deepinfra_model)

        assert normalized["architecture"]["modality"] == "multimodal"
        assert "text" in normalized["architecture"]["input_modalities"]
        assert "image" in normalized["architecture"]["input_modalities"]
        assert "text" in normalized["architecture"]["output_modalities"]

    def test_normalize_tts_model(self):
        """Test normalizing a text-to-speech model"""
        deepinfra_model = {
            "model_name": "provider/tts-model",
            "type": "text-to-speech",
            "description": "A TTS model"
        }

        normalized = normalize_deepinfra_model(deepinfra_model)

        assert normalized["architecture"]["modality"] == "text->audio"
        assert normalized["architecture"]["input_modalities"] == ["text"]
        assert normalized["architecture"]["output_modalities"] == ["audio"]

    def test_normalize_stt_model(self):
        """Test normalizing a speech-to-text model"""
        deepinfra_model = {
            "model_name": "provider/stt-model",
            "type": "speech-to-text",
            "description": "An STT model"
        }

        normalized = normalize_deepinfra_model(deepinfra_model)

        assert normalized["architecture"]["modality"] == "audio->text"
        assert normalized["architecture"]["input_modalities"] == ["audio"]
        assert normalized["architecture"]["output_modalities"] == ["text"]
