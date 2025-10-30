import os
import base64
import hashlib
from typing import Dict, Tuple

try:
    from cryptography.fernet import Fernet, InvalidToken  # type: ignore
except Exception:
    Fernet = None  # type: ignore
    InvalidToken = Exception  # type: ignore


def _load_keyring_from_env() -> Tuple[int, Dict[int, "Fernet"]]:
    """Load keyring from env. Example:
    KEY_VERSION=1
    KEYRING_1=<base64_fernet_key>
    """
    current = int(os.getenv("KEY_VERSION", "1"))
    keyring: Dict[int, "Fernet"] = {}
    # If cryptography is not available, fall back to no-op encryption
    if Fernet is None:
        return current, {}
    for k, v in os.environ.items():
        if k.startswith("KEYRING_") and v:
            try:
                ver = int(k.split("_", 1)[1])
                keyring[ver] = Fernet(v.encode("utf-8"))
            except Exception:
                continue
    # If no keyring configured, use empty dict to signal no-op encryption
    if current not in keyring and len(keyring) == 0:
        return current, {}
    # If some keys exist but not the current, pick the smallest available version
    if current not in keyring and len(keyring) > 0:
        current = sorted(keyring.keys())[0]
    return current, keyring


_CURRENT_VERSION, _KEYRING = _load_keyring_from_env()


def encrypt_api_key(plaintext: str) -> Tuple[str, int]:
    """Encrypt API key. If encryption is unavailable, return plaintext and version 0.
    This ensures the application continues working with sensible defaults.
    """
    try:
        f = _KEYRING.get(_CURRENT_VERSION) if isinstance(_KEYRING, dict) else None
        if f is None:
            return plaintext, 0
        token = f.encrypt(plaintext.encode("utf-8"))
        return token.decode("utf-8"), _CURRENT_VERSION
    except Exception:
        # Any encryption error falls back to plaintext with version 0
        return plaintext, 0


def sha256_key_hash(plaintext: str) -> str:
    """Deterministic hash for lookup/rate limiting. Optional salt support via env."""
    salt = os.getenv("KEY_HASH_SALT", "")
    h = hashlib.sha256()
    h.update(salt.encode("utf-8"))
    h.update(plaintext.encode("utf-8"))
    return h.hexdigest()


def last4(plaintext: str) -> str:
    return plaintext[-4:] if len(plaintext) >= 4 else plaintext


