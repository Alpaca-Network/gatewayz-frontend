<<<<<<< HEAD
"""
Vercel serverless function handler for FastAPI app
"""
import sys
import os

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

try:
    from src.main import app

    # Export the app for Vercel
    # Vercel will look for an 'app' or 'handler' variable
    handler = app

except Exception as e:
    # If import fails, create a simple error app
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI()

    @app.get("/{path:path}")
    async def error_handler(path: str):
        return JSONResponse(
            status_code=500,
            content={
                "error": "Failed to load application",
                "details": str(e),
                "path": path
            }
        )

    handler = app
=======
"""
Vercel serverless function handler for FastAPI app
"""
import sys
import os

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

try:
    from src.main import app

    # Export the app for Vercel
    # Vercel will look for an 'app' or 'handler' variable
    handler = app

except Exception as e:
    # If import fails, create a simple error app
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI()

    @app.get("/{path:path}")
    async def error_handler(path: str):
        return JSONResponse(
            status_code=500,
            content={
                "error": "Failed to load application",
                "details": str(e),
                "path": path
            }
        )

    handler = app
>>>>>>> 2ae02462568dfc0936bd8ac6f970c8062cc98d01
