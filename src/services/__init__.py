# Services package
# Lazy imports for testing - makes modules accessible without importing dependencies
def __getattr__(name):
    if name == "rate_limiting":
        from . import rate_limiting
        return rate_limiting
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")
