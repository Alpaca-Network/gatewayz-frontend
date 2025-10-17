import os
import asyncio
import pytest

# Skip all tests in this module if chutes is not installed
pytest.importorskip("chutes")

from chutes.crud import list_chutes

os.environ["CHUTES_API_KEY"] = "cpk_0fc45d79a09e4be6a2c2435221361c71.e8060b822b7b5563847ade88501ef20a.tB8wgtKBInv8HCa4nGUTyGVpvqGg9Qc4"

# Test listing public chutes
async def test():
    print("Listing public chutes...")
    result = await list_chutes(include_public=True, limit=100)
    print(f"Result: {result}")

asyncio.run(test())
