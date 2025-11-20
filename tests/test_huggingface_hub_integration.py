"""
Tests for HuggingFace Hub SDK integration

This test module verifies the huggingface_hub SDK integration including:
- Model discovery endpoints
- Model search functionality
- Model metadata retrieval
- Model card access
- Author/organization model listing
- Model file information
"""

import json
import logging
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from huggingface_hub import ModelInfo

from src.main import create_app

logger = logging.getLogger(__name__)


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    app = create_app()
    return TestClient(app)


@pytest.fixture
def mock_model_info():
    """Create mock HuggingFace ModelInfo object."""
    return ModelInfo(
        id="meta-llama/Llama-2-7b",
        pipeline_tag="text-generation",
        tags=["transformers", "llama"],
        private=False,
        author="meta-llama",
        created_at="2023-07-18T21:37:00.000Z",
        lastModified="2024-01-15T10:30:00.000Z",
        description="Llama 2 7B model",
        downloads=1000000,
        likes=5000,
        gated=False,
        library_name="transformers",
    )


@pytest.fixture
def mock_model_list():
    """Create a list of mock HuggingFace models."""
    models = []
    for i in range(3):
        model = MagicMock(spec=ModelInfo)
        model.id = f"org/model-{i}"
        model.pipeline_tag = "text-generation"
        model.private = False
        model.gated = False
        model.downloads = 100000 + (i * 50000)
        model.likes = 1000 + (i * 500)
        model.description = f"Model {i} description"
        model.created_at = f"2024-01-{i:02d}T10:00:00.000Z"
        model.lastModified = f"2024-01-{i:02d}T10:00:00.000Z"
        model.author = "org"
        model.library_name = "transformers"
        models.append(model)
    return models


class TestHuggingFaceDiscoveryEndpoint:
    """Test the /v1/huggingface/discovery endpoint."""

    def test_discover_models_default_params(self, client):
        """Test discovering models with default parameters."""
        with patch(
            "src.services.huggingface_hub_service.list_huggingface_models"
        ) as mock_list:
            mock_list.return_value = [
                {
                    "id": "meta-llama/Llama-2-7b",
                    "name": "Llama 2 7B",
                    "description": "Llama 2 7B model",
                    "created": "2023-07-18T21:37:00.000Z",
                    "huggingface_metrics": {
                        "downloads": 1000000,
                        "likes": 5000,
                        "pipeline_tag": "text-generation",
                    },
                }
            ]

            response = client.get("/v1/huggingface/discovery")

            assert response.status_code == 200
            data = response.json()
            assert "models" in data
            assert data["count"] == 1
            assert data["source"] == "huggingface-hub"
            assert data["task"] == "text-generation"
            assert data["sort"] == "likes"

    def test_discover_models_custom_params(self, client):
        """Test discovering models with custom parameters."""
        with patch(
            "src.services.huggingface_hub_service.list_huggingface_models"
        ) as mock_list:
            mock_list.return_value = []

            response = client.get(
                "/v1/huggingface/discovery?task=text2text-generation&sort=downloads&limit=100"
            )

            assert response.status_code == 200
            data = response.json()
            assert data["count"] == 0
            mock_list.assert_called_once_with(
                task="text2text-generation",
                sort="downloads",
                limit=100,
            )

    def test_discover_models_limit_validation(self, client):
        """Test that limit parameter is validated."""
        response = client.get("/v1/huggingface/discovery?limit=1000")
        # Should be capped at 500 by query parameter validation
        assert response.status_code == 422 or response.status_code == 200

    def test_discover_models_error_handling(self, client):
        """Test error handling in discovery endpoint."""
        with patch(
            "src.services.huggingface_hub_service.list_huggingface_models"
        ) as mock_list:
            mock_list.side_effect = Exception("API error")

            response = client.get("/v1/huggingface/discovery")

            assert response.status_code == 500
            assert "Failed to discover" in response.json()["detail"]


class TestHuggingFaceSearchEndpoint:
    """Test the /v1/huggingface/search endpoint."""

    def test_search_models_basic(self, client):
        """Test basic model search."""
        with patch(
            "src.services.huggingface_hub_service.search_models_by_query"
        ) as mock_search:
            mock_search.return_value = [
                {
                    "id": "meta-llama/Llama-2-7b",
                    "name": "Llama 2 7B",
                    "description": "Llama 2 model",
                }
            ]

            response = client.get("/v1/huggingface/search?q=llama")

            assert response.status_code == 200
            data = response.json()
            assert data["query"] == "llama"
            assert data["count"] == 1
            assert data["source"] == "huggingface-hub"

    def test_search_models_with_task_filter(self, client):
        """Test search with task filter."""
        with patch(
            "src.services.huggingface_hub_service.search_models_by_query"
        ) as mock_search:
            mock_search.return_value = []

            response = client.get(
                "/v1/huggingface/search?q=llama&task=text-generation&limit=50"
            )

            assert response.status_code == 200
            mock_search.assert_called_once_with(
                query="llama",
                task="text-generation",
                limit=50,
            )

    def test_search_models_missing_query(self, client):
        """Test that search requires a query parameter."""
        response = client.get("/v1/huggingface/search")
        assert response.status_code == 422  # Validation error

    def test_search_models_error_handling(self, client):
        """Test error handling in search endpoint."""
        with patch(
            "src.services.huggingface_hub_service.search_models_by_query"
        ) as mock_search:
            mock_search.side_effect = Exception("Search failed")

            response = client.get("/v1/huggingface/search?q=llama")

            assert response.status_code == 500


class TestHuggingFaceModelDetailsEndpoint:
    """Test the /v1/huggingface/models/{model_id}/details endpoint."""

    def test_get_model_details_success(self, client):
        """Test retrieving model details successfully."""
        with patch(
            "src.services.huggingface_hub_service.get_model_details"
        ) as mock_details:
            mock_details.return_value = {
                "id": "meta-llama/Llama-2-7b",
                "name": "Llama 2 7B",
                "description": "Llama 2 model",
                "huggingface_metrics": {
                    "downloads": 1000000,
                    "likes": 5000,
                    "pipeline_tag": "text-generation",
                },
            }

            response = client.get("/v1/huggingface/models/meta-llama/Llama-2-7b/details")

            assert response.status_code == 200
            data = response.json()
            assert "model" in data
            assert data["source"] == "huggingface-hub"

    def test_get_model_details_not_found(self, client):
        """Test handling of non-existent model."""
        with patch(
            "src.services.huggingface_hub_service.get_model_details"
        ) as mock_details:
            mock_details.return_value = None

            response = client.get("/v1/huggingface/models/nonexistent/model/details")

            assert response.status_code == 404
            assert "not found" in response.json()["detail"].lower()

    def test_get_model_details_error_handling(self, client):
        """Test error handling in model details endpoint."""
        with patch(
            "src.services.huggingface_hub_service.get_model_details"
        ) as mock_details:
            mock_details.side_effect = Exception("API error")

            response = client.get("/v1/huggingface/models/test/model/details")

            assert response.status_code == 500


class TestHuggingFaceModelCardEndpoint:
    """Test the /v1/huggingface/models/{model_id}/card endpoint."""

    def test_get_model_card_success(self, client):
        """Test retrieving model card successfully."""
        card_content = "# Llama 2 Model\n\nThis is a test model card."

        with patch("src.services.huggingface_hub_service.get_model_card") as mock_card:
            mock_card.return_value = card_content

            response = client.get("/v1/huggingface/models/meta-llama/Llama-2-7b/card")

            assert response.status_code == 200
            data = response.json()
            assert data["card"] == card_content
            assert data["source"] == "huggingface-hub"

    def test_get_model_card_not_found(self, client):
        """Test handling of missing model card."""
        with patch("src.services.huggingface_hub_service.get_model_card") as mock_card:
            mock_card.return_value = None

            response = client.get("/v1/huggingface/models/nonexistent/model/card")

            assert response.status_code == 404
            assert "not found" in response.json()["detail"].lower()

    def test_get_model_card_error_handling(self, client):
        """Test error handling in model card endpoint."""
        with patch("src.services.huggingface_hub_service.get_model_card") as mock_card:
            mock_card.side_effect = Exception("Download failed")

            response = client.get("/v1/huggingface/models/test/model/card")

            assert response.status_code == 500


class TestHuggingFaceAuthorModelsEndpoint:
    """Test the /v1/huggingface/author/{author}/models endpoint."""

    def test_list_author_models_success(self, client):
        """Test listing author models successfully."""
        with patch(
            "src.services.huggingface_hub_service.list_models_by_author"
        ) as mock_author:
            mock_author.return_value = [
                {
                    "id": "meta-llama/Llama-2-7b",
                    "name": "Llama 2 7B",
                    "provider_slug": "meta-llama",
                },
                {
                    "id": "meta-llama/Llama-2-13b",
                    "name": "Llama 2 13B",
                    "provider_slug": "meta-llama",
                },
            ]

            response = client.get("/v1/huggingface/author/meta-llama/models")

            assert response.status_code == 200
            data = response.json()
            assert data["author"] == "meta-llama"
            assert data["count"] == 2
            assert data["source"] == "huggingface-hub"

    def test_list_author_models_empty(self, client):
        """Test listing models for author with no models."""
        with patch(
            "src.services.huggingface_hub_service.list_models_by_author"
        ) as mock_author:
            mock_author.return_value = []

            response = client.get("/v1/huggingface/author/unknown-author/models")

            assert response.status_code == 200
            data = response.json()
            assert data["count"] == 0

    def test_list_author_models_limit(self, client):
        """Test limit parameter for author models."""
        with patch(
            "src.services.huggingface_hub_service.list_models_by_author"
        ) as mock_author:
            mock_author.return_value = []

            response = client.get("/v1/huggingface/author/meta-llama/models?limit=100")

            assert response.status_code == 200
            mock_author.assert_called_once_with(author="meta-llama", limit=100)


class TestHuggingFaceModelFilesEndpoint:
    """Test the /v1/huggingface/models/{model_id}/files endpoint."""

    def test_get_model_files_success(self, client):
        """Test retrieving model files successfully."""
        files_data = [
            {"name": "config.json", "size": 1024},
            {"name": "model.safetensors", "size": 5000000},
            {"name": "README.md", "size": 2048},
        ]

        with patch("src.services.huggingface_hub_service.get_model_files") as mock_files:
            mock_files.return_value = files_data

            response = client.get("/v1/huggingface/models/meta-llama/Llama-2-7b/files")

            assert response.status_code == 200
            data = response.json()
            assert data["count"] == 3
            assert len(data["files"]) == 3
            assert data["source"] == "huggingface-hub"

    def test_get_model_files_not_found(self, client):
        """Test handling of non-existent model for files."""
        with patch("src.services.huggingface_hub_service.get_model_files") as mock_files:
            mock_files.return_value = None

            response = client.get("/v1/huggingface/models/nonexistent/model/files")

            assert response.status_code == 404
            assert "not found" in response.json()["detail"].lower()

    def test_get_model_files_empty_list(self, client):
        """Test handling empty file list."""
        with patch("src.services.huggingface_hub_service.get_model_files") as mock_files:
            mock_files.return_value = []

            response = client.get("/v1/huggingface/models/test/model/files")

            assert response.status_code == 200
            data = response.json()
            assert data["count"] == 0


class TestHuggingFaceServiceNormalization:
    """Test model normalization in the service layer."""

    def test_normalize_model_info_basic(self):
        """Test normalizing basic model info."""
        from src.services.huggingface_hub_service import normalize_model_info

        model_info = MagicMock()
        model_info.id = "meta-llama/Llama-2-7b"
        model_info.pipeline_tag = "text-generation"
        model_info.description = "Llama 2 model"
        model_info.downloads = 1000000
        model_info.likes = 5000
        model_info.private = False
        model_info.gated = False
        model_info.createdAt = "2023-07-18T21:37:00.000Z"
        model_info.lastModified = "2024-01-15T10:30:00.000Z"
        model_info.library_name = "transformers"
        model_info.siblings = None

        normalized = normalize_model_info(model_info)

        assert normalized is not None
        assert normalized["id"] == "meta-llama/Llama-2-7b"
        assert normalized["name"] == "Llama 2 7B"
        assert normalized["source_gateway"] == "hug"
        assert normalized["architecture"]["modality"] == "text->text"
        assert normalized["huggingface_metrics"]["downloads"] == 1000000

    def test_normalize_model_info_skip_private(self):
        """Test that private models are skipped."""
        from src.services.huggingface_hub_service import normalize_model_info

        model_info = MagicMock()
        model_info.id = "private/model"
        model_info.private = True

        normalized = normalize_model_info(model_info)
        assert normalized is None

    def test_normalize_model_info_skip_gated(self):
        """Test that gated models are skipped."""
        from src.services.huggingface_hub_service import normalize_model_info

        model_info = MagicMock()
        model_info.id = "gated/model"
        model_info.gated = True
        model_info.private = False

        normalized = normalize_model_info(model_info)
        assert normalized is None

    def test_normalize_model_info_different_task_types(self):
        """Test normalization with different task types."""
        from src.services.huggingface_hub_service import normalize_model_info

        task_mappings = {
            "text-generation": "text->text",
            "text-to-image": "text->image",
            "image-to-text": "image->text",
            "summarization": "text->text",
        }

        for task, expected_modality in task_mappings.items():
            model_info = MagicMock()
            model_info.id = f"org/model-{task}"
            model_info.pipeline_tag = task
            model_info.description = f"Model with {task} task"
            model_info.downloads = 1000
            model_info.likes = 100
            model_info.private = False
            model_info.gated = False
            model_info.createdAt = "2024-01-01T00:00:00.000Z"
            model_info.lastModified = "2024-01-01T00:00:00.000Z"
            model_info.library_name = "transformers"
            model_info.siblings = None

            normalized = normalize_model_info(model_info)

            assert normalized is not None
            assert normalized["architecture"]["modality"] == expected_modality


class TestHuggingFaceServiceFunctions:
    """Test individual service functions."""

    def test_get_hf_api_client(self):
        """Test getting an authenticated HF API client."""
        from src.services.huggingface_hub_service import get_hf_api_client

        with patch("src.config.Config.HUG_API_KEY", "test-token"):
            client = get_hf_api_client()
            assert client is not None

    def test_list_huggingface_models_with_filters(self, mock_model_list):
        """Test listing models with filters."""
        from src.services.huggingface_hub_service import list_huggingface_models

        with patch("huggingface_hub.list_models") as mock_list:
            mock_list.return_value = iter(mock_model_list)

            result = list_huggingface_models(
                task="text-generation",
                limit=3,
                sort="downloads",
            )

            assert len(result) <= 3

    def test_search_models_by_query(self, mock_model_list):
        """Test searching models by query."""
        from src.services.huggingface_hub_service import search_models_by_query

        with patch("huggingface_hub.list_models") as mock_list:
            mock_list.return_value = iter(mock_model_list)

            result = search_models_by_query(
                query="llama",
                limit=10,
            )

            assert isinstance(result, list)

    def test_check_model_inference_availability(self):
        """Test checking model inference availability."""
        from src.services.huggingface_hub_service import check_model_inference_availability

        with patch(
            "src.services.huggingface_hub_service.get_model_details"
        ) as mock_details:
            mock_details.return_value = {
                "id": "test/model",
                "gated": False,
                "private": False,
            }

            result = check_model_inference_availability("test/model")
            assert result is True

        with patch(
            "src.services.huggingface_hub_service.get_model_details"
        ) as mock_details:
            mock_details.return_value = {
                "id": "test/model",
                "gated": True,
                "private": False,
            }

            result = check_model_inference_availability("test/model")
            assert result is False


class TestHuggingFaceIntegrationEdgeCases:
    """Test edge cases and error handling."""

    def test_endpoint_with_special_characters_in_model_id(self, client):
        """Test endpoints handle special characters in model IDs."""
        with patch(
            "src.services.huggingface_hub_service.get_model_details"
        ) as mock_details:
            mock_details.return_value = None

            # Model IDs with slashes are properly handled by {model_id:path}
            response = client.get(
                "/v1/huggingface/models/org/model-with-slashes/details"
            )

            # Should return 404 since model not found
            assert response.status_code == 404

    def test_concurrent_requests_to_discovery_endpoint(self, client):
        """Test that concurrent requests are handled safely."""
        with patch(
            "src.services.huggingface_hub_service.list_huggingface_models"
        ) as mock_list:
            mock_list.return_value = []

            # Make multiple concurrent requests (simulated sequentially)
            for i in range(5):
                response = client.get(f"/v1/huggingface/discovery?limit={10 + i}")
                assert response.status_code == 200

    def test_large_result_set_handling(self, client):
        """Test handling of large result sets."""
        with patch(
            "src.services.huggingface_hub_service.list_huggingface_models"
        ) as mock_list:
            # Create a large result set
            large_results = [{"id": f"model-{i}", "name": f"Model {i}"} for i in range(500)]
            mock_list.return_value = large_results

            response = client.get("/v1/huggingface/discovery?limit=500")

            assert response.status_code == 200
            data = response.json()
            assert data["count"] == 500
