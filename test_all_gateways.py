"""
Comprehensive Gateway Testing Script
Tests model accessibility for all configured gateways
"""
import asyncio
import httpx
from typing import Dict, List, Optional
from datetime import datetime
from dotenv import load_dotenv
import json

load_dotenv()

BASE_URL = "http://localhost:8000"

# Sample models to test for each gateway
TEST_MODELS = {
    "openrouter": [
        {"provider": "openai", "model": "gpt-4"},
        {"provider": "anthropic", "model": "claude-3-opus"},
        {"provider": "meta-llama", "model": "llama-3-70b-instruct"},
    ],
    "portkey": [
        {"provider": "openai", "model": "gpt-4"},
        {"provider": "anthropic", "model": "claude-3-opus-20240229"},
        {"provider": "google", "model": "gemini-pro"},
    ],
    "featherless": [
        {"provider": "meta-llama", "model": "Meta-Llama-3.1-8B-Instruct"},
        {"provider": "mistralai", "model": "Mistral-7B-Instruct-v0.3"},
    ],
    "chutes": [
        {"provider": "stabilityai", "model": "stable-diffusion-xl-base-1.0"},
        {"provider": "runwayml", "model": "stable-diffusion-v1-5"},
    ],
    "groq": [
        {"provider": "groq", "model": "llama-3.1-70b-versatile"},
        {"provider": "groq", "model": "mixtral-8x7b-32768"},
    ],
    "fireworks": [
        {"provider": "accounts/fireworks/models", "model": "deepseek-v3p1"},
        {"provider": "accounts/fireworks/models", "model": "llama-v3p1-70b-instruct"},
    ],
    "together": [
        {"provider": "meta-llama", "model": "Meta-Llama-3.1-70B-Instruct-Turbo"},
        {"provider": "mistralai", "model": "Mixtral-8x7B-Instruct-v0.1"},
    ],
}


class GatewayTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "gateways": {},
            "summary": {}
        }

    async def test_gateway_list(self, gateway: str) -> Dict:
        """Test if gateway's model list endpoint works"""
        try:
            url = f"{BASE_URL}/catalog/models?gateway={gateway}&limit=5"
            response = await self.client.get(url)
            
            if response.status_code == 200:
                data = response.json()
                model_count = data.get("total", 0)
                returned = data.get("returned", 0)
                
                return {
                    "status": "success",
                    "total_models": model_count,
                    "returned": returned,
                    "sample_models": [m.get("id") for m in data.get("data", [])[:3]]
                }
            else:
                return {
                    "status": "error",
                    "error": f"HTTP {response.status_code}",
                    "message": response.text[:200]
                }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }

    async def test_specific_model(self, gateway: str, provider: str, model: str) -> Dict:
        """Test if a specific model is accessible"""
        try:
            url = f"{BASE_URL}/catalog/model/{provider}/{model}?gateway={gateway}"
            response = await self.client.get(url)
            
            if response.status_code == 200:
                data = response.json()
                model_data = data.get("data", {})
                
                return {
                    "status": "success",
                    "model_id": model_data.get("id"),
                    "name": model_data.get("name"),
                    "has_pricing": bool(model_data.get("pricing")),
                    "source_gateway": model_data.get("source_gateway")
                }
            elif response.status_code == 404:
                return {
                    "status": "not_found",
                    "model": f"{provider}/{model}"
                }
            else:
                return {
                    "status": "error",
                    "error": f"HTTP {response.status_code}",
                    "message": response.text[:200]
                }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }

    async def test_gateway(self, gateway: str) -> Dict:
        """Comprehensive test of a single gateway"""
        print(f"\n{'='*60}")
        print(f"Testing {gateway.upper()} Gateway")
        print(f"{'='*60}")
        
        results = {
            "list_endpoint": None,
            "model_tests": []
        }

        # Test list endpoint
        print(f"\n[1] Testing list endpoint for {gateway}...")
        list_result = await self.test_gateway_list(gateway)
        results["list_endpoint"] = list_result
        
        if list_result["status"] == "success":
            print(f"✓ List endpoint working - {list_result['total_models']} models available")
            if list_result.get("sample_models"):
                print(f"  Sample models: {', '.join(list_result['sample_models'][:3])}")
        else:
            print(f"✗ List endpoint failed: {list_result.get('error', 'Unknown error')}")

        # Test specific models
        test_models = TEST_MODELS.get(gateway, [])
        print(f"\n[2] Testing {len(test_models)} specific models...")
        
        for i, model_info in enumerate(test_models, 1):
            provider = model_info["provider"]
            model = model_info["model"]
            model_id = f"{provider}/{model}"
            
            print(f"\n  [{i}/{len(test_models)}] Testing {model_id}...", end=" ")
            
            model_result = await self.test_specific_model(gateway, provider, model)
            model_result["tested_id"] = model_id
            results["model_tests"].append(model_result)
            
            if model_result["status"] == "success":
                print(f"✓ Accessible")
                print(f"      Name: {model_result.get('name', 'N/A')}")
                print(f"      Pricing: {'Yes' if model_result.get('has_pricing') else 'No'}")
            elif model_result["status"] == "not_found":
                print(f"✗ Not found")
            else:
                print(f"✗ Error: {model_result.get('error', 'Unknown')}")

        return results

    async def test_all_gateways(self):
        """Test all configured gateways"""
        print("\n" + "="*60)
        print("GATEWAY ACCESSIBILITY TEST")
        print("="*60)
        print(f"Testing {len(TEST_MODELS)} gateways")
        print(f"Base URL: {BASE_URL}")
        
        for gateway in TEST_MODELS.keys():
            results = await self.test_gateway(gateway)
            self.results["gateways"][gateway] = results
            
            # Add small delay between gateways
            await asyncio.sleep(0.5)

        # Generate summary
        self.generate_summary()
        self.print_summary()
        self.save_results()

    def generate_summary(self):
        """Generate summary statistics"""
        summary = {
            "total_gateways": len(self.results["gateways"]),
            "working_gateways": 0,
            "failed_gateways": 0,
            "total_models_tested": 0,
            "accessible_models": 0,
            "not_found_models": 0,
            "error_models": 0,
            "gateway_details": {}
        }

        for gateway, results in self.results["gateways"].items():
            list_ok = results["list_endpoint"]["status"] == "success"
            model_tests = results["model_tests"]
            
            accessible = sum(1 for m in model_tests if m["status"] == "success")
            not_found = sum(1 for m in model_tests if m["status"] == "not_found")
            errors = sum(1 for m in model_tests if m["status"] == "error")
            
            summary["total_models_tested"] += len(model_tests)
            summary["accessible_models"] += accessible
            summary["not_found_models"] += not_found
            summary["error_models"] += errors
            
            if list_ok and accessible > 0:
                summary["working_gateways"] += 1
                status = "✓ Working"
            else:
                summary["failed_gateways"] += 1
                status = "✗ Issues"
            
            summary["gateway_details"][gateway] = {
                "status": status,
                "list_endpoint": "✓" if list_ok else "✗",
                "accessible": accessible,
                "not_found": not_found,
                "errors": errors,
                "total_tested": len(model_tests)
            }

        self.results["summary"] = summary

    def print_summary(self):
        """Print summary report"""
        print("\n" + "="*60)
        print("SUMMARY REPORT")
        print("="*60)
        
        summary = self.results["summary"]
        
        print(f"\nOverall Statistics:")
        print(f"  Total Gateways: {summary['total_gateways']}")
        print(f"  Working: {summary['working_gateways']}")
        print(f"  Failed: {summary['failed_gateways']}")
        print(f"\nModel Accessibility:")
        print(f"  Total Tested: {summary['total_models_tested']}")
        print(f"  Accessible: {summary['accessible_models']}")
        print(f"  Not Found: {summary['not_found_models']}")
        print(f"  Errors: {summary['error_models']}")
        
        print(f"\nGateway Status:")
        print(f"  {'Gateway':<15} {'Status':<12} {'List':<6} {'Accessible':<12} {'Not Found':<11} {'Errors'}")
        print(f"  {'-'*15} {'-'*12} {'-'*6} {'-'*12} {'-'*11} {'-'*6}")
        
        for gateway, details in summary["gateway_details"].items():
            print(f"  {gateway:<15} {details['status']:<12} {details['list_endpoint']:<6} "
                  f"{details['accessible']}/{details['total_tested']:<11} "
                  f"{details['not_found']:<11} {details['errors']}")

    def save_results(self):
        """Save results to JSON file"""
        filename = f"gateway_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w') as f:
            json.dump(self.results, f, indent=2)
        print(f"\n✓ Detailed results saved to: {filename}")

    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()


async def main():
    """Main entry point"""
    tester = GatewayTester()
    try:
        await tester.test_all_gateways()
    finally:
        await tester.close()


if __name__ == "__main__":
    asyncio.run(main())