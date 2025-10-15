"""
Validate that all models follow the correct provider/model ID format
"""
from src.services.models import get_cached_models

def validate_model_format(model_id: str) -> dict:
    """Validate a model ID follows provider/model format"""
    if not model_id:
        return {
            "valid": False,
            "issue": "Empty model ID"
        }
    
    if "/" not in model_id:
        return {
            "valid": False,
            "issue": "Missing slash separator (should be provider/model)"
        }
    
    parts = model_id.split("/")
    if len(parts) < 2:
        return {
            "valid": False,
            "issue": "Invalid format (should be provider/model)"
        }
    
    provider = parts[0]
    model = "/".join(parts[1:])  # Handle models with multiple slashes
    
    if not provider or not model:
        return {
            "valid": False,
            "issue": "Provider or model name is empty"
        }
    
    # Check for special characters that might cause URL issues
    issues = []
    if " " in model_id:
        issues.append("Contains spaces")
    if "%" in model_id:
        issues.append("Contains percent sign (might be pre-encoded)")
    
    return {
        "valid": True,
        "provider": provider,
        "model": model,
        "parts_count": len(parts),
        "warnings": issues if issues else None
    }


def test_all_models():
    """Test all models across all gateways"""
    gateways = ["portkey", "openrouter", "featherless", "deepinfra", "chutes", "groq"]
    
    print("="*80)
    print("MODEL FORMAT VALIDATION")
    print("="*80)
    
    all_results = {}
    
    for gateway in gateways:
        print(f"\n{'='*80}")
        print(f"Gateway: {gateway.upper()}")
        print('='*80)
        
        models = get_cached_models(gateway) or []
        
        if not models:
            print(f"⚠️  No models found for {gateway}")
            continue
        
        print(f"Total models: {len(models)}\n")
        
        valid_count = 0
        invalid_count = 0
        warning_count = 0
        invalid_models = []
        warning_models = []
        
        for model in models:
            model_id = model.get("id", "")
            result = validate_model_format(model_id)
            
            if result["valid"]:
                valid_count += 1
                if result.get("warnings"):
                    warning_count += 1
                    warning_models.append({
                        "id": model_id,
                        "warnings": result["warnings"]
                    })
            else:
                invalid_count += 1
                invalid_models.append({
                    "id": model_id,
                    "issue": result["issue"]
                })
        
        # Print summary
        print(f"✅ Valid: {valid_count}/{len(models)} ({round(valid_count/len(models)*100, 1)}%)")
        print(f"❌ Invalid: {invalid_count}/{len(models)}")
        print(f"⚠️  Warnings: {warning_count}/{len(models)}")
        
        # Show invalid models
        if invalid_models:
            print(f"\n❌ INVALID MODELS:")
            for item in invalid_models[:10]:  # Show first 10
                print(f"   - {item['id']}")
                print(f"     Issue: {item['issue']}")
            if len(invalid_models) > 10:
                print(f"   ... and {len(invalid_models) - 10} more")
        
        # Show warnings
        if warning_models:
            print(f"\n⚠️  MODELS WITH WARNINGS:")
            for item in warning_models[:5]:  # Show first 5
                print(f"   - {item['id']}")
                print(f"     Warnings: {', '.join(item['warnings'])}")
            if len(warning_models) > 5:
                print(f"   ... and {len(warning_models) - 5} more")
        
        all_results[gateway] = {
            "total": len(models),
            "valid": valid_count,
            "invalid": invalid_count,
            "warnings": warning_count,
            "invalid_models": invalid_models,
            "warning_models": warning_models
        }
    
    # Overall summary
    print(f"\n{'='*80}")
    print("OVERALL SUMMARY")
    print('='*80)
    
    total_models = sum(r["total"] for r in all_results.values())
    total_valid = sum(r["valid"] for r in all_results.values())
    total_invalid = sum(r["invalid"] for r in all_results.values())
    total_warnings = sum(r["warnings"] for r in all_results.values())
    
    print(f"\nTotal models across all gateways: {total_models}")
    print(f"✅ Valid: {total_valid} ({round(total_valid/total_models*100, 1)}%)")
    print(f"❌ Invalid: {total_invalid} ({round(total_invalid/total_models*100, 1)}%)")
    print(f"⚠️  Warnings: {total_warnings} ({round(total_warnings/total_models*100, 1)}%)")
    
    if total_invalid == 0:
        print(f"\n🎉 ALL MODELS HAVE VALID FORMAT!")
    else:
        print(f"\n⚠️  {total_invalid} models need fixing")
    
    return all_results


if __name__ == "__main__":
    results = test_all_models()
    
    # Save results to file
    import json
    with open("model_format_validation_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: model_format_validation_results.json")