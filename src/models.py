"""
Legacy models file - kept for backward compatibility
All models now in src/schemas/
"""

# Re-export everything from schemas
from src.schemas import *

# This allows existing code to keep using:
# from src.models import UserCreate, PaymentCreate, etc.
