#!/usr/bin/env python3
"""
Validate Google models configuration by parsing the model transformations.
This is a simpler version that doesn't require running the full app.
"""

import re
import json
from pathlib import Path

# Read the model_transformations.py file
repo_root = Path(__file__).parent.parent.parent.resolve()  # Go up 3 levels: validation -> scripts -> repo
transformations_file = repo_root / 'src' / 'services' / 'model_transformations.py'
with open(transformations_file, 'r') as f:
    content = f.read()

# Extract Gemini constants
constants = {
    'GEMINI_2_5_FLASH_LITE_PREVIEW': None,
    'GEMINI_2_5_FLASH_PREVIEW': None,
    'GEMINI_2_5_PRO_PREVIEW': None,
    'GEMINI_2_0_FLASH': None,
    'GEMINI_2_0_PRO': None,
    'GEMINI_1_5_PRO': None,
    'GEMINI_1_5_FLASH': None,
    'GEMINI_1_0_PRO': None,
}

for const_name in constants.keys():
    # Look for pattern: CONSTANT_NAME = "value"
    pattern = rf'{const_name}\s*=\s*"([^"]+)"'
    match = re.search(pattern, content)
    if match:
        constants[const_name] = match.group(1)

# Extract google-vertex mappings
google_vertex_section = re.search(
    r'"google-vertex":\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}',
    content,
    re.DOTALL
)

models = {}
if google_vertex_section:
    mapping_section = google_vertex_section.group(1)

    # Extract all "key": value pairs
    pattern = r'"([^"]+)":\s*([A-Z_0-9]+|"[^"]+")'
    matches = re.findall(pattern, mapping_section)

    for key, value in matches:
        # Resolve constants to actual values
        resolved_value = value
        if value in constants:
            resolved_value = constants[value]
        elif value.startswith('"') and value.endswith('"'):
            resolved_value = value[1:-1]

        if resolved_value:
            models[key] = resolved_value

# Print results
print("=" * 90)
print("Google Vertex AI Models Configuration Validation")
print("=" * 90)

print("\n1. Gemini Constants Defined:")
print("-" * 90)
for const_name, value in constants.items():
    status = "✓" if value else "✗"
    print(f"{status} {const_name}: {value}")

print("\n2. Stable Model IDs (values):")
print("-" * 90)
unique_models = {}
for key, value in models.items():
    if value not in unique_models:
        unique_models[value] = []
    unique_models[value].append(key)

for model_id, aliases in sorted(unique_models.items()):
    print(f"\n✓ {model_id}")
    print(f"  Input aliases ({len(aliases)}):")
    for alias in sorted(set(aliases)):
        print(f"    - {alias}")

print("\n3. Available Input Formats:")
print("-" * 90)
input_formats = sorted(set(models.keys()))
for idx, fmt in enumerate(input_formats, 1):
    resolved = models[fmt]
    if fmt != resolved:
        print(f"{idx}. {fmt:40s} → {resolved}")
    else:
        print(f"{idx}. {fmt:40s} (stable)")

print("\n4. Summary:")
print("-" * 90)
print(f"Total input aliases: {len(models)}")
print(f"Unique model IDs: {len(unique_models)}")
print(f"Stable models available: {len(unique_models)}")

print("\nAvailable stable models for testing:")
for model_id in sorted(unique_models.keys()):
    # Only show unique model IDs, not remappings
    if '-flash-thinking' not in model_id or model_id == "gemini-2.0-flash-thinking":
        print(f"  - {model_id}")

# Create test data
print("\n5. Test Models (for validation):")
print("-" * 90)

test_models = [
    # Latest preview models (mapped to stable)
    ("gemini-2.5-flash-lite", models.get("gemini-2.5-flash-lite", "N/A")),
    ("gemini-2.5-flash", models.get("gemini-2.5-flash", "N/A")),
    ("gemini-2.5-pro", models.get("gemini-2.5-pro", "N/A")),

    # Stable 2.0 models
    ("gemini-2.0-flash", models.get("gemini-2.0-flash", "N/A")),
    ("gemini-2.0-pro", models.get("gemini-2.0-pro", "N/A")),
    ("gemini-2.0-flash-thinking", models.get("gemini-2.0-flash-thinking", "N/A")),

    # Stable 1.5 models
    ("gemini-1.5-pro", models.get("gemini-1.5-pro", "N/A")),
    ("gemini-1.5-flash", models.get("gemini-1.5-flash", "N/A")),

    # Stable 1.0 models
    ("gemini-1.0-pro", models.get("gemini-1.0-pro", "N/A")),
]

for input_model, resolved_model in test_models:
    status = "✓" if resolved_model != "N/A" else "✗"
    print(f"{status} {input_model:30s} → {resolved_model}")

# Export to JSON
print("\n" + "=" * 90)
output_file = repo_root / "google_models_config.json"
with open(output_file, 'w') as f:
    json.dump({
        "timestamp": "2025-11-07",
        "total_inputs": len(models),
        "unique_models": len(unique_models),
        "constants": {k: v for k, v in constants.items() if v},
        "unique_models_list": sorted(unique_models.keys()),
        "all_mappings": {k: v for k, v in sorted(models.items())},
        "test_models": [
            {"input": inp, "resolves_to": res}
            for inp, res in test_models
        ]
    }, f, indent=2)

print(f"Configuration exported to: {output_file}")
print("=" * 90)
