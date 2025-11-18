#!/usr/bin/env python3
"""
Setup script to generate API key encryption configuration.

This script generates:
1. KEY_HASH_SALT - Used for deterministic hashing of API keys
2. KEY_VERSION - Version number for key rotation
3. KEYRING_1 - Fernet encryption key for at-rest encryption

Usage:
    python scripts/setup_encryption_keys.py [--output .env]
"""

import sys
import secrets
from pathlib import Path

try:
    from cryptography.fernet import Fernet
except ImportError:
    print("Error: cryptography library not installed.")
    print("Install it with: pip install cryptography")
    sys.exit(1)


def generate_encryption_config(output_file=None):
    """Generate encryption configuration and optionally write to .env file."""

    print("=" * 70)
    print("API Key Encryption Configuration Generator")
    print("=" * 70)
    print()

    # Generate KEY_HASH_SALT
    print("Generating KEY_HASH_SALT (for deterministic hashing)...")
    key_hash_salt = secrets.token_hex(32)
    print(f"  ✓ Generated 64-character salt")
    print()

    # Generate KEY_VERSION
    print("Setting KEY_VERSION...")
    key_version = "1"
    print(f"  ✓ KEY_VERSION = {key_version}")
    print()

    # Generate KEYRING_1 (Fernet key)
    print("Generating KEYRING_1 (for Fernet encryption)...")
    fernet_key = Fernet.generate_key().decode()
    print(f"  ✓ Generated base64-encoded Fernet key")
    print()

    # Display configuration
    print("=" * 70)
    print("Generated Configuration:")
    print("=" * 70)
    print()
    print("Add these to your .env file:")
    print()
    print("# API Key Security Configuration")
    print(f"KEY_HASH_SALT={key_hash_salt}")
    print(f"KEY_VERSION={key_version}")
    print(f"KEYRING_{key_version}={fernet_key}")
    print()

    # Optionally write to file
    if output_file:
        output_path = Path(output_file)

        # Read existing .env if it exists
        env_content = ""
        if output_path.exists():
            print(f"Reading existing {output_file}...")
            with open(output_path, "r") as f:
                env_content = f.read()

        # Check if keys already exist
        has_salt = "KEY_HASH_SALT=" in env_content
        has_version = "KEY_VERSION=" in env_content
        has_keyring = f"KEYRING_{key_version}=" in env_content

        if has_salt or has_version or has_keyring:
            print(f"⚠️  Warning: Some encryption keys already exist in {output_file}")
            print()
            if has_salt:
                print("  - KEY_HASH_SALT is already set")
            if has_version:
                print("  - KEY_VERSION is already set")
            if has_keyring:
                print(f"  - KEYRING_{key_version} is already set")
            print()

            # Ask for confirmation
            response = input("Do you want to overwrite them? (yes/no): ").strip().lower()
            if response not in ["yes", "y"]:
                print("Cancelled. No changes made.")
                print()
                print("To use the new keys, manually add them to your .env file:")
                print(f"  KEY_HASH_SALT={key_hash_salt}")
                print(f"  KEY_VERSION={key_version}")
                print(f"  KEYRING_{key_version}={fernet_key}")
                return

        # Remove old encryption keys
        lines = env_content.split("\n")
        filtered_lines = [
            line for line in lines
            if not any(line.startswith(prefix) for prefix in
                      ["KEY_HASH_SALT=", "KEY_VERSION=", f"KEYRING_{key_version}="])
        ]

        # Remove trailing empty lines
        while filtered_lines and filtered_lines[-1].strip() == "":
            filtered_lines.pop()

        # Add new keys
        new_content = "\n".join(filtered_lines)
        if new_content.strip():
            new_content += "\n\n"

        new_content += "# API Key Security Configuration (auto-generated)\n"
        new_content += f"KEY_HASH_SALT={key_hash_salt}\n"
        new_content += f"KEY_VERSION={key_version}\n"
        new_content += f"KEYRING_{key_version}={fernet_key}\n"

        # Write to file
        with open(output_path, "w") as f:
            f.write(new_content)

        print(f"✓ Written to {output_file}")
        print()
        print("Next steps:")
        print("  1. Restart your application:")
        print("     uvicorn src.main:app --reload")
        print()
        print("  2. Test API key creation:")
        print("     curl -X POST http://localhost:8000/user/api-keys \\")
        print("       -H 'Authorization: Bearer your-api-key'")
        print()
    else:
        print("To save these to your .env file, run:")
        print(f"  python scripts/setup_encryption_keys.py --output .env")
        print()


def main():
    """Main entry point."""
    output_file = None

    # Parse arguments
    if "--output" in sys.argv:
        idx = sys.argv.index("--output")
        if idx + 1 < len(sys.argv):
            output_file = sys.argv[idx + 1]

    generate_encryption_config(output_file)


if __name__ == "__main__":
    main()
