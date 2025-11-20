"""
Vercel serverless function handler for FastAPI app
"""
import sys
import os

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

try:
    from src.main import app
    # Vercel looks for 'app' directly for FastAPI
    # No need to rename to 'handler' - modern @vercel/python runtime handles FastAPI apps

except Exception as e:
    # If import fails, create a simple error app
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    import traceback

    app = FastAPI()

    error_details = {
        "error": "Failed to load application",
        "exception": str(e),
        "type": type(e).__name__,
        "traceback": traceback.format_exc()
    }

    @app.get("/{path:path}")
    @app.post("/{path:path}")
    @app.put("/{path:path}")
    @app.delete("/{path:path}")
    async def error_handler(path: str):
        return JSONResponse(
            status_code=500,
            content=error_details
        )
