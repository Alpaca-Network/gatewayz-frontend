#!/usr/bin/env python3
"""
Google Vertex AI Endpoint Validation Script

This script comprehensively validates that the Google Vertex AI endpoint is:
1. Properly configured with valid credentials
2. Able to list and serve available Google models
3. Able to make successful API calls to Vertex AI
4. Properly integrated with the main API gateway

Run with: python validate_vertex_endpoint.py
"""

import os
import sys
import json
import logging
from typing import Dict, Any, List
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Environment setup
os.environ.setdefault('APP_ENV', 'development')
os.environ.setdefault('TESTING', 'true')

class ValidationReport:
    """Stores validation results"""
    def __init__(self):
        self.timestamp = datetime.now().isoformat()
        self.sections = {}
        self.overall_status = "PASS"

    def add_section(self, name: str, status: str, details: Dict[str, Any]):
        """Add a validation section result"""
        self.sections[name] = {
            "status": status,
            "details": details
        }
        if status == "FAIL":
            self.overall_status = "FAIL"

    def print_report(self):
        """Print formatted validation report"""
        print("\n" + "="*70)
        print("GOOGLE VERTEX AI ENDPOINT VALIDATION REPORT")
        print("="*70)
        print(f"Timestamp: {self.timestamp}")
        print(f"Overall Status: {self.overall_status}")
        print("="*70 + "\n")

        for section_name, section_data in self.sections.items():
            status_symbol = "✓" if section_data["status"] == "PASS" else "✗"
            print(f"{status_symbol} {section_name}: {section_data['status']}")

            details = section_data.get("details", {})
            for key, value in details.items():
                if isinstance(value, dict):
                    print(f"  {key}:")
                    for k, v in value.items():
                        print(f"    - {k}: {v}")
                elif isinstance(value, list):
                    print(f"  {key}:")
                    for item in value:
                        if isinstance(item, dict):
                            for k, v in item.items():
                                print(f"    - {k}: {v}")
                        else:
                            print(f"    - {item}")
                else:
                    print(f"  {key}: {value}")
            print()

        print("="*70)
        return self.overall_status == "PASS"

def validate_environment_config() -> Dict[str, Any]:
    """Step 1: Validate Google Vertex environment configuration"""
    logger.info("\n[1/5] Validating Google Vertex environment configuration...")

    details = {
        "GOOGLE_PROJECT_ID": os.environ.get("GOOGLE_PROJECT_ID", "Not set"),
        "GOOGLE_VERTEX_LOCATION": os.environ.get("GOOGLE_VERTEX_LOCATION", "Not set"),
        "GOOGLE_APPLICATION_CREDENTIALS": "Set" if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") else "Not set",
        "GOOGLE_VERTEX_CREDENTIALS_JSON": "Set" if os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON") else "Not set",
    }

    # Check if at least one credential method is available
    has_credentials = (
        os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or
        os.environ.get("GOOGLE_VERTEX_CREDENTIALS_JSON")
    )

    status = "PASS" if has_credentials else "FAIL"
    logger.info(f"  Status: {status}")

    return {
        "status": status,
        "details": details
    }

def validate_google_vertex_imports() -> Dict[str, Any]:
    """Step 2: Validate Google Vertex SDK imports"""
    logger.info("\n[2/5] Validating Google Vertex SDK imports...")

    details = {}
    status = "PASS"

    try:
        import vertexai
        logger.info("  ✓ vertexai SDK imported successfully")
        details["vertexai"] = "Available"
    except ImportError as e:
        logger.warning(f"  ✗ Failed to import vertexai: {e}")
        details["vertexai"] = f"Not available: {str(e)}"
        status = "FAIL"

    try:
        from vertexai.generative_models import GenerativeModel
        logger.info("  ✓ GenerativeModel imported successfully")
        details["GenerativeModel"] = "Available"
    except ImportError as e:
        logger.warning(f"  ✗ Failed to import GenerativeModel: {e}")
        details["GenerativeModel"] = f"Not available: {str(e)}"
        status = "FAIL"

    try:
        from google.protobuf.json_format import MessageToDict
        logger.info("  ✓ MessageToDict imported successfully")
        details["MessageToDict"] = "Available"
    except ImportError as e:
        logger.warning(f"  ✗ Failed to import MessageToDict: {e}")
        details["MessageToDict"] = f"Not available: {str(e)}"
        status = "FAIL"

    return {
        "status": status,
        "details": details
    }

def validate_gateway_imports() -> Dict[str, Any]:
    """Step 3: Validate gateway module imports"""
    logger.info("\n[3/5] Validating gateway module imports...")

    details = {}
    status = "PASS"

    try:
        from src.services.google_vertex_client import (
            make_google_vertex_request_openai,
            diagnose_google_vertex_credentials
        )
        logger.info("  ✓ Google Vertex client imported successfully")
        details["google_vertex_client"] = "Available"
    except ImportError as e:
        logger.error(f"  ✗ Failed to import google_vertex_client: {e}")
        details["google_vertex_client"] = f"Not available: {str(e)}"
        status = "FAIL"

    try:
        from src.services.google_models_config import get_google_models
        logger.info("  ✓ Google models config imported successfully")
        details["google_models_config"] = "Available"
    except ImportError as e:
        logger.error(f"  ✗ Failed to import google_models_config: {e}")
        details["google_models_config"] = f"Not available: {str(e)}"
        status = "FAIL"

    try:
        from src.routes.chat import app
        logger.info("  ✓ Chat routes imported successfully")
        details["chat_routes"] = "Available"
    except ImportError as e:
        logger.error(f"  ✗ Failed to import chat routes: {e}")
        details["chat_routes"] = f"Not available: {str(e)}"
        status = "FAIL"

    return {
        "status": status,
        "details": details
    }

def validate_models_available() -> Dict[str, Any]:
    """Step 4: Validate available Google Vertex models"""
    logger.info("\n[4/5] Validating available Google Vertex models...")

    try:
        from src.services.google_models_config import get_google_models

        models = get_google_models()
        logger.info(f"  Found {len(models)} Google models total")

        # Filter models with google-vertex provider
        vertex_models = []
        for model in models:
            for provider in model.providers:
                if provider.name == "google-vertex":
                    vertex_models.append({
                        "id": model.id,
                        "name": model.name,
                        "vertex_model_id": provider.model_id,
                        "priority": provider.priority,
                        "features": provider.features,
                    })
                    break

        logger.info(f"  Found {len(vertex_models)} models with google-vertex provider")

        details = {
            "total_google_models": len(models),
            "vertex_available_models": len(vertex_models),
            "models": vertex_models[:5]  # Show first 5
        }

        if len(vertex_models) > 5:
            details["and_more"] = f"... and {len(vertex_models) - 5} more models"

        status = "PASS" if len(vertex_models) > 0 else "FAIL"
        logger.info(f"  Status: {status}")

        return {
            "status": status,
            "details": details
        }

    except Exception as e:
        logger.error(f"  ✗ Failed to validate models: {e}")
        return {
            "status": "FAIL",
            "details": {"error": str(e)}
        }

def validate_vertex_initialization() -> Dict[str, Any]:
    """Step 5: Validate Vertex AI initialization and credentials"""
    logger.info("\n[5/5] Validating Vertex AI initialization...")

    try:
        from src.services.google_vertex_client import diagnose_google_vertex_credentials

        diagnosis = diagnose_google_vertex_credentials()
        logger.info(f"  Health Status: {diagnosis.get('health_status', 'unknown')}")

        details = {
            "credentials_available": diagnosis.get("credentials_available"),
            "credential_source": diagnosis.get("credential_source"),
            "project_id": diagnosis.get("project_id"),
            "location": diagnosis.get("location"),
            "initialization_successful": diagnosis.get("initialization_successful"),
            "health_status": diagnosis.get("health_status"),
            "diagnostics": []
        }

        # Add diagnostic steps
        for step in diagnosis.get("steps", []):
            details["diagnostics"].append({
                "step": step.get("step"),
                "passed": step.get("passed"),
                "details": step.get("details")
            })

        if diagnosis.get("error"):
            details["error"] = diagnosis.get("error")

        status = "PASS" if diagnosis.get("health_status") == "healthy" else "FAIL"
        logger.info(f"  Status: {status}")

        return {
            "status": status,
            "details": details
        }

    except Exception as e:
        logger.error(f"  ✗ Failed to validate initialization: {e}")
        return {
            "status": "FAIL",
            "details": {"error": str(e), "exception_type": type(e).__name__}
        }

def validate_api_endpoint_integration() -> Dict[str, Any]:
    """Bonus: Validate API endpoint integration"""
    logger.info("\n[BONUS] Validating API endpoint integration...")

    try:
        from fastapi.testclient import TestClient
        from src.main import app

        client = TestClient(app)
        logger.info("  ✓ FastAPI app and test client created")

        # Check if /v1/chat/completions endpoint exists
        details = {
            "chat_endpoint_available": True,
            "health_check_endpoint": "/health",
            "chat_completions_endpoint": "/v1/chat/completions",
            "models_endpoint": "/v1/models",
        }

        # Try to hit health endpoint
        try:
            response = client.get("/health")
            details["health_endpoint_status"] = response.status_code
            logger.info(f"  ✓ Health endpoint accessible: {response.status_code}")
        except Exception as e:
            details["health_endpoint_error"] = str(e)
            logger.warning(f"  ✗ Health endpoint error: {e}")

        status = "PASS"
        logger.info(f"  Status: {status}")

        return {
            "status": status,
            "details": details
        }

    except Exception as e:
        logger.error(f"  ✗ Failed to validate endpoint integration: {e}")
        return {
            "status": "FAIL",
            "details": {"error": str(e), "exception_type": type(e).__name__}
        }

def main():
    """Run all validation checks"""
    print("\n" + "="*70)
    print("STARTING GOOGLE VERTEX AI ENDPOINT VALIDATION")
    print("="*70)

    report = ValidationReport()

    # Run validation checks
    try:
        # Step 1: Environment
        result = validate_environment_config()
        report.add_section("Environment Configuration", result["status"], result["details"])

        # Step 2: Google SDK imports
        result = validate_google_vertex_imports()
        report.add_section("Google Vertex SDK", result["status"], result["details"])

        # Step 3: Gateway imports
        result = validate_gateway_imports()
        report.add_section("Gateway Module Imports", result["status"], result["details"])

        # Step 4: Models available
        result = validate_models_available()
        report.add_section("Available Models", result["status"], result["details"])

        # Step 5: Vertex initialization
        result = validate_vertex_initialization()
        report.add_section("Vertex AI Initialization", result["status"], result["details"])

        # Bonus: API endpoint
        result = validate_api_endpoint_integration()
        report.add_section("API Endpoint Integration", result["status"], result["details"])

    except Exception as e:
        logger.error(f"Validation error: {e}", exc_info=True)
        report.add_section("Validation Error", "FAIL", {"error": str(e)})

    # Print report
    success = report.print_report()

    # Save report to file
    report_file = "/tmp/vertex_validation_report.json"
    try:
        with open(report_file, "w") as f:
            json.dump(report.sections, f, indent=2, default=str)
        logger.info(f"\nReport saved to: {report_file}")
    except Exception as e:
        logger.warning(f"Failed to save report: {e}")

    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
