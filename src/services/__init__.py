# Services package
# Lazy imports for testing - makes modules accessible without importing dependencies
import sys


def __getattr__(name):
    if name in ("rate_limiting", "huggingface_hub_service"):
        # Import the module dynamically to avoid circular reference
        import importlib

        module = importlib.import_module(f"{__name__}.{name}")
        # Cache it in the module's namespace to avoid recursion
        setattr(sys.modules[__name__], name, module)
        return module
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")
