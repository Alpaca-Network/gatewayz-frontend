from src.services.fal_image_client import (
    load_fal_models_catalog,
    get_fal_models,
    get_fal_models_by_type,
    validate_fal_model
)


class TestFalModelsCatalog:
    """Tests for Fal.ai models catalog functionality"""

    def test_load_fal_models_catalog(self):
        """Test loading Fal.ai models catalog"""
        models = load_fal_models_catalog()

        assert isinstance(models, list)
        assert len(models) > 0

        # Check first model has required fields
        first_model = models[0]
        assert "id" in first_model
        assert "name" in first_model
        assert "provider" in first_model
        assert "type" in first_model
        assert "description" in first_model

    def test_get_fal_models(self):
        """Test getting all Fal.ai models"""
        models = get_fal_models()

        assert isinstance(models, list)
        assert len(models) > 50  # Should have 60+ models

        # Verify some known models exist
        model_ids = [model["id"] for model in models]
        assert "fal-ai/flux-pro/v1.1-ultra" in model_ids
        assert "fal-ai/stable-diffusion-v15" in model_ids
        assert "fal-ai/veo3.1" in model_ids

    def test_get_fal_models_by_type_text_to_image(self):
        """Test filtering models by text-to-image type"""
        models = get_fal_models_by_type("text-to-image")

        assert isinstance(models, list)
        assert len(models) > 0

        # All models should be text-to-image type
        for model in models:
            assert model["type"] == "text-to-image"

        # Check for known text-to-image models
        model_ids = [model["id"] for model in models]
        assert "fal-ai/flux-pro/v1.1-ultra" in model_ids
        assert "fal-ai/stable-diffusion-v15" in model_ids

    def test_get_fal_models_by_type_image_to_video(self):
        """Test filtering models by image-to-video type"""
        models = get_fal_models_by_type("image-to-video")

        assert isinstance(models, list)
        assert len(models) > 0

        # All models should be image-to-video type
        for model in models:
            assert model["type"] == "image-to-video"

        # Check for known image-to-video models
        model_ids = [model["id"] for model in models]
        assert "fal-ai/veo3.1/image-to-video" in model_ids

    def test_get_fal_models_by_type_text_to_video(self):
        """Test filtering models by text-to-video type"""
        models = get_fal_models_by_type("text-to-video")

        assert isinstance(models, list)
        assert len(models) > 0

        # All models should be text-to-video type
        for model in models:
            assert model["type"] == "text-to-video"

        # Check for known text-to-video models
        model_ids = [model["id"] for model in models]
        assert "fal-ai/veo3.1" in model_ids
        assert "fal-ai/sora-2/text-to-video" in model_ids

    def test_get_fal_models_by_type_empty(self):
        """Test filtering with non-existent type returns empty list"""
        models = get_fal_models_by_type("non-existent-type")

        assert isinstance(models, list)
        assert len(models) == 0

    def test_validate_fal_model_valid(self):
        """Test validating existing model IDs"""
        assert validate_fal_model("fal-ai/flux-pro/v1.1-ultra") is True
        assert validate_fal_model("fal-ai/stable-diffusion-v15") is True
        assert validate_fal_model("fal-ai/veo3.1") is True
        assert validate_fal_model("fal-ai/sora-2/text-to-video") is True

    def test_validate_fal_model_invalid(self):
        """Test validating non-existent model IDs"""
        assert validate_fal_model("fal-ai/non-existent-model") is False
        assert validate_fal_model("invalid-model-id") is False
        assert validate_fal_model("") is False

    def test_model_types_coverage(self):
        """Test that catalog covers all expected model types"""
        all_models = get_fal_models()
        model_types = set(model["type"] for model in all_models)

        expected_types = {
            "text-to-image",
            "image-to-image",
            "text-to-video",
            "image-to-video",
            "video-to-video",
            "text-to-speech",
            "text-to-audio",
            "image-to-3d",
            "training",
            "utility"
        }

        assert expected_types.issubset(model_types)

    def test_catalog_caching(self):
        """Test that catalog is cached after first load"""
        # First call loads from file
        models1 = get_fal_models()

        # Second call should return cached version
        models2 = get_fal_models()

        # Should be the same object (cached)
        assert models1 is models2

    def test_model_structure(self):
        """Test that all models have consistent structure"""
        models = get_fal_models()

        required_fields = ["id", "name", "provider", "type", "description", "tags"]

        for model in models:
            for field in required_fields:
                assert field in model, f"Model {model.get('id')} missing field: {field}"

            # Verify field types
            assert isinstance(model["id"], str)
            assert isinstance(model["name"], str)
            assert isinstance(model["provider"], str)
            assert isinstance(model["type"], str)
            assert isinstance(model["description"], str)
            assert isinstance(model["tags"], list)
